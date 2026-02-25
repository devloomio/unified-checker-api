const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Support Railway Volume via DATA_DIR env, fallback ke ./data
const DB_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'app.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    ran_at TEXT DEFAULT (datetime('now'))
  )`);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  const ran = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name));

  for (const file of files) {
    if (ran.has(file)) continue;
    const migration = require(path.join(migrationsDir, file));
    migration.up(db);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`[DB] Migration applied: ${file}`);
  }
}

migrate();

module.exports = db;
