const { Router } = require('express');
const db = require('../../db');

const router = Router();

// GET / - Get all settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  // Add runtime info
  settings._runtime = {
    port: process.env.PORT || 3000,
    corsOrigins: process.env.CORS_ORIGINS || '*',
    hasEnvApiKey: !!process.env.API_KEY,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
  };

  res.json({ success: true, data: settings });
});

// PUT / - Update settings
router.put('/', (req, res) => {
  const entries = req.body;
  if (!entries || typeof entries !== 'object') {
    return res.status(400).json({ success: false, message: 'Body harus object key-value' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const transaction = db.transaction((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (key.startsWith('_')) continue; // skip runtime fields
      upsert.run(key, String(value));
    }
  });

  transaction(entries);

  res.json({ success: true, message: 'Settings disimpan' });
});

// POST /cleanup - Clean old usage logs
router.post('/cleanup', (req, res) => {
  const days = parseInt(req.body.days) || 30;
  const result = db.prepare(`
    DELETE FROM api_usage_log WHERE created_at < date('now', '-' || ? || ' days')
  `).run(days);

  res.json({ success: true, message: `${result.changes} log dihapus (older than ${days} days)` });
});

module.exports = router;
