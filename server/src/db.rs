//! SQLite, one file, one connection behind a mutex. SHOW's write load is a
//! studio's worth of people, not a social network; this is the simplest
//! thing that is correct, and every call runs off the async threads.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::Connection;

use crate::error::{ApiError, ApiResult};

#[derive(Clone)]
pub struct Db(Arc<Mutex<Connection>>);

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  pass          TEXT NOT NULL,
  created       INTEGER NOT NULL,
  premium_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created    INTEGER NOT NULL,
  expires    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section  TEXT NOT NULL,
  prompt   TEXT NOT NULL,
  negative TEXT NOT NULL,
  seed     INTEGER NOT NULL,
  count    INTEGER NOT NULL,
  aspect   TEXT NOT NULL,
  provider TEXT NOT NULL,
  status   TEXT NOT NULL,       -- running | done | failed
  model    TEXT NOT NULL DEFAULT '',
  error    TEXT,
  created  INTEGER NOT NULL,
  finished INTEGER
);

CREATE TABLE IF NOT EXISTS refines (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target  TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS refines_by_user ON refines (user_id, created);

CREATE TABLE IF NOT EXISTS handles (
  handle  TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  name_my TEXT NOT NULL,
  date    TEXT NOT NULL,
  place   TEXT NOT NULL,
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guests (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code     TEXT NOT NULL,
  name     TEXT NOT NULL,
  PRIMARY KEY (event_id, code)
);

CREATE TABLE IF NOT EXISTS event_photos (
  id       TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  w        INTEGER NOT NULL,
  h        INTEGER NOT NULL,
  created  INTEGER NOT NULL,
  PRIMARY KEY (event_id, id)
);

CREATE TABLE IF NOT EXISTS photo_guests (
  event_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  code     TEXT NOT NULL,
  PRIMARY KEY (event_id, photo_id, code),
  FOREIGN KEY (event_id, photo_id) REFERENCES event_photos(event_id, id) ON DELETE CASCADE
);
"#;

/// (table, column, definition) — columns added after a database was first made.
const ADDED: &[(&str, &str, &str)] = &[
    ("generations", "model", "TEXT NOT NULL DEFAULT ''"),
    /* the Firebase account behind a SHOW account, when it signed in that way */
    ("users", "firebase_uid", "TEXT"),
];

impl Db {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        /* columns added after a database was first made */
        for &(table, column, def) in ADDED {
            let has: bool = conn.query_row(
                &format!("SELECT COUNT(*) > 0 FROM pragma_table_info('{table}') WHERE name = ?1"),
                [column],
                |r| r.get(0),
            )?;
            if !has {
                conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {def}"))?;
            }
        }
        conn.execute_batch("CREATE UNIQUE INDEX IF NOT EXISTS users_firebase ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;")?;
        Ok(Self(Arc::new(Mutex::new(conn))))
    }

    /// Run `f` with the connection on a blocking thread.
    pub async fn run<T, F>(&self, f: F) -> ApiResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> ApiResult<T> + Send + 'static,
    {
        let db = self.0.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = db.lock().map_err(|_| ApiError::Internal(anyhow::anyhow!("database lock poisoned")))?;
            f(&mut conn)
        })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
    }
}

pub fn now() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

/// A random id, url-safe, 16 characters.
pub fn new_id() -> String {
    use rand::Rng;
    const A: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut r = rand::thread_rng();
    (0..16).map(|_| A[r.gen_range(0..A.len())] as char).collect()
}
