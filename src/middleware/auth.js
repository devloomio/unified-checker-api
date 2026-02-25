/**
 * API Key Authentication Middleware
 *
 * - Supports multiple API keys from SQLite database
 * - Falls back to process.env.API_KEY for backward compatibility
 * - If no keys exist (DB + env), skips auth (dev mode)
 * - Checks header X-API-Key or query param ?apikey=
 * - Attaches req.apiKeyId, req.apiKeyRateLimit for downstream middleware
 */

const crypto = require('crypto');
const db = require('../db');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function authMiddleware(req, res, next) {
  // Skip auth for admin routes (handled by adminAuth middleware)
  if (req.path.startsWith('/admin') || req.path === '/admin') return next();

  const envKey = process.env.API_KEY;
  const keyCount = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1').get();

  // Dev mode — no keys configured anywhere, allow all
  if (!envKey && keyCount.count === 0) {
    return next();
  }

  const clientKey = req.headers['x-api-key'] || req.query.apikey;

  if (!clientKey) {
    return res.status(401).json({
      success: false,
      message: 'API key diperlukan',
    });
  }

  // Check env key first (backward compatibility)
  if (envKey && clientKey === envKey) {
    req.apiKeyId = null;
    return next();
  }

  // Check database keys
  const hash = hashKey(clientKey);
  const row = db.prepare('SELECT id, name, rate_limit, is_active FROM api_keys WHERE key_hash = ?').get(hash);

  if (!row || !row.is_active) {
    return res.status(401).json({
      success: false,
      message: 'API key tidak valid',
    });
  }

  req.apiKeyId = row.id;
  req.apiKeyName = row.name;
  req.apiKeyRateLimit = row.rate_limit;

  // Update last_used_at
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);

  next();
}

module.exports = authMiddleware;
