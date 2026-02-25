/**
 * API Key Authentication Middleware
 *
 * - Reads API_KEY from process.env.API_KEY
 * - If API_KEY is not set, skips authentication (dev mode)
 * - Checks header X-API-Key or query param ?apikey=
 * - Returns 401 if the key does not match
 */

function authMiddleware(req, res, next) {
  const serverKey = process.env.API_KEY;

  // Dev mode — no API_KEY configured, allow all requests
  if (!serverKey) {
    return next();
  }

  // Accept key from header or query parameter
  const clientKey = req.headers['x-api-key'] || req.query.apikey;

  if (clientKey !== serverKey) {
    return res.status(401).json({
      success: false,
      message: 'API key tidak valid',
    });
  }

  next();
}

module.exports = authMiddleware;
