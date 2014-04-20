/*jslint node: true */
var logger = require('loge');
var sqlcmd = require('sqlcmd');

var connection = module.exports = new sqlcmd.Connection({host: '/tmp', database: 'cameo'});
// connection.logger = logger;

connection.install = function(callback) {
  /** Create the database if it doesn't exist and run schema.sql on it.
  callback: function(Error | null)
  */
  var path = require('path');
  var schema_filepath = path.join(__dirname, 'schema.sql');
  connection.databaseExists(function(err, exists) {
    if (err) return callback(err);
    if (!exists) {
      connection.createDatabase(function(err) {
        if (err) return callback(err);
        connection.executeSQLFile(schema_filepath, callback);
      });
    }
    else {
      callback();
    }
  });
};
