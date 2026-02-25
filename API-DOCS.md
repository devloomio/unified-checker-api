# Unified Checker API Documentation

Base URL: `http://localhost:3000`

---

## Authentication

Semua endpoint memerlukan API Key (jika `API_KEY` di-set di `.env`).

**Header:**
```
X-API-Key: your-secret-api-key-here
```

**Atau via query parameter:**
```
GET /api/status?apikey=your-secret-api-key-here
```

**Response jika tidak valid:**
```json
{
  "success": false,
  "message": "API key tidak valid"
}
```

> Jika `API_KEY` tidak di-set di `.env`, authentication di-skip (dev mode).

---

## CORS

Konfigurasi di `.env`:
- `CORS_ORIGINS=*` — allow semua domain
- `CORS_ORIGINS=https://domain1.com,https://domain2.com` — whitelist domain tertentu

---

## Global

### GET `/api/status`

Status gabungan WhatsApp & Telegram.

**Response:**
```json
{
  "success": true,
  "whatsapp": {
    "totalSessions": 2,
    "connectedSessions": 1,
    "sessions": [
      { "id": "wa-1", "name": "HP Kantor", "status": "connected", "hasQR": false, "checkedCount": 50 }
    ]
  },
  "telegram": {
    "totalSessions": 1,
    "connectedSessions": 1,
    "hasApiCredentials": true,
    "sessions": [
      { "id": "tg-1", "name": "Akun TG", "status": "connected", "phone": "+628****", "checkedCount": 30 }
    ]
  }
}
```

---

## WhatsApp Endpoints (`/api/wa`)

### GET `/api/wa/status`

Status WhatsApp sessions.

**Response:**
```json
{
  "success": true,
  "totalSessions": 2,
  "connectedSessions": 1,
  "sessions": [...]
}
```

---

### GET `/api/wa/sessions`

List semua WhatsApp sessions.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "wa-1",
      "name": "HP Kantor",
      "status": "connected",
      "hasQR": false,
      "checkedCount": 50
    }
  ]
}
```

**Session status:** `connecting` | `qr` | `connected` | `logged_out` | `reconnecting`

---

### POST `/api/wa/session`

Buat session WhatsApp baru. Akan generate QR code untuk di-scan.

**Body:**
```json
{
  "id": "wa-1",
  "name": "HP Kantor"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Session ID (default: `wa-{timestamp}`) |
| `name` | string | No | Label session |

**Response:**
```json
{
  "success": true,
  "sessionId": "wa-1",
  "message": "Session dibuat, scan QR code"
}
```

> Setelah session dibuat, poll QR code via `GET /api/wa/session/:id/qr`

---

### GET `/api/wa/session/:id/qr`

Ambil QR code untuk scan WhatsApp.

**Response (QR tersedia):**
```json
{
  "success": true,
  "qr": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response (QR belum tersedia):**
```json
{
  "success": false,
  "message": "QR tidak tersedia"
}
```

> Poll endpoint ini setiap 3 detik sampai session status jadi `connected`.

---

### DELETE `/api/wa/session/:id`

Hapus session WhatsApp.

**Response:**
```json
{
  "success": true,
  "message": "Session dihapus"
}
```

---

### GET `/api/wa/check/:number`

Cek apakah nomor terdaftar di WhatsApp.

**Parameter:** `number` — nomor telepon (contoh: `6281234567890`)

**Response (terdaftar):**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "jid": "6281234567890@s.whatsapp.net",
    "number": "6281234567890",
    "profilePic": "https://pps.whatsapp.net/...",
    "status": "success",
    "sessionUsed": "HP Kantor"
  }
}
```

**Response (tidak terdaftar):**
```json
{
  "success": true,
  "data": {
    "exists": false,
    "jid": null,
    "number": "6281234567890",
    "profilePic": null,
    "status": "success",
    "sessionUsed": "HP Kantor"
  }
}
```

---

### POST `/api/wa/check`

Cek nomor via request body.

**Body:**
```json
{
  "number": "6281234567890"
}
```

**Response:** Sama dengan `GET /api/wa/check/:number`

---

### POST `/api/wa/check-bulk`

Bulk check banyak nomor sekaligus.

**Body:**
```json
{
  "numbers": ["+6281234567890", "+6289876543210", "+6281111222333"]
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "registered": 2,
    "not_registered": 1,
    "sessions_used": 1
  },
  "data": [
    { "exists": true, "jid": "6281234567890@s.whatsapp.net", "number": "6281234567890", "profilePic": "...", "status": "success", "sessionUsed": "HP Kantor" },
    { "exists": true, "jid": "6289876543210@s.whatsapp.net", "number": "6289876543210", "profilePic": null, "status": "success", "sessionUsed": "HP Kantor" },
    { "exists": false, "jid": null, "number": "6281111222333", "profilePic": null, "status": "success", "sessionUsed": "HP Kantor" }
  ]
}
```

---

### POST `/api/wa/check-bulk-stream`

Bulk check dengan Server-Sent Events (SSE) — hasil dikirim real-time per nomor.

**Body:**
```json
{
  "numbers": ["+6281234567890", "+6289876543210"]
}
```

**Response:** `Content-Type: text/event-stream`

```
data: {"type":"start","total":2}

data: {"type":"result","checked":1,"exists":true,"jid":"6281234567890@s.whatsapp.net","number":"6281234567890","profilePic":null,"status":"success","sessionUsed":"HP Kantor"}

data: {"type":"result","checked":2,"exists":false,"jid":null,"number":"6289876543210","profilePic":null,"status":"success","sessionUsed":"HP Kantor"}

data: {"type":"done","total":2,"registered":1,"not_registered":1}
```

**Event types:**
| Type | Description |
|------|-------------|
| `start` | Mulai proses, berisi `total` nomor |
| `result` | Hasil per nomor |
| `done` | Selesai, berisi summary |
| `error` | Error terjadi |

---

## Telegram Endpoints (`/api/tg`)

### POST `/api/tg/credentials`

Set Telegram API credentials. Dapatkan di [my.telegram.org](https://my.telegram.org).

**Body:**
```json
{
  "apiId": 12345678,
  "apiHash": "abcdef1234567890abcdef1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API credentials disimpan"
}
```

---

### GET `/api/tg/credentials`

Cek apakah API credentials sudah di-set.

**Response:**
```json
{
  "success": true,
  "hasCredentials": true
}
```

---

### GET `/api/tg/status`

Status Telegram sessions.

**Response:**
```json
{
  "success": true,
  "totalSessions": 1,
  "connectedSessions": 1,
  "hasApiCredentials": true,
  "sessions": [
    { "id": "tg-1", "name": "Akun TG", "status": "connected", "phone": "+628****", "checkedCount": 30 }
  ]
}
```

---

### GET `/api/tg/sessions`

List semua Telegram sessions.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "tg-1",
      "name": "Akun TG",
      "status": "connected",
      "phone": "+628****",
      "checkedCount": 30
    }
  ]
}
```

**Session status:** `connecting` | `connected` | `need_code` | `need_password` | `need_phone` | `error`

---

### POST `/api/tg/session`

Buat session Telegram baru + kirim kode OTP.

**Body:**
```json
{
  "id": "tg-1",
  "name": "Akun TG",
  "phone": "+6281234567890"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Session ID (default: `tg-{timestamp}`) |
| `name` | string | No | Label session |
| `phone` | string | Yes | Nomor telepon format internasional |

**Response:**
```json
{
  "success": true,
  "sessionId": "tg-1",
  "status": "need_code",
  "message": "Kode OTP dikirim ke Telegram"
}
```

---

### POST `/api/tg/session/:id/verify`

Verifikasi kode OTP (Step 2).

**Body:**
```json
{
  "code": "12345"
}
```

**Response (berhasil):**
```json
{
  "success": true,
  "status": "connected",
  "message": "Berhasil login!"
}
```

**Response (butuh 2FA):**
```json
{
  "success": true,
  "status": "need_password",
  "message": "Akun pakai 2FA, masukkan password"
}
```

---

### POST `/api/tg/session/:id/password`

Verifikasi 2FA password (Step 3, opsional).

**Body:**
```json
{
  "password": "my2fapassword"
}
```

**Response:**
```json
{
  "success": true,
  "status": "connected",
  "message": "Berhasil login dengan 2FA!"
}
```

---

### DELETE `/api/tg/session/:id`

Hapus session Telegram.

**Response:**
```json
{
  "success": true,
  "message": "Session dihapus"
}
```

---

### GET `/api/tg/check/:number`

Cek apakah nomor terdaftar di Telegram (basic info).

**Parameter:** `number` — nomor telepon (contoh: `6281234567890`)

**Response (terdaftar):**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "number": "6281234567890",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "profilePic": "data:image/jpeg;base64,..."
  }
}
```

**Response (tidak terdaftar):**
```json
{
  "success": true,
  "data": {
    "exists": false,
    "number": "6281234567890",
    "username": null,
    "firstName": "",
    "lastName": "",
    "profilePic": null
  }
}
```

---

### GET `/api/tg/check/:number/last-seen`

Cek last seen nomor di Telegram.

**Response (terdaftar):**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "number": "6281234567890",
    "firstName": "John",
    "lastSeen": "online",
    "lastSeenLabel": "Online sekarang",
    "lastSeenTime": null
  }
}
```

**Nilai `lastSeen`:**
| Value | Label |
|-------|-------|
| `online` | Online sekarang |
| `offline` | X menit/jam/hari lalu |
| `recently` | Baru-baru ini |
| `last_week` | Minggu lalu |
| `last_month` | Bulan lalu |
| `long_time_ago` | Sudah lama tidak aktif |
| `unknown` | Tidak diketahui |

---

### GET `/api/tg/check/:number/deleted`

Cek apakah akun Telegram sudah dihapus/frozen.

**Response:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "number": "6281234567890",
    "deleted": false,
    "firstName": "John",
    "message": "Akun aktif"
  }
}
```

---

### GET `/api/tg/check/:number/full`

Cek lengkap — semua informasi Telegram.

**Response:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "deleted": false,
    "number": "6281234567890",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "userId": "1234567890",
    "registeredAt": "Maret 2020",
    "profilePic": "data:image/jpeg;base64,...",
    "lastSeen": "recently",
    "lastSeenLabel": "Baru-baru ini",
    "lastSeenTime": null,
    "status": "success",
    "sessionUsed": "Akun TG"
  }
}
```

---

### POST `/api/tg/check`

Cek nomor Telegram via request body.

**Body:**
```json
{
  "number": "6281234567890"
}
```

**Response:** Sama dengan `GET /api/tg/check/:number/full`

---

### POST `/api/tg/check-bulk-stream`

Bulk check Telegram dengan SSE streaming.

**Body:**
```json
{
  "numbers": ["+6281234567890", "+6289876543210"]
}
```

**Response:** `Content-Type: text/event-stream`

```
data: {"type":"start","total":2}

data: {"type":"result","checked":1,"index":0,"exists":true,"number":"6281234567890","username":"johndoe","firstName":"John","lastName":"Doe","userId":"1234567890","registeredAt":"Maret 2020","profilePic":null,"lastSeen":"recently","lastSeenLabel":"Baru-baru ini","status":"success","sessionUsed":"Akun TG"}

data: {"type":"result","checked":2,"index":1,"exists":false,"number":"6289876543210","username":null,"firstName":"","lastName":"","userId":null,"profilePic":null,"lastSeen":null,"lastSeenLabel":null,"status":"success","sessionUsed":"Akun TG"}

data: {"type":"done","total":2,"registered":1,"not_registered":1}
```

---

## Error Responses

Semua error mengikuti format:

```json
{
  "success": false,
  "message": "Deskripsi error"
}
```

| HTTP Code | Description |
|-----------|-------------|
| `400` | Bad request (nomor tidak valid, parameter missing) |
| `401` | API key tidak valid |
| `429` | Rate limit exceeded |
| `500` | Server error |

---

## Contoh Penggunaan

### cURL

```bash
# Cek status
curl -H "X-API-Key: YOUR_KEY" http://localhost:3000/api/status

# Cek nomor WA
curl -H "X-API-Key: YOUR_KEY" http://localhost:3000/api/wa/check/6281234567890

# Cek nomor Telegram (full)
curl -H "X-API-Key: YOUR_KEY" http://localhost:3000/api/tg/check/6281234567890/full

# Bulk check WA
curl -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"numbers":["+6281234567890","+6289876543210"]}' \
  http://localhost:3000/api/wa/check-bulk
```

### JavaScript (Fetch)

```javascript
const API_URL = 'http://localhost:3000';
const API_KEY = 'your-secret-api-key-here';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Cek nomor di WhatsApp
const waResult = await fetch(`${API_URL}/api/wa/check/6281234567890`, { headers });
const waData = await waResult.json();

// Cek nomor di Telegram (full info)
const tgResult = await fetch(`${API_URL}/api/tg/check/6281234567890/full`, { headers });
const tgData = await tgResult.json();

// Bulk check WA
const bulkResult = await fetch(`${API_URL}/api/wa/check-bulk`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ numbers: ['+6281234567890', '+6289876543210'] }),
});
const bulkData = await bulkResult.json();

// Bulk check WA dengan SSE streaming
const response = await fetch(`${API_URL}/api/wa/check-bulk-stream`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ numbers: ['+6281234567890', '+6289876543210'] }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = JSON.parse(line.slice(6));

    if (data.type === 'result') {
      console.log(`${data.number}: ${data.exists ? 'Terdaftar' : 'Tidak'}`);
    }
    if (data.type === 'done') {
      console.log(`Selesai! ${data.registered}/${data.total} terdaftar`);
    }
  }
}
```

---

## Setup

1. Copy `.env.example` ke `.env`
2. Isi konfigurasi:
   ```
   PORT=3000
   API_KEY=your-secret-api-key-here
   CORS_ORIGINS=*
   TG_API_ID=12345678
   TG_API_HASH=abcdef1234567890
   ```
3. `npm install`
4. `npm start`
