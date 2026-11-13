ALTER TABLE messages ADD COLUMN client_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX messages_client_id ON messages(sender,client_id) WHERE client_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX messages_thread_cursor ON messages(thread_id,created,id);
--> statement-breakpoint
CREATE TABLE message_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,thread_id TEXT,kind TEXT NOT NULL,created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX message_events_user_seq ON message_events(user_id,seq);
--> statement-breakpoint
CREATE TRIGGER message_insert_event AFTER INSERT ON messages BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT user_id,NEW.thread_id,'message',NEW.created FROM members WHERE thread_id=NEW.thread_id;
END;
--> statement-breakpoint
CREATE TRIGGER message_revoke_event AFTER UPDATE OF revoked ON messages WHEN NEW.revoked<>OLD.revoked BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT user_id,NEW.thread_id,'reset',NEW.created FROM members WHERE thread_id=NEW.thread_id;
END;
--> statement-breakpoint
CREATE TRIGGER message_read_event AFTER UPDATE OF read_at ON members WHEN NEW.read_at<>OLD.read_at BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT user_id,NEW.thread_id,'read',NEW.read_at FROM members WHERE thread_id=NEW.thread_id;
END;
--> statement-breakpoint
CREATE TRIGGER message_hide_event AFTER INSERT ON hidden_messages BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT NEW.user_id,thread_id,'reset',created FROM messages WHERE id=NEW.message_id;
END;
--> statement-breakpoint
CREATE TRIGGER message_setting_event AFTER UPDATE OF muted ON members WHEN NEW.muted<>OLD.muted BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) VALUES(NEW.user_id,NEW.thread_id,'settings',NEW.read_at);
END;
--> statement-breakpoint
CREATE TRIGGER message_block_event AFTER INSERT ON blocks BEGIN
 INSERT INTO message_events(user_id,kind,created) VALUES(NEW.actor,'reset',0),(NEW.target,'reset',0);
END;
--> statement-breakpoint
CREATE TRIGGER message_unblock_event AFTER DELETE ON blocks BEGIN
 INSERT INTO message_events(user_id,kind,created) VALUES(OLD.actor,'reset',0),(OLD.target,'reset',0);
END;
--> statement-breakpoint
CREATE TRIGGER message_receipts_event AFTER UPDATE OF receipts ON users WHEN NEW.receipts<>OLD.receipts BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT m.user_id,t.id,'read',0 FROM threads t JOIN members m ON m.thread_id=t.id WHERE t.a=NEW.id OR t.b=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER message_event_retention AFTER INSERT ON message_events WHEN NEW.seq%128=0 BEGIN
 DELETE FROM message_events WHERE seq<NEW.seq-20000;
END;
--> statement-breakpoint
CREATE TABLE sticker_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id),recent TEXT NOT NULL DEFAULT '[]',favorites TEXT NOT NULL DEFAULT '[]');
--> statement-breakpoint
CREATE TRIGGER message_follow_event AFTER INSERT ON follows BEGIN
 INSERT INTO message_events(user_id,kind,created) VALUES(NEW.actor,'reset',0),(NEW.target,'reset',0);
END;
--> statement-breakpoint
CREATE TRIGGER message_unfollow_event AFTER DELETE ON follows BEGIN
 INSERT INTO message_events(user_id,kind,created) VALUES(OLD.actor,'reset',0),(OLD.target,'reset',0);
END;
--> statement-breakpoint
CREATE TRIGGER message_gallery_change AFTER UPDATE OF board ON galleries BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT DISTINCT m.user_id,m.thread_id,'reset',NEW.updated FROM members m JOIN messages s ON s.thread_id=m.thread_id WHERE s.kind='share' AND s.revoked=0 AND json_extract(s.ref,'$.galleryId')=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER message_gallery_delete AFTER DELETE ON galleries BEGIN
 INSERT INTO message_events(user_id,thread_id,kind,created) SELECT DISTINCT m.user_id,m.thread_id,'reset',OLD.updated FROM members m JOIN messages s ON s.thread_id=m.thread_id WHERE s.kind='share' AND s.revoked=0 AND json_extract(s.ref,'$.galleryId')=OLD.id;
END;
