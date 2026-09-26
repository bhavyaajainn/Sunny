-- Each affirmation is now its own reminder: it has a time, days and a vibe.
-- The separate reminders table (and its 3 starter reminders) goes away.
ALTER TABLE affirmations ADD COLUMN time TEXT;                        -- 'HH:MM' 24h, settings.timezone
ALTER TABLE affirmations ADD COLUMN days TEXT NOT NULL DEFAULT '1111111'; -- Mon..Sun
ALTER TABLE affirmations ADD COLUMN vibe TEXT NOT NULL DEFAULT 'sunny';   -- 'hype' | 'sunny' | 'calm'
ALTER TABLE affirmations ADD COLUMN last_sent_on TEXT;                -- 'YYYY-MM-DD' local, prevents duplicates

DROP TABLE reminders;
