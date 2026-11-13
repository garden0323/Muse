CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT NOT NULL UNIQUE, receipts INTEGER NOT NULL DEFAULT 1, online INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE threads (id TEXT PRIMARY KEY, a TEXT NOT NULL REFERENCES users(id), b TEXT NOT NULL REFERENCES users(id), updated INTEGER NOT NULL, UNIQUE(a,b));
--> statement-breakpoint
CREATE TABLE members (thread_id TEXT NOT NULL REFERENCES threads(id), user_id TEXT NOT NULL REFERENCES users(id), read_at INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(thread_id,user_id));
--> statement-breakpoint
CREATE TABLE messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id), sender TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, body TEXT, ref TEXT, created INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE INDEX messages_thread_created ON messages(thread_id,created);
--> statement-breakpoint
CREATE TABLE hidden_messages (message_id TEXT NOT NULL REFERENCES messages(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(message_id,user_id));
--> statement-breakpoint
CREATE TABLE blocks (actor TEXT NOT NULL REFERENCES users(id), target TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(actor,target));
--> statement-breakpoint
CREATE TABLE follows (actor TEXT NOT NULL REFERENCES users(id), target TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(actor,target));
--> statement-breakpoint
CREATE TABLE reports (id TEXT PRIMARY KEY, reporter TEXT NOT NULL REFERENCES users(id), target TEXT NOT NULL REFERENCES users(id), message_id TEXT, reason TEXT NOT NULL, evidence TEXT, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, reviewed_at INTEGER);
--> statement-breakpoint
CREATE TABLE rate_limits (user_id TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE galleries (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, board TEXT NOT NULL, updated INTEGER NOT NULL);
