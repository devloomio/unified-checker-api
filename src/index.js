require('dotenv').config();
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const authMiddleware = require('./middleware/auth');
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
app.use(authMiddleware);

// Routes
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

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log(`  - GET  /api/status`);
  console.log(`  - /api/wa/*`);
  console.log(`  - /api/tg/*`);

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
