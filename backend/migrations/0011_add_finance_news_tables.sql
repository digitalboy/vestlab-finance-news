-- Migration number: 0011 	 2026-02-12T15:30:00.000Z

-- 1. News Table
CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY, -- UUID
    source TEXT NOT NULL, -- 'bloomberg', 'wsj'
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    published_at TIMESTAMP,
    author TEXT,
    image_url TEXT,
    tags TEXT, -- Comma separated
    description TEXT, -- RSS description
    raw_content TEXT, -- Full content (if scraped)
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Translations Table
CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY, -- UUID
    news_id TEXT NOT NULL,
    language TEXT NOT NULL, -- e.g. 'zh'
    title TEXT,
    content TEXT, -- Translated description/content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (news_id) REFERENCES news(id),
    UNIQUE(news_id, language)
);

-- 3. Daily Summaries Table
CREATE TABLE IF NOT EXISTS daily_summaries (
    date DATE PRIMARY KEY, -- 'YYYY-MM-DD'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
