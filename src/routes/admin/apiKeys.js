const { Router } = require('express');
const db = require('../../db');
const { generateApiKey, hashApiKey, getKeyPrefix } = require('../../utils/crypto');

const router = Router();

// GET / - List all API keys
router.get('/', (req, res) => {
  const keys = db.prepare(`
    SELECT id, name, key_prefix, rate_limit, is_active, total_requests, last_used_at, created_at
    FROM api_keys ORDER BY created_at DESC
  `).all();

  res.json({ success: true, data: keys });
});

// POST / - Create new API key
router.post('/', (req, res) => {
  const { name, rate_limit = 60 } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
  }
  if (typeof rate_limit !== 'number' || rate_limit < 1 || rate_limit > 10000) {
    return res.status(400).json({ success: false, message: 'rate_limit harus angka antara 1-10000' });
  }

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  db.prepare(`
    INSERT INTO api_keys (name, key_hash, key_prefix, rate_limit)
    VALUES (?, ?, ?, ?)
  `).run(name, keyHash, keyPrefix, rate_limit);

  const created = db.prepare('SELECT id, name, key_prefix, rate_limit, is_active, created_at FROM api_keys WHERE key_hash = ?').get(keyHash);

  res.json({
    success: true,
    message: 'API key berhasil dibuat. Simpan key ini, tidak bisa dilihat lagi!',
    key: rawKey,
    data: created,
  });
});

// GET /:id - Get single key details
router.get('/:id', (req, res) => {
  const key = db.prepare(`
    SELECT id, name, key_prefix, rate_limit, is_active, total_requests, last_used_at, created_at
    FROM api_keys WHERE id = ?
  `).get(req.params.id);

  if (!key) {
    return res.status(404).json({ success: false, message: 'API key tidak ditemukan' });
  }

  res.json({ success: true, data: key });
});

// PUT /:id - Update key
router.put('/:id', (req, res) => {
  const { name, rate_limit, is_active } = req.body;

  const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
  if (!key) {
    return res.status(404).json({ success: false, message: 'API key tidak ditemukan' });
  }

  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (rate_limit !== undefined) {
    if (typeof rate_limit !== 'number' || rate_limit < 1 || rate_limit > 10000) {
      return res.status(400).json({ success: false, message: 'rate_limit harus angka antara 1-10000' });
    }
    updates.push('rate_limit = ?'); values.push(rate_limit);
  }
  if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
  }

  values.push(req.params.id);
  db.prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT id, name, key_prefix, rate_limit, is_active, total_requests, last_used_at, created_at
    FROM api_keys WHERE id = ?
  `).get(req.params.id);

  res.json({ success: true, data: updated });
});

// DELETE /:id - Delete key
router.delete('/:id', (req, res) => {
  const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
  if (!key) {
    return res.status(404).json({ success: false, message: 'API key tidak ditemukan' });
  }

  db.prepare('DELETE FROM api_usage_log WHERE api_key_id = ?').run(req.params.id);
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);

  res.json({ success: true, message: 'API key dihapus' });
});

// GET /:id/usage - Get usage history
router.get('/:id/usage', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const logs = db.prepare(`
    SELECT endpoint, method, status_code, response_time_ms, created_at
    FROM api_usage_log WHERE api_key_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM api_usage_log WHERE api_key_id = ?').get(req.params.id);

  res.json({ success: true, data: logs, total: total.count });
});

module.exports = router;
