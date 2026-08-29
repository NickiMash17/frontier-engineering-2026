#!/usr/bin/env node
'use strict';

// Internal build tooling only. Invoked manually by a developer on their own
// machine, e.g. `node scripts/build.js --minify` -- never imported by, or
// reachable from, the running server in src/server.js. No HTTP request
// path leads here.
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
console.log('build options:', argv);
