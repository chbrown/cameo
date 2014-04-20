/*jslint node: true */
var _ = require('underscore');
var logger = require('loge');
var redis = require('redis');
var url = require('url');

var agent = require('./agent');
var ns = require('./queue').ns;
var db = require('./db');
var useragents = require('./useragents');

var ignore_error_codes = [
  // HTTP protocol/path error; means the path doesn't start with /, for example
  'HPE_INVALID_CONSTANT',
  'TIMEOUT',
];

var get = function(request_url, callback) {
  /** A little more wrapping around agent.request, add some headers, swallow some errors.

  request_url: String
  callback: function(Error | null, null | request, null | response)
    request: {
      url: String,
      method: String,
      headers: Object, // String -> String
    }
    response: {
      status_code: Number,
      headers: Object,
      body: String,
    }
  */
  var request = {
    url: url.parse(request_url),
    method: 'GET',
    headers: {
      'accept-encoding': 'gzip,deflate',
      'user-agent': _.sample(useragents),
    },
  };
  // collapse down into the url value
  var options = _.extend(request.url, _.omit(request, 'url'));
  agent.request(options, function(err, response) {
    if (err) {
      if (_.contains(ignore_error_codes, err.code)) {
        logger.error('%s (%s): %s', err.name, err.code, err.message);
        // don't exit with error; just ignore malformed requests
        // TODO: really?
        err = null;
      }
    }
    callback(err, request, response);
  });
};

exports.requestAndInsertUrl = function(request_url, callback) {
  /**
  callback: function(Error | null)
  */
  get(request_url, function(err, request, response) {
    // any errors returned in the get() callback will be fatal
    if (err) return callback(err);

    var page = {
      request_url: request.url,
      request_method: request.method,
      request_headers: request.headers,
    };
    if (response) {
      _.extend(page, {
        response_status_code: response.status_code, // a Number
        response_headers: response.headers, // an Object[String -> String]
        response_body: response.body, // a String
      });

      // apparently there are some cases where the response headers do not include location
      if (response.status_code >= 300 && response.status_code <= 303 && response.headers.location) {
        // add redirect to queue
        var redirect_url = url.resolve(request_url, response.headers.location);
        logger.info('adding redirect url: "%s"', redirect_url);

        var redis_client = redis.createClient();
        // put it at the top of the queue
        redis_client.lpush(ns('urls', 'queue'), redirect_url);
        redis_client.quit();
      }
    }
    else {
      // if the response is missing, for whatever reason, that's a
      // non-fatal error (like a timeout, or bad error)
      page.failed = new Date();
    }

    // persist even non-fatal failures
    db.Insert('pages')
    .set(page)
    .execute(function(err, page) {
      if (err) return callback(err);

      logger.info('added page to database');
      callback(err);
    });
  });
};
