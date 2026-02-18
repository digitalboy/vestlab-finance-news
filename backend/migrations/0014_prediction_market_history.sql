-- Migration number: 0004 	 2026-02-18T09:48:00.000Z
CREATE TABLE prediction_market_history (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    market_id TEXT NOT NULL,
    title TEXT,
    outcome_label TEXT NOT NULL,
    probability REAL NOT NULL,
    volume REAL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prediction_history_date ON prediction_market_history(date);
CREATE INDEX idx_prediction_history_market ON prediction_market_history(market_id);
CREATE INDEX idx_prediction_history_event ON prediction_market_history(event_id);
