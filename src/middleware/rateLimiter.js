const windows = new Map();

function rateLimiter(req, res, next) {
  if (!req.apiKeyId) return next();

  const keyId = req.apiKeyId;
  const limit = req.apiKeyRateLimit || 60;
  const now = Date.now();
  const windowMs = 60 * 1000;

  let entry = windows.get(keyId);
  if (!entry || (now - entry.windowStart) > windowMs) {
    entry = { count: 0, windowStart: now };
    windows.set(keyId, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
      limit,
      retryAfterMs: windowMs - (now - entry.windowStart),
    });
  }

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - entry.count));

  next();
}

module.exports = rateLimiter;
