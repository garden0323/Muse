DROP TRIGGER IF EXISTS beta_capacity;
--> statement-breakpoint
DROP TRIGGER IF EXISTS beta_reactivate;
--> statement-breakpoint
CREATE TABLE auth_credentials (user_id TEXT PRIMARY KEY REFERENCES users(id), password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created INTEGER NOT NULL, refreshed INTEGER NOT NULL, expires INTEGER NOT NULL, absolute_expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
--> statement-breakpoint
CREATE TABLE auth_rates (key TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(key,bucket));
--> statement-breakpoint
CREATE TABLE guestbook (id TEXT PRIMARY KEY, gallery_id TEXT NOT NULL REFERENCES galleries(id), author TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX guestbook_gallery ON guestbook(gallery_id,created);
