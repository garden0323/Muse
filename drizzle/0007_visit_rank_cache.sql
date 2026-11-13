CREATE TABLE visit_rank_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  day TEXT NOT NULL DEFAULT '',
  expires INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
INSERT INTO visit_rank_cache (id) VALUES (1);
