const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { computeCheck } = require('telegram/Password');
const path = require('path');
const fs = require('fs');

// ===================== MULTI SESSION MANAGER =====================

const sessions = new Map(); // sessionId -> { client, status, name, phoneCodeHash, phone, checkedCount }
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const SESSION_DIR = path.join(DATA_DIR, 'sessions', 'tg');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Telegram API credentials — user harus set ini dari https://my.telegram.org
let API_ID = parseInt(process.env.TG_API_ID) || 0;
let API_HASH = process.env.TG_API_HASH || '';

function setApiCredentials(apiId, apiHash) {
    API_ID = parseInt(apiId);
    API_HASH = apiHash;
}

function getApiCredentials() {
    return { apiId: API_ID, apiHash: API_HASH };
}

/**
 * Buat session baru — step 1: kirim kode ke nomor HP
 */
async function createSession(sessionId, name, phone) {
    if (!API_ID || !API_HASH) {
        throw new Error('API_ID dan API_HASH belum di-set. Dapatkan di https://my.telegram.org');
    }

    // Load existing string session jika ada
    const sessionFile = path.join(SESSION_DIR, sessionId + '.txt');
    let savedSession = '';
    if (fs.existsSync(sessionFile)) {
        savedSession = fs.readFileSync(sessionFile, 'utf-8').trim();
    }

    const stringSession = new StringSession(savedSession);
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
    });

    const session = {
        client,
        status: 'connecting',
        name: name || sessionId,
        phone: phone || '',
        phoneCodeHash: null,
        checkedCount: 0,
    };
    sessions.set(sessionId, session);

    await client.connect();

    // Kalau sudah authorized (session lama), langsung connected
    if (await client.isUserAuthorized()) {
        session.status = 'connected';
        // Save session string
        const ss = client.session.save();
        fs.writeFileSync(sessionFile, ss);
        console.log(`[OK] Session "${name}" terhubung (existing)`);
        return { success: true, status: 'connected', message: 'Session terhubung' };
    }

    // Kalau belum, kirim kode OTP
    if (!phone) {
        session.status = 'need_phone';
        return { success: true, status: 'need_phone', message: 'Masukkan nomor telepon' };
    }

    try {
        const result = await session.client.invoke(
            new Api.auth.SendCode({
                phoneNumber: phone,
                apiId: API_ID,
                apiHash: API_HASH,
                settings: new Api.CodeSettings({}),
            })
        );
        session.phoneCodeHash = result.phoneCodeHash;
        session.phone = phone;
        session.status = 'need_code';
        console.log(`[CODE] Session "${name}" — kode dikirim ke ${phone}`);
        return { success: true, status: 'need_code', message: 'Kode OTP dikirim ke Telegram' };
    } catch (err) {
        session.status = 'error';
        throw new Error('Gagal kirim kode: ' + err.message);
    }
}

/**
 * Verifikasi kode OTP — step 2
 */
async function verifyCode(sessionId, code) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session tidak ditemukan');
    if (!session.phoneCodeHash) throw new Error('Kirim kode dulu');

    try {
        await session.client.invoke(
            new Api.auth.SignIn({
                phoneNumber: session.phone,
                phoneCodeHash: session.phoneCodeHash,
                phoneCode: code,
            })
        );

        session.status = 'connected';
        session.phoneCodeHash = null;

        // Save session
        const sessionFile = path.join(SESSION_DIR, sessionId + '.txt');
        const ss = session.client.session.save();
        fs.writeFileSync(sessionFile, ss);

        console.log(`[OK] Session "${session.name}" terhubung!`);
        return { success: true, status: 'connected', message: 'Berhasil login!' };
    } catch (err) {
        if (err.message.includes('SESSION_PASSWORD_NEEDED')) {
            session.status = 'need_password';
            return { success: true, status: 'need_password', message: 'Akun pakai 2FA, masukkan password' };
        }
        throw new Error('Kode salah: ' + err.message);
    }
}

/**
 * Verifikasi 2FA password — step 3 (opsional)
 */
async function verifyPassword(sessionId, password) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session tidak ditemukan');

    try {
        const srpResult = await session.client.invoke(new Api.account.GetPassword());
        const passwordSrp = await computeCheck(srpResult, password);
        const result = await session.client.invoke(
            new Api.auth.CheckPassword({
                password: passwordSrp,
            })
        );

        session.status = 'connected';

        const sessionFile = path.join(SESSION_DIR, sessionId + '.txt');
        const ss = session.client.session.save();
        fs.writeFileSync(sessionFile, ss);

        console.log(`[OK] Session "${session.name}" terhubung (2FA)!`);
        return { success: true, status: 'connected', message: 'Berhasil login dengan 2FA!' };
    } catch (err) {
        throw new Error('Password salah: ' + err.message);
    }
}

/**
 * Hapus session
 */
async function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session && session.client) {
        try { await session.client.disconnect(); } catch (err) { console.warn(`[TG] Gagal disconnect session: ${err.message}`); }
    }
    sessions.delete(sessionId);

    const sessionFile = path.join(SESSION_DIR, sessionId + '.txt');
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);

    return { success: true, message: 'Session dihapus' };
}

/**
 * Get all sessions
 */
function getAllSessions() {
    const list = [];
    for (const [id, s] of sessions) {
        list.push({
            id,
            name: s.name,
            status: s.status,
            phone: s.phone ? s.phone.slice(0, 4) + '****' : '',
            checkedCount: s.checkedCount,
        });
    }
    return list;
}

/**
 * Get connected sessions
 */
function getConnectedSessions() {
    const connected = [];
    for (const [id, s] of sessions) {
        if (s.status === 'connected' && s.client) {
            connected.push({ id, ...s });
        }
    }
    return connected;
}

/**
 * Estimasi tanggal registrasi dari Telegram user ID
 * ID Telegram itu sequential, jadi bisa diperkirakan kapan akun dibuat
 */
function estimateRegistrationDate(userId) {
    if (!userId) return null;
    const id = typeof userId === 'string' ? parseInt(userId) : Number(userId);
    if (!id || id <= 0) return null;

    // Data point dari @idbot / @creationdatebot (verified)
    const dataPoints = [
        { id: 1000000, date: new Date('2013-08-01') },
        { id: 10000000, date: new Date('2013-11-01') },
        { id: 50000000, date: new Date('2014-07-01') },
        { id: 100000000, date: new Date('2015-02-01') },
        { id: 150000000, date: new Date('2015-10-01') },
        { id: 200000000, date: new Date('2016-03-01') },
        { id: 300000000, date: new Date('2016-10-01') },
        { id: 400000000, date: new Date('2017-04-01') },
        { id: 500000000, date: new Date('2017-10-01') },
        { id: 600000000, date: new Date('2018-01-01') },
        { id: 700000000, date: new Date('2018-05-01') },
        { id: 800000000, date: new Date('2018-09-01') },
        { id: 900000000, date: new Date('2019-02-01') },
        { id: 1000000000, date: new Date('2019-06-01') },
        { id: 1100000000, date: new Date('2019-11-01') },
        { id: 1200000000, date: new Date('2020-03-01') },
        { id: 1300000000, date: new Date('2020-06-01') },
        { id: 1400000000, date: new Date('2020-08-01') },
        { id: 1500000000, date: new Date('2020-10-01') },
        { id: 1600000000, date: new Date('2020-12-01') },
        { id: 1700000000, date: new Date('2021-01-15') },
        { id: 1800000000, date: new Date('2021-03-01') },
        { id: 1900000000, date: new Date('2021-04-15') },
        { id: 2000000000, date: new Date('2021-06-01') },
        { id: 2100000000, date: new Date('2021-10-01') },
        { id: 2200000000, date: new Date('2022-01-01') },
        { id: 5000000000, date: new Date('2022-02-01') },
        { id: 5200000000, date: new Date('2022-04-01') },
        { id: 5400000000, date: new Date('2022-08-01') },
        { id: 5600000000, date: new Date('2023-01-01') },
        { id: 5800000000, date: new Date('2023-04-01') },
        { id: 6000000000, date: new Date('2023-07-01') },
        { id: 6200000000, date: new Date('2023-10-01') },
        { id: 6500000000, date: new Date('2024-01-01') },
        { id: 6800000000, date: new Date('2024-04-01') },
        { id: 7000000000, date: new Date('2024-06-01') },
        { id: 7200000000, date: new Date('2024-09-01') },
        { id: 7500000000, date: new Date('2024-12-01') },
        { id: 7800000000, date: new Date('2025-03-01') },
        { id: 8000000000, date: new Date('2025-06-01') },
    ];

    // Cari range yang cocok
    if (id < dataPoints[0].id) return '~2013';

    for (let i = 0; i < dataPoints.length - 1; i++) {
        if (id >= dataPoints[i].id && id < dataPoints[i + 1].id) {
            const ratio = (id - dataPoints[i].id) / (dataPoints[i + 1].id - dataPoints[i].id);
            const timeDiff = dataPoints[i + 1].date - dataPoints[i].date;
            const estimated = new Date(dataPoints[i].date.getTime() + ratio * timeDiff);
            return estimated.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        }
    }

    // ID lebih besar dari data terakhir
    return '~2025';
}

/**
 * Parse last seen dari user status Telegram
 */
function parseLastSeen(user) {
    if (!user) return { lastSeen: 'unknown', lastSeenLabel: 'Tidak diketahui' };
    if (!user.status) return { lastSeen: 'long_time_ago', lastSeenLabel: 'Sudah lama tidak aktif' };

    const statusClass = user.status.className;

    if (statusClass === 'UserStatusOnline') {
        return { lastSeen: 'online', lastSeenLabel: 'Online sekarang' };
    }
    if (statusClass === 'UserStatusOffline' && user.status.wasOnline) {
        const wasOnline = new Date(user.status.wasOnline * 1000);
        const now = new Date();
        const diffMs = now - wasOnline;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        let label;
        if (diffMin < 1) label = 'Baru saja';
        else if (diffMin < 60) label = `${diffMin} menit lalu`;
        else if (diffHour < 24) label = `${diffHour} jam lalu`;
        else if (diffDay < 7) label = `${diffDay} hari lalu`;
        else label = wasOnline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        return {
            lastSeen: 'offline',
            lastSeenLabel: label,
            lastSeenTime: wasOnline.toISOString(),
        };
    }
    if (statusClass === 'UserStatusRecently') {
        return { lastSeen: 'recently', lastSeenLabel: 'Baru-baru ini' };
    }
    if (statusClass === 'UserStatusLastWeek') {
        return { lastSeen: 'last_week', lastSeenLabel: 'Minggu lalu' };
    }
    if (statusClass === 'UserStatusLastMonth') {
        return { lastSeen: 'last_month', lastSeenLabel: 'Bulan lalu' };
    }

    // Fallback: cek langsung dari property
    if (user.status.wasOnline === 0 || statusClass === 'UserStatusEmpty') {
        return { lastSeen: 'long_time_ago', lastSeenLabel: 'Sudah lama tidak aktif' };
    }

    return { lastSeen: 'unknown', lastSeenLabel: 'Tidak diketahui' };
}

/**
 * Cek satu nomor di Telegram
 */
async function checkNumberWithSession(session, phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 8 || cleaned.length > 15) {
        throw new Error('Format nomor tidak valid');
    }

    // Helper: invoke with timeout (default 15s)
    const invokeWithTimeout = (request, timeoutMs = 15000) => {
        return Promise.race([
            session.client.invoke(request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Telegram API timeout')), timeoutMs)),
        ]);
    };

    try {
        const result = await invokeWithTimeout(
            new Api.contacts.ResolvePhone({ phone: cleaned })
        );

        const user = result.users[0];

        if (!user) {
            session.checkedCount++;
            return {
                exists: false,
                number: cleaned,
                username: null,
                firstName: '',
                lastName: '',
                userId: null,
                profilePic: null,
                lastSeen: null,
                lastSeenLabel: null,
                status: 'success',
                sessionUsed: session.name,
            };
        }

        // Cek apakah akun dihapus
        const isDeleted = !!(user.deleted);

        // Parse last seen
        const lastSeenInfo = parseLastSeen(user);

        // Coba ambil foto profil
        let profilePic = null;
        try {
            const photos = await invokeWithTimeout(
                new Api.photos.GetUserPhotos({
                    userId: user.id,
                    offset: 0,
                    maxId: 0,
                    limit: 1,
                }),
                10000
            );
            if (photos.photos && photos.photos.length > 0) {
                const file = await session.client.downloadProfilePhoto(user, { isBig: false });
                if (file) {
                    profilePic = 'data:image/jpeg;base64,' + Buffer.from(file).toString('base64');
                }
            }
        } catch (err) {
            console.warn(`[TG] Gagal ambil foto profil: ${err.message}`);
        }

        session.checkedCount++;
        const uid = user.id.toString();
        return {
            exists: true,
            deleted: isDeleted,
            number: cleaned,
            username: user.username || null,
            firstName: isDeleted ? 'Deleted Account' : (user.firstName || ''),
            lastName: isDeleted ? '' : (user.lastName || ''),
            userId: uid,
            registeredAt: estimateRegistrationDate(uid),
            profilePic,
            ...lastSeenInfo,
            status: 'success',
            sessionUsed: session.name,
        };
    } catch (err) {
        // PHONE_NOT_OCCUPIED = nomor tidak terdaftar
        if (err.message.includes('PHONE_NOT_OCCUPIED') || err.message.includes('Could not find')) {
            session.checkedCount++;
            return {
                exists: false,
                number: cleaned,
                username: null,
                firstName: '',
                lastName: '',
                userId: null,
                profilePic: null,
                lastSeen: null,
                lastSeenLabel: null,
                status: 'success',
                sessionUsed: session.name,
            };
        }

        // Error lain — log supaya bisa debug
        console.error(`[TG CHECK ERROR] ${cleaned}: ${err.message}`);
        session.checkedCount++;
        return {
            exists: false,
            number: cleaned,
            username: null,
            firstName: '',
            lastName: '',
            userId: null,
            profilePic: null,
            lastSeen: null,
            lastSeenLabel: null,
            status: 'error',
            error: err.message,
            sessionUsed: session.name,
        };
    }
}

/**
 * Cek satu nomor (auto load balance)
 */
async function checkNumber(phone) {
    const connected = getConnectedSessions();
    if (connected.length === 0) {
        throw new Error('Tidak ada session Telegram yang terhubung');
    }
    const session = connected.sort((a, b) => a.checkedCount - b.checkedCount)[0];
    return await checkNumberWithSession(session, phone);
}

/**
 * Bulk check dengan streaming
 */
async function checkBulkStream(phones, onResult) {
    const connected = getConnectedSessions();
    if (connected.length === 0) {
        throw new Error('Tidak ada session Telegram yang terhubung');
    }

    const totalSessions = connected.length;
    const chunks = Array.from({ length: totalSessions }, () => []);
    phones.forEach((phone, index) => {
        chunks[index % totalSessions].push({ phone, originalIndex: index });
    });

    const promises = chunks.map(async (chunk, sessionIndex) => {
        if (chunk.length === 0) return;
        const session = connected[sessionIndex];

        for (const { phone, originalIndex } of chunk) {
            try {
                const result = await checkNumberWithSession(session, phone);
                onResult({ index: originalIndex, ...result });
            } catch (err) {
                onResult({
                    index: originalIndex,
                    number: phone.replace(/\D/g, ''),
                    exists: false,
                    username: null,
                    firstName: '',
                    lastName: '',
                    userId: null,
                    profilePic: null,
                    status: 'error',
                    error: err.message,
                    sessionUsed: session.name,
                });
            }

            // Delay kecil supaya tidak kena flood wait
            await new Promise(r => setTimeout(r, 300));
        }
    });

    await Promise.all(promises);
}

/**
 * Auto-load sessions yang sudah ada
 */
async function autoLoadSessions() {
    if (!API_ID || !API_HASH) return;
    if (!fs.existsSync(SESSION_DIR)) return;

    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.txt'));
    for (const file of files) {
        const sessionId = file.replace('.txt', '');
        console.log(`[AUTO] Loading session "${sessionId}"...`);
        try {
            await createSession(sessionId, sessionId, '');
        } catch (err) {
            console.log(`[WARN] Gagal load session "${sessionId}": ${err.message}`);
        }
    }
}

function getStatus() {
    const connected = getConnectedSessions();
    return {
        totalSessions: sessions.size,
        connectedSessions: connected.length,
        hasApiCredentials: !!(API_ID && API_HASH),
        sessions: getAllSessions(),
    };
}

module.exports = {
    setApiCredentials,
    getApiCredentials,
    createSession,
    verifyCode,
    verifyPassword,
    deleteSession,
    getAllSessions,
    getConnectedSessions,
    checkNumber,
    checkBulkStream,
    getStatus,
    autoLoadSessions,
};
