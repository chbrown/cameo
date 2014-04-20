/*jslint node: true */
var os = require('os');
var redis = require('redis');
var logger = require('loge');
var streaming = require('streaming');

var browser = require('./browser');
var ns = require('./version').ns;

exports.addFromList = function(urls, callback) {
  if (urls.length === 0) {
    logger.debug('ignoring empty input list');
    return callback();
  }

  var client = redis.createClient();
  client.lpush(ns('urls', 'queue'), urls, function(err) {
    client.quit();
    logger.debug('added %d urls from input list', urls.length);
    callback(err);
  });
};

exports.addFromStream = function(stream, callback) {
  var client = redis.createClient();
  var n = 0;

  stream.pipe(new streaming.Splitter())
  .on('error', function(err) {
    client.quit();
    callback(err);
  })
  .on('data', function(url) {
    logger.info('adding url from input: "%s"', url);
    // put new things at the top of the queue
    client.lpush(ns('urls', 'queue'), url);
    n++;
  })
  .on('end', function() {
    // wait for all those pushes to go through
    client.on('end', function() {
      logger.debug('added %d urls from input stream', n);
      callback();
    }).quit();
  });
};

var queueLoop = function(callback) {
  logger.info('Beginning queue->tried loop at %s', new Date().toISOString());
  var redis_client = redis.createClient();
  var fail = function(err) {
    // just a little wrapper around callback to shut down the redis client
    redis_client.quit();
    callback(err);
  };
  (function loop() {
    redis_client.brpoplpush(ns('urls', 'queue'), ns('urls', 'tried'), 0, function(err, url) {
      if (err) return fail(err);
      browser.requestAndInsertUrl(url, function(err) {
        if (err) return fail(err);
        setImmediate(loop);
      });
    });
  })();
};

// var clusterQueueLoop =
exports.clusterQueueLoop = function(forks) {
  var cluster = require('cluster');
  if (cluster.isMaster) {
    logger.info('Starting cluster with %d forks', forks);
    // set up listeners
    cluster.on('exit', function(worker, code, signal) {
      logger.warn('cluster: worker exit %d (pid: %d)', worker.id, worker.process.pid, code, signal);
      cluster.fork();
    });
    cluster.on('fork', function(worker) {
      logger.info('cluster: worker fork %d (pid: %d)', worker.id, worker.process.pid);
    });

    // fork workers
    for (var i = 0; i < forks; i++) {
      cluster.fork();
    }
  }
  else {
    queueLoop(function(err) {
      // optimally, the queue loop will never exit.
      logger.error('queueLoop raised error', err);
      process.exit(1);
    });
  }
};
