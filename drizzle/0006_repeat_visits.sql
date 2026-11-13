ALTER TABLE visits ADD COLUMN visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count >= 1);
