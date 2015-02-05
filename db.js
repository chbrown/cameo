/*jslint node: true */
var sqlcmd = require('sqlcmd-pg');

module.exports = new sqlcmd.Connection({
  host: '127.0.0.1',
  port: '5432',
  user: 'postgres',
  database: 'cameo',
});
