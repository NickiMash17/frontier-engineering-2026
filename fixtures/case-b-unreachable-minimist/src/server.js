'use strict';

// This service performs no CLI-argument parsing at runtime. It exposes a
// single health-check endpoint and nothing else touches minimist.

// Registered as: router.get('/health', handleHealthRequest)
function handleHealthRequest(req, res) {
  res.json({ status: 'ok' });
}

module.exports = { handleHealthRequest };
