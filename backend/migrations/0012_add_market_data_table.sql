-- Migration number: 0012    2026-02-13
-- Add market_data table for stock indices, commodities, and individual stocks

CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,                          -- '^GSPC', 'GC=F', 'AAPL'
    name TEXT NOT NULL,                            -- '标普500', '黄金', 'Apple'
    type TEXT NOT NULL DEFAULT 'index',            -- 'index' | 'stock' | 'commodity'
    price REAL,                                    -- 收盘/最新价
    change_amount REAL,                            -- 涨跌额
    change_percent REAL,                           -- 涨跌幅 %
    day_high REAL,
    day_low REAL,
    previous_close REAL,                           -- 前收盘价
    market_time TEXT,                              -- 数据时间 (交易所当地时间)
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    date TEXT NOT NULL                             -- 'YYYY-MM-DD' 日期分区键
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_symbol_date
    ON market_data(symbol, date);

CREATE INDEX IF NOT EXISTS idx_market_data_date
    ON market_data(date);
