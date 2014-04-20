/*jslint node: true */
var logger = require('loge');
var sqlcmd = require('sqlcmd');

var connection = module.exports = new sqlcmd.Connection({host: '/tmp', database: 'cameo'});
// connection.logger = logger;
