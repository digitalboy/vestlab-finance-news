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

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

export class MarketDataService {
    /**
     * Get all tracked symbols config.
     */
    getTrackedSymbols() {
        return TRACKED_SYMBOLS;
    }

    /**
     * Fetch latest quotes using the chart API (v7 quote API is deprecated/401).
     * Uses range=5d to ensure we get at least the most recent trading day.
     */
    async fetchQuotes(symbols?: string[]): Promise<MarketDataItem[]> {
        const targetSymbols = symbols || Object.keys(TRACKED_SYMBOLS);
        console.log(`[MarketData] Fetching quotes for ${targetSymbols.length} symbols via chart API...`);

        const items: MarketDataItem[] = [];

        for (const symbol of targetSymbols) {
            try {
                const data = await this.fetchChartData(symbol, '5d', '1d');
                if (data) items.push(data);
            } catch (error) {
                console.error(`[MarketData] Error fetching quote for ${symbol}:`, error);
                // Continue with other symbols
            }
        }

        console.log(`[MarketData] Fetched ${items.length} quotes.`);
        return items;
    }

    /**
     * Fetch the latest data point from chart API for a single symbol.
     * Returns only the most recent trading day's data.
     */
    private async fetchChartData(symbol: string, range: string, interval: string): Promise<MarketDataItem | null> {
        const config = TRACKED_SYMBOLS[symbol];
        if (!config) return null;

        const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`[MarketData] Chart API error for ${symbol}: ${response.status} - ${body.substring(0, 200)}`);
            return null;
        }

        const data: any = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta || {};
        const timestamps: number[] = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};
        const closes: number[] = quotes.close || [];
        const highs: number[] = quotes.high || [];
        const lows: number[] = quotes.low || [];

        // Get the last valid data point
        let lastIdx = timestamps.length - 1;
        while (lastIdx >= 0 && closes[lastIdx] == null) lastIdx--;
        if (lastIdx < 0) return null;

        const ts = timestamps[lastIdx];
        const closePrice = closes[lastIdx];
        const prevClose = meta.chartPreviousClose ?? (lastIdx > 0 ? closes[lastIdx - 1] : null);
        const changeAmount = prevClose != null ? closePrice - prevClose : null;
        const changePercent = prevClose != null && prevClose !== 0
            ? ((closePrice - prevClose) / prevClose) * 100
            : null;

        return {
            symbol,
            name: config.name,
            type: config.type,
            price: Math.round(closePrice * 100) / 100,
            change_amount: changeAmount != null ? Math.round(changeAmount * 100) / 100 : null,
            change_percent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
            day_high: highs[lastIdx] ?? null,
            day_low: lows[lastIdx] ?? null,
            previous_close: prevClose != null ? Math.round(prevClose * 100) / 100 : null,
            market_time: new Date(ts * 1000).toISOString(),
            date: new Date(ts * 1000).toISOString().split('T')[0],
        };
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
     * Cold start: fetch 90-day history for tracked symbols that are missing.
     * @param existingSymbols - symbols that already have data (will be skipped)
     */
    async coldStart(existingSymbols: Set<string> = new Set()): Promise<MarketDataItem[]> {
        const allSymbols = Object.keys(TRACKED_SYMBOLS);
        const missingSymbols = allSymbols.filter(s => !existingSymbols.has(s));

        if (missingSymbols.length === 0) {
            console.log('[MarketData] All symbols have history. Skipping cold start.');
            return [];
        }

        console.log(`[MarketData] Cold start for ${missingSymbols.length}/${allSymbols.length} symbols...`);
        const allItems: MarketDataItem[] = [];

        for (const symbol of missingSymbols) {
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
