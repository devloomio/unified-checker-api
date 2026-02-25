const { Router } = require('express');
const wa = require('../../whatsapp');
const tg = require('../../telegram');

const router = Router();

// ==================== WHATSAPP ====================

router.get('/wa', (req, res) => {
  res.json({ success: true, sessions: wa.getAllSessions(), ...wa.getStatus() });
});

router.post('/wa', async (req, res) => {
  const { id, name } = req.body;
  const sessionId = id || 'wa-' + Date.now();
  try {
    const result = await wa.createSession(sessionId, name || sessionId);
    res.json({ success: true, sessionId, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/wa/:id/qr', (req, res) => {
  const qr = wa.getSessionQR(req.params.id);
  if (!qr) {
    return res.json({ success: false, message: 'QR tidak tersedia' });
  }
  res.json({ success: true, qr });
});

router.delete('/wa/:id', async (req, res) => {
  try {
    const result = await wa.deleteSession(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== TELEGRAM ====================

router.get('/tg', (req, res) => {
  res.json({ success: true, sessions: tg.getAllSessions(), ...tg.getStatus() });
});

router.get('/tg/credentials', (req, res) => {
  const creds = tg.getApiCredentials();
  res.json({
    success: true,
    hasCredentials: !!(creds.apiId && creds.apiHash),
    apiId: creds.apiId || null,
  });
});

router.post('/tg/credentials', (req, res) => {
  const { apiId, apiHash } = req.body;
  if (!apiId || !apiHash) {
    return res.status(400).json({ success: false, message: 'apiId dan apiHash wajib diisi' });
  }
  tg.setApiCredentials(apiId, apiHash);
  res.json({ success: true, message: 'API credentials disimpan' });
});

router.post('/tg', async (req, res) => {
  const { id, name, phone } = req.body;
  const sessionId = id || 'tg-' + Date.now();
  try {
    const result = await tg.createSession(sessionId, name || sessionId, phone);
    res.json({ success: true, sessionId, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/tg/:id/verify', async (req, res) => {
  try {
    const result = await tg.verifyCode(req.params.id, req.body.code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/tg/:id/password', async (req, res) => {
  try {
    const result = await tg.verifyPassword(req.params.id, req.body.password);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/tg/:id', async (req, res) => {
  try {
    const result = await tg.deleteSession(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
