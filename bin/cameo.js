#!/usr/bin/env node
/*jslint node: true */
var logger = require('loge');
var os = require('os');
var commands = require('./cameo-commands');

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
    forks: 'number of subprocess to fork for parallel tasks',
    help: 'print this help message',
    verbose: 'print extra output',
    version: 'print version',
  })
  .boolean(['help', 'verbose', 'version'])
  .alias({verbose: 'v'})
  .default({
    forks: os.cpus().length,
    // user: process.env.USER,
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
  var commands = require('./cameo-commands');
  argv = optimist.check(function(argv) {
    if (argv._.length < 1) {
      throw new Error('You must specify a command');
    }
    if (commands[argv._[0]] === undefined) {
      throw new Error('Unrecognized command: ' + argv._[0]);
    }
  }).argv;

  commands[argv._[0]](argv);
}
