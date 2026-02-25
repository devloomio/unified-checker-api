const db = require('../db');

function usageTracker(req, res, next) {
  if (!req.apiKeyId) return next();

  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    try {
      db.prepare(`
        INSERT INTO api_usage_log (api_key_id, endpoint, method, status_code, response_time_ms)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.apiKeyId, req.path, req.method, res.statusCode, responseTime);

      db.prepare('UPDATE api_keys SET total_requests = total_requests + 1 WHERE id = ?').run(req.apiKeyId);
    } catch (_) {}
  });

  next();
}

module.exports = usageTracker;
