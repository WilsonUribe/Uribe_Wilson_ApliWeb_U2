const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const config = require("./config");

fs.mkdirSync(path.dirname(config.dbFile), {
  recursive: true
});

const db = new Database(config.dbFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    title TEXT NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    status TEXT NOT NULL DEFAULT 'pendiente'
      CHECK (
        status IN (
          'pendiente',
          'en_progreso',
          'completada'
        )
      ),

    due_date TEXT,

    attachment_name TEXT,

    attachment_path TEXT,

    version INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT
      (datetime('now')),

    updated_at TEXT NOT NULL DEFAULT
      (datetime('now'))
  );
`);

module.exports = db;