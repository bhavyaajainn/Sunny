-- Sunny schema. Single user, no login: settings is a single row (id = 1).

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  vibe TEXT NOT NULL DEFAULT 'sunny',          -- 'hype' | 'sunny' | 'calm'
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  theme TEXT NOT NULL DEFAULT 'system',        -- 'light' | 'system' | 'dark'
  last_affirmation_id INTEGER,                 -- last one pushed, so the next pick can avoid it
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE affirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'sun',            -- sun|sprout|flower|heart|star|rainbow|cloud|moon
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,                             -- soft delete, so Undo can restore; purged after a day
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,                          -- 'HH:MM' 24h in settings.timezone
  label TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '1111111',        -- Mon..Sun
  active INTEGER NOT NULL DEFAULT 1,
  last_sent_on TEXT                            -- 'YYYY-MM-DD' local date, prevents duplicates
);

CREATE TABLE subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Starter data (from the prototype).
INSERT INTO settings (id) VALUES (1);

INSERT INTO affirmations (text, icon, position) VALUES
  ('I am capable of hard things, and I do them anyway.', 'star', 0),
  ('My work gets better every day, and so do I.', 'sprout', 1),
  ('I choose calm over rush.', 'cloud', 2),
  ('I''ve handled tough days before. I''ll handle this one too.', 'sun', 3),
  ('Good things are on their way to me.', 'rainbow', 4),
  ('I am proud of how far I''ve come.', 'heart', 5);

INSERT INTO reminders (time, label, days, active) VALUES
  ('07:30', 'Morning boost', '1111111', 1),
  ('13:00', 'Midday reset', '1111100', 1),
  ('21:30', 'Wind down', '1111111', 0);
