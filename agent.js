/*jslint node: true */
var http = require('http');
var https = require('https');
var url = require('url');
var stream = require('stream');
var streaming = require('streaming');
var zlib = require('zlib');

var useragents = require('./useragents');

var streamDecoder = function(encoding) {
  if (encoding == 'gzip') {
    return zlib.createGunzip();
  }
  else if (encoding == 'deflate') {
    return zlib.createInflate();
  }
  else {
    return stream.PassThrough();
  }
};

// kind of like mikeal's whole request package, but simpler and more transparent
var request = exports.request = function(options, callback) {
  /** Wrapper around http/https to adapt protocol and automatically decode output.

  Options should be a url-parsed object, though it can also have request fields
  like "headers", "agent", etc. -- it's sent directly to http.request(options, ...)

  Options:

  host: A domain name or IP address of the server to issue the request to. Defaults to 'localhost'.
  hostname: To support url.parse() hostname is preferred over host
  port: Port of remote server. Defaults to 80.
  localAddress: Local interface to bind for network connections.
  socketPath: Unix Domain Socket (use one of host:port or socketPath)
  method: A string specifying the HTTP request method. Defaults to 'GET'.
  path: Request path. Defaults to '/'. Should include query string if any. E.G. '/index.html?page=12'
  headers: An object containing request headers.
  auth: Basic authentication i.e. 'user:password' to compute an Authorization header.
  agent: Controls Agent behavior. When an Agent is used request will default to Connection: keep-alive. Possible values:
      undefined (default): use global Agent for this host and port.
      Agent object: explicitly use the passed in Agent.
      false: opts out of connection pooling with an Agent, defaults request to Connection: close.

  Warning: this supports https, but doesn't do any ssl checking, afaik.
  */
  var req = (options.protocol == 'https:' ? https : http).request(options)
  .on('timeout', function() {
    // console.log('timeout', arguments);
    callback(new Error('Timeout Error'));
  })
  .on('response', function(res) {
    // console.log('response', res);
    var encoding = res.headers['content-encoding'];
    streaming.readToEnd(res.pipe(streamDecoder(encoding)), function(err, chunks) {
      if (err) return callback(err);

      callback(null, {
        statusCode: res.statusCode, // a Number
        headers: res.headers, // an Object[String -> String]
        body: chunks.join(''),
      });
    });
  });
  req.setTimeout(5000);
  req.end();
  return req;
};
