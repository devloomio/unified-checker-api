const express = require('express');
const router = express.Router();
const {
    setApiCredentials, getApiCredentials,
    createSession, verifyCode, verifyPassword, deleteSession,
    getAllSessions, checkNumber, checkBulkStream, getStatus, autoLoadSessions,
} = require('../telegram');

// ==================== API CREDENTIALS ====================

// POST /credentials - Set API ID & Hash
router.post('/credentials', (req, res) => {
    const { apiId, apiHash } = req.body;
    if (!apiId || !apiHash) {
        return res.status(400).json({ success: false, message: 'apiId dan apiHash wajib diisi' });
    }
    setApiCredentials(apiId, apiHash);
    res.json({ success: true, message: 'API credentials disimpan' });
});

// GET /credentials - Check if credentials are set
router.get('/credentials', (req, res) => {
    const creds = getApiCredentials();
    res.json({ success: true, hasCredentials: !!(creds.apiId && creds.apiHash) });
});

// ==================== SESSION ROUTES ====================

// GET /status
router.get('/status', (req, res) => {
    res.json({ success: true, ...getStatus() });
});

// GET /sessions
router.get('/sessions', (req, res) => {
    res.json({ success: true, sessions: getAllSessions() });
});

// POST /session - Step 1: Create session + send code
router.post('/session', async (req, res) => {
    const { id, name, phone } = req.body;
    const sessionId = id || 'tg-' + Date.now();
    try {
        const result = await createSession(sessionId, name || sessionId, phone);
        res.json({ success: true, sessionId, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /session/:id/verify - Step 2: Verify OTP code
router.post('/session/:id/verify', async (req, res) => {
    const { code } = req.body;
    try {
        const result = await verifyCode(req.params.id, code);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /session/:id/password - Step 3: 2FA password
router.post('/session/:id/password', async (req, res) => {
    const { password } = req.body;
    try {
        const result = await verifyPassword(req.params.id, password);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// DELETE /session/:id
router.delete('/session/:id', async (req, res) => {
    try {
        const result = await deleteSession(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== CHECKER ROUTES ====================

// GET /check/:number - Basic check (exists, username, names, profilePic)
router.get('/check/:number', async (req, res) => {
    try {
        const result = await checkNumber(req.params.number);
        res.json({
            success: true,
            data: {
                exists: result.exists,
                number: result.number,
                username: result.username,
                firstName: result.firstName,
                lastName: result.lastName,
                profilePic: result.profilePic,
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /check/:number/last-seen
router.get('/check/:number/last-seen', async (req, res) => {
    try {
        const result = await checkNumber(req.params.number);
        if (!result.exists) {
            return res.json({ success: true, data: { exists: false, number: result.number, lastSeen: null, lastSeenLabel: 'Nomor tidak terdaftar' } });
        }
        res.json({
            success: true,
            data: {
                exists: true,
                number: result.number,
                firstName: result.firstName,
                lastSeen: result.lastSeen,
                lastSeenLabel: result.lastSeenLabel,
                lastSeenTime: result.lastSeenTime || null,
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /check/:number/deleted
router.get('/check/:number/deleted', async (req, res) => {
    try {
        const result = await checkNumber(req.params.number);
        if (!result.exists) {
            return res.json({ success: true, data: { exists: false, number: result.number, deleted: null, message: 'Nomor tidak terdaftar di Telegram' } });
        }
        res.json({
            success: true,
            data: {
                exists: true,
                number: result.number,
                deleted: result.deleted,
                firstName: result.firstName,
                message: result.deleted ? 'Akun sudah dihapus/frozen' : 'Akun aktif',
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /check/:number/full - Full check (all info)
router.get('/check/:number/full', async (req, res) => {
    try {
        const result = await checkNumber(req.params.number);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /check - Check single from body
router.post('/check', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ success: false, message: '"number" wajib' });
    try {
        const result = await checkNumber(number);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /check-bulk-stream - SSE streaming bulk check
router.post('/check-bulk-stream', async (req, res) => {
    const { numbers } = req.body;
    if (!numbers || !Array.isArray(numbers)) {
        return res.status(400).json({ success: false, message: '"numbers" harus array' });
    }
    if (numbers.length === 0) {
        return res.status(400).json({ success: false, message: 'Array numbers tidak boleh kosong' });
    }
    if (numbers.length > 5000) {
        return res.status(400).json({ success: false, message: 'Maksimal 5000 nomor per request' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

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
