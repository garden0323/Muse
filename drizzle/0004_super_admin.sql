ALTER TABLE auth_sessions ADD COLUMN mfa_verified_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE auth_sessions ADD COLUMN admin_verified_until INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE admin_security(user_id TEXT PRIMARY KEY REFERENCES users(id), secret_cipher TEXT NOT NULL, last_counter INTEGER NOT NULL DEFAULT -1, enabled_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE admin_setup_challenges(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, secret_cipher TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX singleton_super_admin ON beta_members(role) WHERE role='super_admin';
--> statement-breakpoint
CREATE TRIGGER protect_super_admin_membership BEFORE UPDATE OF active,role ON beta_members WHEN OLD.role='super_admin' AND (NEW.role<>'super_admin' OR NEW.active<>1) BEGIN SELECT RAISE(ABORT,'SUPER_ADMIN_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER protect_super_admin_membership_delete BEFORE DELETE ON beta_members WHEN OLD.role='super_admin' BEGIN SELECT RAISE(ABORT,'SUPER_ADMIN_PROTECTED'); END;
--> statement-breakpoint
CREATE TRIGGER protect_super_admin_user_delete BEFORE DELETE ON users WHEN EXISTS(SELECT 1 FROM beta_members WHERE user_id=OLD.id AND role='super_admin') BEGIN SELECT RAISE(ABORT,'SUPER_ADMIN_PROTECTED'); END;
