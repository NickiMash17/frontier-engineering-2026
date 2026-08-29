'use strict';

const _ = require('lodash');

const DEFAULT_PREFERENCES = { theme: 'light', notifications: true };
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Strips any key (at any depth) named __proto__ / constructor / prototype
// from attacker-controlled input before it is ever merged. This is the
// upstream gate that blocks the CVE-2019-10744 exploit precondition.
function sanitize(input) {
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  if (input && typeof input === 'object') {
    const clean = {};
    for (const key of Object.keys(input)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      clean[key] = sanitize(input[key]);
    }
    return clean;
  }
  return input;
}

// Registered as: router.post('/preferences', handlePreferencesRequest)
//
// req.body.preferences is attacker-controlled JSON from the HTTP request
// body. It IS reached by _.defaultsDeep(), but only after sanitize() has
// already stripped any key the prototype-pollution payload depends on.
function handlePreferencesRequest(req, res) {
  const safePreferences = sanitize(req.body.preferences);
  const merged = _.defaultsDeep({}, safePreferences, DEFAULT_PREFERENCES);
  res.json({ preferences: merged });
}

module.exports = { handlePreferencesRequest, sanitize };
