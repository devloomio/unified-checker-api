const { Router } = require('express');
const db = require('../../db');
const wa = require('../../whatsapp');
const tg = require('../../telegram');

const router = Router();

// GET /stats - Aggregate dashboard stats
router.get('/stats', (req, res) => {
  const today = db.prepare(`
    SELECT COUNT(*) as count FROM api_usage_log
    WHERE created_at >= date('now')
  `).get();

  const thisWeek = db.prepare(`
    SELECT COUNT(*) as count FROM api_usage_log
    WHERE created_at >= date('now', '-7 days')
  `).get();

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM api_usage_log
    WHERE created_at >= date('now', '-30 days')
  `).get();

  const activeKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1').get();
  const totalKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys').get();

  const waStatus = wa.getStatus();
  const tgStatus = tg.getStatus();

  const topKeys = db.prepare(`
    SELECT ak.name, ak.key_prefix, ak.total_requests, ak.last_used_at
    FROM api_keys ak ORDER BY ak.total_requests DESC LIMIT 5
  `).all();

  const recentLogs = db.prepare(`
    SELECT ul.endpoint, ul.method, ul.status_code, ul.response_time_ms, ul.created_at, ak.name as key_name
    FROM api_usage_log ul
    LEFT JOIN api_keys ak ON ul.api_key_id = ak.id
    ORDER BY ul.created_at DESC LIMIT 20
  `).all();

  res.json({
    success: true,
    data: {
      requests: {
        today: today.count,
        thisWeek: thisWeek.count,
        thisMonth: thisMonth.count,
      },
      apiKeys: {
        active: activeKeys.count,
        total: totalKeys.count,
      },
      whatsapp: {
        totalSessions: waStatus.totalSessions,
        connectedSessions: waStatus.connectedSessions,
      },
      telegram: {
        totalSessions: tgStatus.totalSessions,
        connectedSessions: tgStatus.connectedSessions,
      },
      topKeys,
      recentLogs,
    },
  });
});

// GET /usage-chart - Usage data for charts
router.get('/usage-chart', (req, res) => {
  const days = parseInt(req.query.days) || 7;

  const data = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as requests
    FROM api_usage_log
    WHERE created_at >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(days);

  res.json({ success: true, data });
});

module.exports = router;
