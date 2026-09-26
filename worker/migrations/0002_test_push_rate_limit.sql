-- When the last "Send to lock screen" test went out, to rate-limit it.
ALTER TABLE settings ADD COLUMN last_test_at TEXT;
