ALTER TABLE users ADD COLUMN code TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX users_code ON users(code);
--> statement-breakpoint
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN gallery_title TEXT NOT NULL DEFAULT '나의 전시관';
--> statement-breakpoint
CREATE TABLE beta_invites (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE beta_members (user_id TEXT PRIMARY KEY REFERENCES users(id), role TEXT NOT NULL DEFAULT 'member', active INTEGER NOT NULL DEFAULT 1, invite_id TEXT REFERENCES beta_invites(id), joined INTEGER NOT NULL, privacy_version TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER beta_capacity BEFORE INSERT ON beta_members WHEN NEW.active=1 BEGIN SELECT CASE WHEN (SELECT COUNT(*) FROM beta_members WHERE active=1)>=30 THEN RAISE(ABORT,'BETA_FULL') END; END;
--> statement-breakpoint
CREATE TRIGGER beta_reactivate BEFORE UPDATE OF active ON beta_members WHEN NEW.active=1 AND OLD.active=0 BEGIN SELECT CASE WHEN (SELECT COUNT(*) FROM beta_members WHERE active=1)>=30 THEN RAISE(ABORT,'BETA_FULL') END; END;
--> statement-breakpoint
CREATE TRIGGER beta_invite_guard BEFORE INSERT ON beta_members WHEN NEW.invite_id IS NOT NULL BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM beta_invites WHERE id=NEW.invite_id AND revoked=0 AND expires>unixepoch()*1000 AND uses=0) THEN RAISE(ABORT,'INVITE_INVALID') END; UPDATE beta_invites SET uses=1 WHERE id=NEW.invite_id; END;
--> statement-breakpoint
CREATE TABLE board_drafts (owner TEXT PRIMARY KEY REFERENCES users(id), board TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE board_backups (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), board TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE media (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), object_key TEXT NOT NULL, bytes INTEGER NOT NULL, mime TEXT NOT NULL, created INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending');
--> statement-breakpoint
CREATE TABLE visits (gallery_id TEXT NOT NULL REFERENCES galleries(id), visitor TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY(gallery_id,visitor,day));
--> statement-breakpoint
CREATE TABLE activity (id TEXT PRIMARY KEY, recipient TEXT NOT NULL REFERENCES users(id), actor TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, created INTEGER NOT NULL, read_at INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE audit_events (id TEXT PRIMARY KEY, actor TEXT, kind TEXT NOT NULL, created INTEGER NOT NULL, detail TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TABLE bookmarks (owner TEXT NOT NULL REFERENCES users(id), gallery_id TEXT NOT NULL REFERENCES galleries(id), PRIMARY KEY(owner,gallery_id));
