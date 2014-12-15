/*jslint node: true */
var sqlcmd = require('sqlcmd');

module.exports = new sqlcmd.Connection({
  host: '/tmp',
  database: 'cameo',
});
