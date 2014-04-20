/*jslint node: true */
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var logger = require('loge');
var path = require('path');
var redis = require('redis');
var streaming = require('streaming');
var url = require('url');

var agent = require('./agent');
var browser = require('./browser');
var db = require('./db');
var queue = require('./queue');
var ns = queue.ns;

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

var work = exports.work = function(callback) {
  /** work through the redis list called "cameo:urls:queue"

  callback: function(Error | null)
  */
  queue.startCluster();
};

var add = exports.add = function(urls_or_filenames, callback) {
  var redis_client = redis.createClient();
  var addFile = function(stream, callback) {
    stream.pipe(new streaming.Splitter())
    .on('error', function(err) {
      callback(err);
    })
    .on('data', function(url) {
      logger.info('adding url from input: "%s"', url);
      redis_client.lpush(ns('urls', 'queue'), url);
    })
    .on('end', function() {
      logger.info('done with input');
      callback();
    });
  };

  if (urls_or_filenames.length === 0) {
    // default to reading from stdin, if nothing is specified
    urls_or_filenames = ['-'];
  }
  // put it at the top of the queue
  async.each(urls_or_filenames, function(url_or_filename, callback) {
    if (url_or_filename.match(/^http/)) {
      // url
      logger.info('adding url from command line arguments: "%s"', url_or_filename);
      redis_client.lpush(ns('urls', 'queue'), url_or_filename, callback);
    }
    else {
      // file
      if (url_or_filename == '-') {
        // stdin
        addFile(process.stdin, callback);
      }
      else {
        addFile(fs.createReadStream(url_or_filename, {encoding: 'utf8'}), callback);
      }

    }
  }, function(err) {
    // wait for all those pushes to go through
    redis_client.on('end', function() {
      callback(err);
    }).quit();
  });
};
