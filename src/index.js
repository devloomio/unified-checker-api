require('dotenv').config();

// Initialize database (runs migrations)
require('./db');

const express = require('express');
const path = require('path');
const fs = require('fs');
const corsMiddleware = require('./middleware/cors');
const authMiddleware = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');
const usageTracker = require('./middleware/usageTracker');
const adminRouter = require('./routes/admin');
const waRouter = require('./routes/wa');
const tgRouter = require('./routes/tg');
const { getStatus: getWaStatus, autoLoadSessions: autoLoadWa } = require('./whatsapp');
const { getStatus: getTgStatus, autoLoadSessions: autoLoadTg } = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Global middleware
app.use(corsMiddleware);

// Serve admin SPA static files (BEFORE auth middleware)
const adminBuildPath = path.join(__dirname, '..', 'admin', 'dist');
if (fs.existsSync(adminBuildPath)) {
  app.use(express.static(adminBuildPath));
}

// Admin routes (JWT auth, BEFORE API key middleware)
app.use('/api/admin', adminRouter);

// API routes (API key auth + rate limit + usage tracking)
app.use('/api', authMiddleware);
app.use('/api', rateLimiter);
app.use('/api', usageTracker);

app.use('/api/wa', waRouter);
app.use('/api/tg', tgRouter);

// Combined status endpoint
app.get('/api/status', (req, res) => {
  try {
    const waStatus = getWaStatus();
    const tgStatus = getTgStatus();

    res.json({
      success: true,
      whatsapp: { ...waStatus },
      telegram: { ...tgStatus },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// SPA fallback — non-API routes serve index.html
if (fs.existsSync(adminBuildPath)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(adminBuildPath, 'index.html'));
    }
  });
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log(`  - GET  /api/status`);
  console.log(`  - /api/wa/*`);
  console.log(`  - /api/tg/*`);
  console.log(`  - /api/admin/*  (Admin Panel API)`);

  if (fs.existsSync(adminBuildPath)) {
    console.log(`  - /  (Admin Panel UI)`);
  } else {
    console.log(`  - Admin Panel UI not built. Run: cd admin && npm run build`);
  }

  // Auto-load WhatsApp sessions
  try {
    await autoLoadWa();
    console.log('WhatsApp sessions auto-loaded');
  } catch (error) {
    console.error('Failed to auto-load WhatsApp sessions:', error.message);
  }

  // Auto-load Telegram sessions (only if API credentials are configured)
  if (process.env.TG_API_ID && process.env.TG_API_HASH) {
    try {
      await autoLoadTg();
      console.log('Telegram sessions auto-loaded');
    } catch (error) {
      console.error('Failed to auto-load Telegram sessions:', error.message);
    }
  } else {
    console.log('Telegram auto-load skipped: TG_API_ID and TG_API_HASH not set');
  }
});
