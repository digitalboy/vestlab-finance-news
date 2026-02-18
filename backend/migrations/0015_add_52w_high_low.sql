-- Migration number: 0015    2026-02-18
-- Add 52-week high/low columns to market_data

ALTER TABLE market_data ADD COLUMN fifty_two_week_high REAL;
ALTER TABLE market_data ADD COLUMN fifty_two_week_low REAL;
