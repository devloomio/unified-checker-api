const { Router } = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { hashPassword, verifyPassword } = require('../../utils/crypto');
const adminAuth = require('../../middleware/adminAuth');

const router = Router();

// POST /login - Login admin
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Username atau password salah' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Username atau password salah' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    adminAuth.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, token, user: { id: user.id, username: user.username } });
});

// POST /logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out' });
});

// GET /me - Current admin info (protected)
router.get('/me', adminAuth, (req, res) => {
  res.json({ success: true, user: req.adminUser });
});

// PUT /password - Change password (protected)
router.put('/password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password dan new password wajib diisi' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.adminUser.userId);
  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Password lama salah' });
  }

  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  res.json({ success: true, message: 'Password berhasil diubah' });
});

module.exports = router;
