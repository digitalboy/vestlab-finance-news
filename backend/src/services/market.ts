import { MarketDataItem } from '../types';

/**
 * Tracked symbols configuration.
 * symbol → { name (Chinese), type }
 */
const TRACKED_SYMBOLS: Record<string, { name: string; type: 'index' | 'stock' | 'commodity' }> = {
    // 🇺🇸 US Indices
    '^GSPC': { name: '标普500', type: 'index' },
    '^IXIC': { name: '纳斯达克综合', type: 'index' },
    '^DJI': { name: '道琼斯工业', type: 'index' },
    // 🇨🇳 China
    '000001.SS': { name: '上证综指', type: 'index' },
    '399001.SZ': { name: '深证成指', type: 'index' },
    // 🇭🇰 Hong Kong
    '^HSI': { name: '恒生指数', type: 'index' },
    // 🇯🇵 Japan
    '^N225': { name: '日经225', type: 'index' },
    // 🇬🇧 UK
    '^FTSE': { name: '富时100', type: 'index' },
    // 🇩🇪 Germany
    '^GDAXI': { name: '德国DAX', type: 'index' },
    // 🇫🇷 France
    '^FCHI': { name: '法国CAC40', type: 'index' },
    // 🇦🇺 Australia
    '^AXJO': { name: '澳大利亚ASX200', type: 'index' },
    // 🇰🇷 South Korea
    '^KS11': { name: '韩国KOSPI', type: 'index' },
};

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

export class MarketDataService {
    /**
     * Get all tracked symbols config.
     */
    getTrackedSymbols() {
        return TRACKED_SYMBOLS;
    }

    /**
     * Batch fetch real-time quotes from Yahoo Finance.
     * Returns MarketDataItem[] for today's date.
     */
    async fetchQuotes(symbols?: string[]): Promise<MarketDataItem[]> {
        const targetSymbols = symbols || Object.keys(TRACKED_SYMBOLS);
        const symbolsParam = targetSymbols.join(',');
        const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbolsParam)}`;

        console.log(`[MarketData] Fetching quotes for ${targetSymbols.length} symbols...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Yahoo Finance quote API error: ${response.status} - ${body.substring(0, 200)}`);
        }

        const data: any = await response.json();
        const results: any[] = data?.quoteResponse?.result || [];
        const items: MarketDataItem[] = [];

        for (const quote of results) {
            const symbol = quote.symbol;
            const config = TRACKED_SYMBOLS[symbol];
            if (!config) continue;

            // Determine the date from the market time
            const marketTimeEpoch = quote.regularMarketTime; // Unix timestamp
            const dateStr = marketTimeEpoch
                ? new Date(marketTimeEpoch * 1000).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            items.push({
                symbol,
                name: config.name,
                type: config.type,
                price: quote.regularMarketPrice ?? null,
                change_amount: quote.regularMarketChange ?? null,
                change_percent: quote.regularMarketChangePercent ?? null,
                day_high: quote.regularMarketDayHigh ?? null,
                day_low: quote.regularMarketDayLow ?? null,
                previous_close: quote.regularMarketPreviousClose ?? null,
                market_time: marketTimeEpoch
                    ? new Date(marketTimeEpoch * 1000).toISOString()
                    : null,
                date: dateStr,
            });
        }

        console.log(`[MarketData] Parsed ${items.length} quotes.`);
        return items;
    }

    /**
     * Fetch historical daily data for a single symbol.
     * Uses Yahoo Finance chart API.
     * @param symbol - Yahoo Finance symbol (e.g. '^GSPC')
     * @param range  - Range string (e.g. '3mo', '1y')
     */
    async fetchHistory(symbol: string, range: string = '3mo'): Promise<MarketDataItem[]> {
        const config = TRACKED_SYMBOLS[symbol];
        if (!config) {
            console.warn(`[MarketData] Unknown symbol: ${symbol}`);
            return [];
        }

        const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
        console.log(`[MarketData] Fetching ${range} history for ${symbol}...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`[MarketData] History API error for ${symbol}: ${response.status} - ${body.substring(0, 200)}`);
            return [];
        }

        const data: any = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result) {
            console.warn(`[MarketData] No chart data for ${symbol}`);
            return [];
        }

        const timestamps: number[] = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};
        const closes: number[] = quotes.close || [];
        const highs: number[] = quotes.high || [];
        const lows: number[] = quotes.low || [];

        const items: MarketDataItem[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i];
            const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
            const closePrice = closes[i];

            if (closePrice == null) continue; // Skip days with no data (holidays)

            // Calculate change from previous day
            const prevClose = i > 0 ? closes[i - 1] : null;
            const changeAmount = prevClose != null ? closePrice - prevClose : null;
            const changePercent = prevClose != null && prevClose !== 0
                ? ((closePrice - prevClose) / prevClose) * 100
                : null;

            items.push({
                symbol,
                name: config.name,
                type: config.type,
                price: closePrice,
                change_amount: changeAmount != null ? Math.round(changeAmount * 100) / 100 : null,
                change_percent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
                day_high: highs[i] ?? null,
                day_low: lows[i] ?? null,
                previous_close: prevClose ?? null,
                market_time: new Date(ts * 1000).toISOString(),
                date: dateStr,
            });
        }

        console.log(`[MarketData] Parsed ${items.length} historical records for ${symbol}.`);
        return items;
    }

    /**
     * Cold start: fetch 90-day history for all tracked symbols.
     * Returns all items (caller is responsible for saving).
     */
    async coldStart(): Promise<MarketDataItem[]> {
        console.log('[MarketData] Starting cold start (90-day history)...');
        const allItems: MarketDataItem[] = [];

        for (const symbol of Object.keys(TRACKED_SYMBOLS)) {
            try {
                const items = await this.fetchHistory(symbol, '3mo');
                allItems.push(...items);
            } catch (error) {
                console.error(`[MarketData] Cold start failed for ${symbol}:`, error);
                // Continue with other symbols
            }
        }

        console.log(`[MarketData] Cold start complete. Total records: ${allItems.length}`);
        return allItems;
    }
}
