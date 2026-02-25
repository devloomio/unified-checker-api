const crypto = require('crypto');
const bcrypt = require('bcrypt');

function generateApiKey() {
  const random = crypto.randomBytes(32).toString('hex');
  return 'ak_' + random;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function getKeyPrefix(key) {
  return key.substring(0, 11) + '...';
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { generateApiKey, hashApiKey, getKeyPrefix, hashPassword, verifyPassword };
