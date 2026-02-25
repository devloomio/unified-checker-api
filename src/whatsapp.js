const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// ===================== MULTI SESSION MANAGER =====================

const sessions = new Map(); // sessionId -> { sock, status, qrBase64, name }
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const AUTH_BASE = path.join(DATA_DIR, 'sessions', 'wa');

if (!fs.existsSync(AUTH_BASE)) fs.mkdirSync(AUTH_BASE, { recursive: true });

/**
 * Buat / reconnect session WhatsApp
 */
async function createSession(sessionId, name = '') {
    if (sessions.has(sessionId) && sessions.get(sessionId).status === 'connected') {
        return { success: false, message: 'Session sudah terhubung' };
    }

    const authDir = path.join(AUTH_BASE, sessionId);
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const session = {
        sock: null,
        status: 'connecting',
        qrBase64: null,
        name: name || sessionId,
        checkedCount: 0,
        reconnectAttempts: 0,
    };
    sessions.set(sessionId, session);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WA Checker ' + sessionId, 'Chrome', '120.0'],
    });

    session.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            session.status = 'qr';
            session.qrBase64 = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            console.log(`[QR] Session "${session.name}" - QR code ready`);
        }

        if (connection === 'open') {
            session.status = 'connected';
            session.qrBase64 = null;
            session.reconnectAttempts = 0;
            console.log(`[OK] Session "${session.name}" terhubung!`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut;

            if (loggedOut) {
                session.status = 'logged_out';
                session.sock = null;
                session.qrBase64 = null;
                console.log(`[LOGOUT] Session "${session.name}" logout`);
            } else {
                session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
                const maxAttempts = 10;
                if (session.reconnectAttempts > maxAttempts) {
                    session.status = 'error';
                    console.error(`[ERROR] Session "${session.name}" gagal reconnect setelah ${maxAttempts} percobaan`);
                    return;
                }
                const delay = Math.min(3000 * Math.pow(2, session.reconnectAttempts - 1), 60000);
                session.status = 'reconnecting';
                console.log(`[RECONNECT] Session "${session.name}" reconnecting in ${delay / 1000}s (attempt ${session.reconnectAttempts}/${maxAttempts})...`);
                setTimeout(() => createSession(sessionId, session.name), delay);
            }
        }
    });

    return { success: true, message: 'Session dibuat, scan QR code' };
}

/**
 * Hapus session
 */
async function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        if (session.sock) {
            try { await session.sock.logout(); } catch (err) { console.warn(`[WA] Gagal logout session: ${err.message}`); }
            try { session.sock.end(); } catch (err) { console.warn(`[WA] Gagal end socket: ${err.message}`); }
        }
        sessions.delete(sessionId);
    }

    const authDir = path.join(AUTH_BASE, sessionId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }

    return { success: true, message: 'Session dihapus' };
}

/**
 * Ambil semua session dan statusnya
 */
function getAllSessions() {
    const list = [];
    for (const [id, s] of sessions) {
        list.push({
            id,
            name: s.name,
            status: s.status,
            hasQR: !!s.qrBase64,
            checkedCount: s.checkedCount,
        });
    }
    return list;
}

/**
 * Ambil QR code base64 untuk session tertentu
 */
function getSessionQR(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return session.qrBase64;
}

/**
 * Ambil session yang connected (untuk load balancing)
 */
function getConnectedSessions() {
    const connected = [];
    for (const [id, s] of sessions) {
        if (s.status === 'connected' && s.sock) {
            connected.push({ id, ...s });
        }
    }
    return connected;
}

/**
 * Bersihkan nomor telepon
 */
function cleanPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 8 || cleaned.length > 15) return null;
    return cleaned;
}

/**
 * Batch check nomor pakai satu session (kirim banyak sekaligus)
 * onWhatsApp() support multiple JID dalam 1 call = JAUH lebih cepat
 */
async function batchCheckWithSession(session, phones) {
    const validPhones = phones.filter(p => cleanPhone(p) !== null);
    if (validPhones.length === 0) return [];
    const jids = validPhones.map(p => cleanPhone(p) + '@s.whatsapp.net');
    const waResults = await session.sock.onWhatsApp(...jids);

    // Map hasil ke object { jid -> result }
    const resultMap = new Map();
    for (const r of waResults) {
        resultMap.set(r.jid.replace('@s.whatsapp.net', ''), r);
    }

    const results = [];
    for (const phone of phones) {
        const cleaned = cleanPhone(phone);
        const waResult = resultMap.get(cleaned);

        if (waResult && waResult.exists) {
            let profilePic = null;
            try {
                profilePic = await session.sock.profilePictureUrl(waResult.jid, 'image');
            } catch (err) {
                console.warn(`[WA] Gagal ambil foto profil ${waResult.jid}: ${err.message}`);
            }

            session.checkedCount++;
            results.push({ exists: true, jid: waResult.jid, number: cleaned, profilePic, status: 'success', sessionUsed: session.name });
        } else {
            session.checkedCount++;
            results.push({ exists: false, jid: null, number: cleaned, profilePic: null, status: 'success', sessionUsed: session.name });
        }
    }

    return results;
}

/**
 * Cek satu nomor (pakai session apapun yang connected)
 */
async function checkNumber(phone) {
    const connected = getConnectedSessions();
    if (connected.length === 0) {
        throw new Error('Tidak ada session WhatsApp yang terhubung');
    }

    const cleaned = cleanPhone(phone);
    if (!cleaned) throw new Error('Format nomor tidak valid');

    const session = connected.sort((a, b) => a.checkedCount - b.checkedCount)[0];
    const results = await batchCheckWithSession(session, [phone]);
    return results[0];
}

/**
 * Bulk check dengan load balancing + batch per session
 */
async function checkBulk(phones) {
    const results = [];
    await checkBulkStream(phones, (result) => results.push(result));
    return results;
}

/**
 * Bulk check dengan streaming — callback dipanggil setiap 1 nomor selesai dicek
 * @param {string[]} phones
 * @param {function} onResult - callback(result) dipanggil per nomor
 */
async function checkBulkStream(phones, onResult) {
    const connected = getConnectedSessions();
    if (connected.length === 0) {
        throw new Error('Tidak ada session WhatsApp yang terhubung');
    }

    const BATCH_SIZE = 200;
    const totalSessions = connected.length;

    // Bagi nomor ke tiap session secara merata
    const chunks = Array.from({ length: totalSessions }, () => []);
    phones.forEach((phone, index) => {
        chunks[index % totalSessions].push({ phone, originalIndex: index });
    });

    // Proses paralel: tiap session handle chunk-nya
    const promises = chunks.map(async (chunk, sessionIndex) => {
        if (chunk.length === 0) return;
        const session = connected[sessionIndex];

        for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
            const batch = chunk.slice(i, i + BATCH_SIZE);
            const batchPhones = batch.map(b => b.phone);

            try {
                const jids = batchPhones.map(p => cleanPhone(p) + '@s.whatsapp.net');
                const waResults = await session.sock.onWhatsApp(...jids);

                const resultMap = new Map();
                for (const r of waResults) {
                    resultMap.set(r.jid.replace('@s.whatsapp.net', ''), r);
                }

                // Kirim hasil satu per satu via callback
                for (const { phone, originalIndex } of batch) {
                    const cleaned = cleanPhone(phone);
                    if (!cleaned) {
                        onResult({ index: originalIndex, number: phone, exists: false, jid: null, profilePic: null, status: 'error', error: 'Format nomor tidak valid', sessionUsed: session.name });
                        continue;
                    }
                    const waResult = resultMap.get(cleaned);

                    let result;
                    if (waResult && waResult.exists) {
                        let profilePic = null;
                        try {
                            profilePic = await session.sock.profilePictureUrl(waResult.jid, 'image');
                        } catch (err) {
                            console.warn(`[WA] Gagal ambil foto profil ${waResult.jid}: ${err.message}`);
                        }
                        session.checkedCount++;
                        result = { index: originalIndex, exists: true, jid: waResult.jid, number: cleaned, profilePic, status: 'success', sessionUsed: session.name };
                    } else {
                        session.checkedCount++;
                        result = { index: originalIndex, exists: false, jid: null, number: cleaned, profilePic: null, status: 'success', sessionUsed: session.name };
                    }
                    onResult(result);
                }
            } catch (err) {
                batch.forEach(b => {
                    onResult({
                        index: b.originalIndex,
                        number: cleanPhone(b.phone) || b.phone,
                        exists: false, jid: null, profilePic: null,
                        status: 'error', error: err.message,
                        sessionUsed: session.name,
                    });
                });
            }
        }
    });

    await Promise.all(promises);
}

/**
 * Auto-load session yang sudah ada (dari folder sessions/)
 */
async function autoLoadSessions() {
    if (!fs.existsSync(AUTH_BASE)) return;

    const dirs = fs.readdirSync(AUTH_BASE).filter(d =>
        fs.statSync(path.join(AUTH_BASE, d)).isDirectory()
    );

    for (const dir of dirs) {
        console.log(`[AUTO] Loading session "${dir}"...`);
        await createSession(dir, dir);
    }
}

function getStatus() {
    const connected = getConnectedSessions();
    return {
        totalSessions: sessions.size,
        connectedSessions: connected.length,
        sessions: getAllSessions(),
    };
}

module.exports = {
    createSession,
    deleteSession,
    getAllSessions,
    getSessionQR,
    getConnectedSessions,
    checkNumber,
    checkBulk,
    checkBulkStream,
    getStatus,
    autoLoadSessions,
};
