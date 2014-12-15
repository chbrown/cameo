/*jslint node: true */
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var path = require('path');
var logger = require('loge');

var db = require('../db');
var queue = require('../queue');

exports.install = function() {
  /** Create the database if it doesn't exist and run schema.sql on it.
  */
  var sql_filepath = path.join(__dirname, '..', 'schema.sql');
  db.initializeDatabase(sql_filepath, function(err) {
    if (err) throw err;
    logger.debug('initialized database with %s', sql_filepath);
  });
};

exports.work = function(argv) {
  /** work through the redis list called "cameo:v01:urls:queue"

  clusterQueueLoop will fork off multiple child processes, default to one per CPU.

  callback: function(Error | null)
  */
  queue.clusterQueueLoop(argv.forks);
};

exports.add = function(argv) {
  // default to reading from stdin, if nothing is specified
  var urls_or_filenames = argv._.slice(1);
  if (urls_or_filenames.length === 0) {
    urls_or_filenames = ['-'];
  }

  // sort arguments into links or files
  var groups = _.groupBy(urls_or_filenames, function(arg) {
    return arg.match(/^http/) ? 'urls' : 'files';
  });

  var urls = groups.urls || [];
  var files = groups.files || [];

  logger.debug('adding urls from command line arguments: %s', urls.join(', '));
  queue.addFromList(urls, function(err) {
    if (err) logger.error(err);

    logger.debug('adding urls from files: %s', files.join(', '));
    async.each(files, function(file, callback) {
      if (file == '-') {
        // stdin
        queue.addFromStream(process.stdin, callback);
      }
      else {
        queue.addFromStream(fs.createReadStream(file, {encoding: 'utf8'}), callback);
      }
    }, function(err) {
      if (err) throw err;
    });
  });
};
