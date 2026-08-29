'use strict';

const { parseOptions } = require('../lib/argvParser');

// Registered as: router.get('/config', handleConfigRequest)
//
// req.query.opts is attacker-controlled: an arbitrary comma-separated
// string taken directly from the request's query string, split into an
// argv-style array and handed to parseOptions() -- which forwards it to
// minimist() without any filtering.
function handleConfigRequest(req, res) {
  const rawOpts = String(req.query.opts || '').split(',').filter(Boolean);
  const options = parseOptions(rawOpts);
  res.json({ options });
}

module.exports = { handleConfigRequest };
