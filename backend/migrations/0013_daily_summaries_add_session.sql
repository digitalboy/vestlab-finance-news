-- Migration number: 0013    2026-02-14
-- Add session column to daily_summaries to support twice-daily reports (morning/evening)

-- 1. Create new table with composite primary key (date, session)
CREATE TABLE IF NOT EXISTS daily_summaries_v2 (
    date DATE NOT NULL,
    session TEXT NOT NULL DEFAULT 'morning',  -- 'morning' | 'evening'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, session)
);

-- 2. Migrate existing data (treat old records as 'morning')
INSERT INTO daily_summaries_v2 (date, session, content, created_at)
    SELECT date, 'morning', content, created_at FROM daily_summaries;

-- 3. Swap tables
DROP TABLE daily_summaries;
ALTER TABLE daily_summaries_v2 RENAME TO daily_summaries;
