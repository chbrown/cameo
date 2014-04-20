/*jslint node: true */
exports.ns = function(/* parts... */) {
  // quick namespace prefixer for redis keys
  return Array.prototype.concat.apply(['cameo', 'v01'], arguments).join(':');
};
