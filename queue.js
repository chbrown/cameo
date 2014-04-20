/*jslint node: true */
var os = require('os');
var redis = require('redis');
var logger = require('loge');
var browser = require('./browser');


var ns = exports.ns = function(/* parts... */) {
  // quick namespace prefixer for redis keys
  return Array.prototype.concat.apply(['cameo', 'v01'], arguments).join(':');
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

var startCluster = exports.startCluster = function() {
  var cluster = require('cluster');
  if (cluster.isMaster) {
    var ncpus = os.cpus().length;
    logger.info('Starting cluster with %d forks', ncpus);
    // set up listeners
    cluster.on('exit', function(worker, code, signal) {
      logger.warn('cluster: worker exit', worker.id, worker.process.pid, code, signal);
      cluster.fork();
    });
    cluster.on('fork', function(worker) {
      logger.info('cluster: worker fork', worker.id, worker.process.pid);
    });

    // fork workers
    for (var i = 0; i < ncpus; i++) {
      cluster.fork();
    }
  }
  else {
    queueLoop(function(err) {
      // normally, the queue loop will never exit.
      logger.error('queueLoop raised error', err);
      process.exit(1);
    });
  }
};
