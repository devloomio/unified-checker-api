/**
 * CORS Configuration Middleware
 *
 * - Reads CORS_ORIGINS from process.env.CORS_ORIGINS
 * - If CORS_ORIGINS is "*" or not set, allows all origins
 * - Otherwise splits by comma and whitelists those domains
 * - Allows headers: Content-Type, X-API-Key
 * - Allows methods: GET, POST, DELETE, OPTIONS
 */

const cors = require('cors');

function buildCorsMiddleware() {
  const envOrigins = process.env.CORS_ORIGINS;

  let origin;

  if (!envOrigins || envOrigins === '*') {
    // Allow all origins
    origin = '*';
  } else {
    // Whitelist specific domains
    const whitelist = envOrigins.split(',').map((o) => o.trim());
    origin = function (requestOrigin, callback) {
      // Allow requests with no origin (e.g. curl, server-to-server)
      if (!requestOrigin || whitelist.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    };
  }

  return cors({
    origin,
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });
}

module.exports = buildCorsMiddleware();
