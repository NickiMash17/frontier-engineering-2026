'use strict';

const minimist = require('minimist');

// Registered as: router.post('/parse-args', handleParseArgsRequest)
//
// req.body.args is attacker-controlled: an arbitrary JSON array taken
// directly from the untrusted HTTP request body, passed straight into
// minimist() with no filtering.
function handleParseArgsRequest(req, res) {
  const rawArgs = req.body.args; // e.g. ["--foo", "bar", "--__proto__.polluted", "yes"]
  const parsed = minimist(rawArgs);
  res.json({ parsed });
}

module.exports = { handleParseArgsRequest };
