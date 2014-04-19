/*jslint node: true */
var path = require('path');
var logger = require('loge');
var async = require('async');
var redis = require('redis');
var url = require('url');
var _ = require('underscore');
var db = require('./db');
var agent = require('./agent');

var ns = exports.ns = function(/* parts... */) {
  // quick namespace prefixer for redis keys
  return Array.prototype.concat.apply(['cameo', 'v01'], arguments).join(':');
};

exports.install = function(callback) {
  /** Create the database if it doesn't exist and run schema.sql on it.
  callback: function(Error | null)
  */
  var schema_filepath = path.join(__dirname, 'schema.sql');
  db.databaseExists(function(err, exists) {
    if (err) return callback(err);
    if (!exists) {
      db.createDatabase(function(err) {
        if (err) return callback(err);
        db.executeSQLFile(schema_filepath, callback);
      });
    }
    else {
      callback();
    }
  });
};

var useragents = require('./useragents');

var requestAndInsertUrl = function(request_url, callback) {
  /**
  callback: function(Error | null)
  */
  var options = url.parse(request_url);
  options.headers = {
    'accept-encoding': 'gzip,deflate',
    'user-agent': _.sample(useragents),
  };
  options.method = 'GET';

  // var request_page = response_page

  agent.request(options, function(err, res) {
    if (err) return callback(err);
    // page:
    //   statusCode: Number
    //   headers: Object
    //   body: String

    db.Insert('pages')
    .set({
      request_url: request_url,
      request_method: options.method,
      request_headers: options.headers,
      response_status_code: res.statusCode, // a Number
      response_headers: res.headers, // an Object[String -> String]
      response_body: res.body, // a String
    })
    .execute(function(err, page) {
      if (err) return callback(err);

      logger.info('added page to database');
      callback(err);
    });

    if (res.statusCode >= 300 && res.statusCode <= 303) {
      // add redirect to queue
      var redirect_url = url.resolve(request_url, res.headers.location);
      logger.info('adding redirct url: "%s"', redirect_url);

      var redis_client = redis.createClient();
      // put it at the top of the queue
      redis_client.lpush(ns('urls', 'queue'), redirect_url);
      redis_client.quit();
    }
  });
};

var work = exports.work = function(callback) {
  /** work through the redis list called "cameo:urls:queue"

  callback: function(Error | null)
  */
  // seen_urls is just a local cache to avoid all the unique conflicts on (tag, url)
  // it's not preloaded with a `SELECT url FROM pages`, though maybe it should be.
  // It's not required, but it can prevent having to make lots of INSERTs that fail
  // due to the UNIQUE constraint on (tag, url)
  logger.info('Beginning work at %s', new Date().toISOString());
  var redis_client = redis.createClient();
  (function loop() {
    // redis_client.quit();
    redis_client.brpoplpush(ns('urls', 'queue'), ns('urls', 'tried'), 0, function(err, url) {
      if (err) return callback(err);
      requestAndInsertUrl(url, function(err) {
        if (err) return callback(err);

        setImmediate(loop);
      });
    });
  })();
};
