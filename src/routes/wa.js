const { Router } = require('express');
const {
    createSession, deleteSession, getAllSessions, getSessionQR,
    checkNumber, checkBulk, checkBulkStream, getStatus, autoLoadSessions,
} = require('../whatsapp');

const router = Router();

// ==================== SESSION ROUTES ====================

// GET /status
router.get('/status', (req, res) => {
    res.json({ success: true, ...getStatus() });
});

// GET /sessions - List semua session
router.get('/sessions', (req, res) => {
    res.json({ success: true, sessions: getAllSessions() });
});

// POST /session - Tambah session baru
router.post('/session', async (req, res) => {
    const { id, name } = req.body;
    const sessionId = id || 'wa-' + Date.now();
    try {
        const result = await createSession(sessionId, name || sessionId);
        res.json({ success: true, sessionId, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /session/:id/qr - Ambil QR code
router.get('/session/:id/qr', (req, res) => {
    const qr = getSessionQR(req.params.id);
    if (!qr) {
        return res.json({ success: false, message: 'QR tidak tersedia' });
    }
    res.json({ success: true, qr });
});

// DELETE /session/:id - Hapus session
router.delete('/session/:id', async (req, res) => {
    try {
        const result = await deleteSession(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== CHECKER ROUTES ====================

// GET /check/:number
router.get('/check/:number', async (req, res) => {
    try {
        const result = await checkNumber(req.params.number);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /check
router.post('/check', async (req, res) => {
    const { number } = req.body;
    if (!number) {
        return res.status(400).json({ success: false, message: '"number" wajib diisi' });
    }
    try {
        const result = await checkNumber(number);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /check-bulk
router.post('/check-bulk', async (req, res) => {
    const { numbers } = req.body;
    if (!numbers || !Array.isArray(numbers)) {
        return res.status(400).json({ success: false, message: '"numbers" harus array' });
    }

    try {
        const results = await checkBulk(numbers);
        const registered = results.filter(r => r.exists).length;

        res.json({
            success: true,
            summary: {
                total: numbers.length,
                registered,
                not_registered: numbers.length - registered,
                sessions_used: [...new Set(results.map(r => r.sessionUsed))].length,
            },
            data: results,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /check-bulk-stream - Bulk check dengan SSE (real-time per nomor)
router.post('/check-bulk-stream', async (req, res) => {
    const { numbers } = req.body;
    if (!numbers || !Array.isArray(numbers)) {
        return res.status(400).json({ success: false, message: '"numbers" harus array' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Kirim total dulu
    res.write(`data: ${JSON.stringify({ type: 'start', total: numbers.length })}\n\n`);

    let checked = 0;
    let registered = 0;

    try {
        await checkBulkStream(numbers, (result) => {
            checked++;
            if (result.exists) registered++;
            res.write(`data: ${JSON.stringify({ type: 'result', checked, ...result })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ type: 'done', total: numbers.length, registered, not_registered: numbers.length - registered })}\n\n`);
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }

    res.end();
});

module.exports = router;
