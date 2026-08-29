'use strict';

const minimist = require('minimist');

// Thin wrapper around minimist, shared by multiple route handlers that need
// to parse argv-style option arrays into a structured object.
function parseOptions(argvStyleArray) {
  return minimist(argvStyleArray);
}

module.exports = { parseOptions };
