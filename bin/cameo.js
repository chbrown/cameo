#!/usr/bin/env node
/*jslint node: true */
var logger = require('loge');
var commands = require('../commands');

var optimist = require('optimist')
  .usage([
    'Usage: cameo <command> [<args>]',
    '',
    'commands:',
    '  install                Create the database and execute the schema, if needed',
    '  work                   Start the redis queue worker in cluster mode',
    '  add [url] [-] [file]   Add urls from file, argument, or STDIN',
    '',
  ].join('\n'))
  .describe({
    help: 'print this help message',
    verbose: 'print extra output',
    version: 'print version',
  })
  .boolean(['help', 'verbose', 'version'])
  .alias({verbose: 'v'})
  .default({
    database: 'ruthless',
    user: process.env.USER,
  });

var argv = optimist.argv;
logger.level = argv.verbose ? 'debug' : 'info';

if (argv.help) {
  optimist.showHelp();
}
else if (argv.version) {
  console.log(require('../package').version);
}
else {
  argv = optimist.check(function(argv) {
    if (argv._.length < 1) {
      throw new Error('You must specify a command');
    }
  }).argv;

  var command = argv._[0];
  if (command == 'install') {
    logger.debug('running "install"');
    commands.install(function(err) {
      if (err) logger.error(err);
      process.exit(err ? 1 : 0);
    });
  }
  else if (command == 'work') {
    logger.debug('running "work"');
    commands.work(function(err) {
      if (err) logger.error(err);
      process.exit(err ? 1 : 0);
    });
  }
  else if (command == 'add') {
    logger.debug('running "add"');
    commands.add(argv._.slice(1), function(err) {
      if (err) logger.error(err);
      process.exit(err ? 1 : 0);
    });
  }
  else {
    console.error('Unrecognized command: %s', command);
    process.exit(1);
  }
}
