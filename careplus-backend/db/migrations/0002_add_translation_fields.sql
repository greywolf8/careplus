-- Add produced_by field to translation table
ALTER TABLE translation ADD COLUMN produced_by TEXT DEFAULT 'openrouter';
ALTER TABLE translation ADD COLUMN back_translation TEXT;
ALTER TABLE translation ADD COLUMN flags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE translation ADD COLUMN grade_level DECIMAL(5,2);
ALTER TABLE translation ADD COLUMN avg_sentence_length DECIMAL(5,2);
ALTER TABLE translation ADD COLUMN content_hash TEXT;
ALTER TABLE translation ADD COLUMN verified_at TIMESTAMPTZ;
