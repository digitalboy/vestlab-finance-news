import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DBService } from './services/db';
import { RSSService } from './services/rss';
import { AliyunService } from './services/aliyun';
import { MarketDataService } from './services/market';
import { PolymarketService } from './services/polymarket';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS — allow all origins
app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
}));

// API Routes
app.get('/api/news', async (c) => {
    const db = new DBService(c.env.DB);
    const limit = Number(c.req.query('limit')) || 50;
    const query = c.req.query('q');

    if (query && query.trim().length > 0) {
        const news = await db.searchNews(query.trim(), limit);
        return c.json(news);
    }

    const news = await db.getLatestNews(limit);
    return c.json(news);
});

app.get('/api/daily-summary', async (c) => {
    const db = new DBService(c.env.DB);
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const session = c.req.query('session'); // 'morning' | 'evening' | undefined

    if (session) {
        const summary = await db.getDailySummary(date, session);
        return c.json({ date, session, summary: summary || 'No summary available.' });
    }

    // Return all summaries for the date
    const summaries = await db.getDailySummaries(date);
    if (summaries.length === 0) {
        return c.json({ date, summaries: [], summary: 'No summary available for this date.' });
    }
    return c.json({ date, summaries });
});

app.get('/api/market-data', async (c) => {
    const db = new DBService(c.env.DB);
    const date = c.req.query('date');
    const data = date
        ? await db.getMarketDataByDate(date)
        : await db.getLatestMarketData();
    return c.json({ count: data.length, data });
});

app.get('/api/macro-news', async (c) => {
    const db = new DBService(c.env.DB);
    const limit = Number(c.req.query('limit')) || 20;
    const news = await db.getRecentMacroNews(MACRO_SOURCES, 7, limit);
    return c.json(news);
});

app.get('/api/polymarket/macro', async (c) => {
    const service = new PolymarketService();
    const data = await service.getMacroMarkets();
    return c.json(data);
});

// Manual Triggers
app.get('/trigger-fetch', async (c) => {
    const db = new DBService(c.env.DB);
    const rss = new RSSService();
    // Manual trigger: fetch all batches
    for (let i = 0; i < 4; i++) {
        await fetchNews(db, rss, i);
    }
    return c.text('Fetch triggered for all batches');
});

app.get('/trigger-summary', async (c) => {
    const db = new DBService(c.env.DB);
    const ai = new AliyunService(c.env);

    // Auto-detect session if not provided
    let session = c.req.query('session') as 'morning' | 'evening';
    if (!session) {
        // Beijing Time
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const beijingTime = new Date(utc + (3600000 * 8));
        const hour = beijingTime.getHours();

        // Morning Briefing: 08:00 (so < 14:00 is Morning)
        // Evening Briefing: 20:00 (so >= 14:00 is Evening)
        // Simple cutoff: If it's past 2 PM, generate Evening. Else Morning.
        session = hour >= 14 ? 'evening' : 'morning';
        console.log(`[Trigger] Auto-detected session: ${session} (BJT Hour: ${hour})`);
    }

    // Manually trigger daily briefing for specified session
    await generateDailyBriefing(db, ai, session);

    // Also runs translation
    await generateTranslations(db, ai);

    return c.text(`${session === 'morning' ? '晨报' : '晚报'} generation triggered`);
});

app.get('/trigger-translation', async (c) => {
    const db = new DBService(c.env.DB);
    const ai = new AliyunService(c.env);
    await generateTranslations(db, ai);
    return c.text('Translation generation triggered');
});

app.get('/trigger-market-fetch', async (c) => {
    const db = new DBService(c.env.DB);
    const market = new MarketDataService();
    const result = await fetchMarketData(db, market, 0, 100);
    return c.json(result);
});

app.get('/trigger-polymarket-snapshot', async (c) => {
    const db = new DBService(c.env.DB);
    await savePolymarketSnapshot(db);
    return c.text('Polymarket snapshot triggered');
});

app.get('/', (c) => c.text('VestLab Finance News Worker (Hono)'));

// Export functions for Worker (fetch) and Cron (scheduled)
export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const db = new DBService(env.DB);
        const rss = new RSSService();
        const ai = new AliyunService(env);
        const market = new MarketDataService();

        console.log(`Cron triggered: ${event.cron}`);

        if (event.cron === '*/3 * * * *') {
            // Dynamic Batch Calculation
            const FEED_BATCH_SIZE = 2; // Fetch 2 feeds per run
            const totalBatches = Math.ceil(ALL_NEWS_SOURCES.length / FEED_BATCH_SIZE);

            // Use total minutes since epoch to ensure stable rotation regardless of hour boundaries
            // scheduledTime is in ms, divide by 60000 -> minutes
            const epochMinutes = Math.floor(event.scheduledTime / 60000);

            // Since triggers every 3 minutes, we step through batches: 0, 1, 2...
            // Note: epochMinutes % 3 should be 0 (if aligned), but we just want an incrementing index
            // (epochMinutes / 3) -> gives us the "run index"
            const runIndex = Math.floor(epochMinutes / 3);

            const batchIndex = runIndex % totalBatches;

            // Market Data Batching
            // Total symbols ~30. 
            // We want to fetch a small chunk each time to save CPU.
            // Batch size = 4 => ~8 batches => Full cycle in 24 mins.
            const MARKET_BATCH_SIZE = 4;
            // Market data run index (can be same as generic runIndex)
            const marketBatchIndex = Math.floor(epochMinutes / 3);

            console.log(`[Cron] News Batch: ${batchIndex}/${totalBatches} | Market Batch Index: ${marketBatchIndex}`);

            ctx.waitUntil(
                Promise.all([
                    fetchNews(db, rss, batchIndex),
                    // Check translations (reduced batch size)
                    generateTranslations(db, ai),
                    // Fetch subset of market data
                    fetchMarketData(db, market, marketBatchIndex, MARKET_BATCH_SIZE),
                ])
            );
        } else if (event.cron === '0 0 * * *') {
            // UTC 00:00 (BJT 08:00): Morning Briefing
            console.log('[Cron] Triggering Morning Briefing...');
            ctx.waitUntil(Promise.all([
                generateDailyBriefing(db, ai, 'morning'),
                savePolymarketSnapshot(db) // Save daily snapshot at start of day
            ]));
        } else if (event.cron === '0 12 * * *') {
            // UTC 12:00 (BJT 20:00): Evening Briefing
            console.log('[Cron] Triggering Evening Briefing...');
            ctx.waitUntil(generateDailyBriefing(db, ai, 'evening'));
        } else {
            console.log('Unknown cron trigger, running default fetch + translate');
            ctx.waitUntil(
                fetchNews(db, rss, 0).then(() => generateTranslations(db, ai))
            );
        }
    }
};

async function savePolymarketSnapshot(db: DBService) {
    try {
        console.log('[Cron] Saving Polymarket Snapshot...');
        const polymarket = new PolymarketService();
        const markets = await polymarket.getMacroMarkets();

        // Save current state with today's date (Beijing Time approx or UTC)
        // We use simple YYYY-MM-DD based on UTC for consistency in DB
        const today = new Date().toISOString().split('T')[0];

        const itemsToSave = polymarket.prepareForStorage(markets, today);
        if (itemsToSave.length > 0) {
            await db.savePredictionMarketHistory(itemsToSave);
        }
    } catch (e) {
        console.error('[Cron] Error saving Polymarket snapshot:', e);
    }
}

// --- Helper Functions ---

const ALL_NEWS_SOURCES = [
    // Group A: Markets & Business (High Priority)
    { name: 'WSJ Markets', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
    { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml?edition=uk' },
    { name: 'The Economist', url: 'https://www.economist.com/business/rss.xml' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'France 24 Business', url: 'https://www.france24.com/en/business-tech/rss' },

    // Group B: Economy & World (Macro)
    { name: 'WSJ Economy', url: 'https://feeds.content.dowjones.io/public/rss/socialeconomyfeed' },
    { name: 'WSJ World', url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews' },
    { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    { name: 'France 24 World', url: 'https://www.france24.com/en/rss' },

    // Group C: Asia Focus (Straits Times)
    { name: 'ST Asia', url: 'https://www.straitstimes.com/news/asia/rss.xml' },
    { name: 'ST Business', url: 'https://www.straitstimes.com/news/business/rss.xml' },
    { name: 'ST World', url: 'https://www.straitstimes.com/news/world/rss.xml' },

    // Group D: Think Tanks & Policies
    { name: 'CEPR VoxEU', url: 'https://cepr.org/rss/vox-content' },
    { name: 'Fed Board', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
    { name: 'Fed Monetary Policy', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml' },
    { name: 'Fed Speeches', url: 'https://www.federalreserve.gov/feeds/speeches.xml' },
    { name: 'Fed Testimony', url: 'https://www.federalreserve.gov/feeds/testimony.xml' },
    { name: 'Fed Rates (H.15)', url: 'https://www.federalreserve.gov/feeds/h15.xml' },
    { name: 'Fed Ind Prod (G.17)', url: 'https://www.federalreserve.gov/feeds/g17.xml' },
    { name: 'St Louis Fed Blog', url: 'https://www.stlouisfed.org/rss/page%20resources/publications/blog-entries' },
    // { name: 'St Louis Fed Open Vault', url: 'https://www.stlouisfed.org/rss/page%20resources/publications/open-vault-blog' },

    // Group E: Europe (ECB)
    { name: 'ECB Press & Policy', url: 'https://www.ecb.europa.eu/rss/press.html' },
    { name: 'ECB Blog', url: 'https://www.ecb.europa.eu/rss/blog.html' },
    { name: 'ECB Stat Press', url: 'https://www.ecb.europa.eu/rss/statpress.html' },

    // Group F: Exchanges
    { name: 'Nasdaq Exchange', url: 'https://ir.nasdaq.com/rss/news-releases.xml?items=15' },

    // Group G: International (BIS)
    { name: 'BIS Central Bankers', url: 'https://www.bis.org/doclist/cbspeeches.rss' },
    { name: 'BIS Management', url: 'https://www.bis.org/doclist/mgmtspeeches.rss' },
    { name: 'BIS Research', url: 'https://www.bis.org/doclist/reshub_papers.rss' },
];

async function fetchNews(db: DBService, rss: RSSService, batchIndex: number) {

    // Batch size = 2. Total ~24 sources.
    // Cycle: ~12 batches.
    const BATCH_SIZE = 2;
    const start = batchIndex * BATCH_SIZE;
    const end = start + BATCH_SIZE;

    // Ensure we don't go out of bounds (handle dynamic source count)
    if (start >= ALL_NEWS_SOURCES.length) {
        console.log(`[RSS] Batch ${batchIndex} is out of bounds (Total: ${ALL_NEWS_SOURCES.length}). Skipping.`);
        return;
    }

    const sources = ALL_NEWS_SOURCES.slice(start, end);

    console.log(`[RSS] Fetching Batch ${batchIndex} (${sources.length} sources)...`);

    for (const source of sources) {
        try {
            const items = await rss.fetchAndParse(source.name, source.url);
            console.log(`Fetched ${items.length} items from ${source.name}`);

            for (const item of items) {
                const exists = await db.urlExists(item.url);
                if (!exists) {
                    await db.saveNews(item);
                }
            }
        } catch (e) {
            console.error(`Error fetching ${source.name}:`, e);
        }
    }
}

async function fetchMarketData(db: DBService, market: MarketDataService, batchIndex: number, batchSize: number) {
    try {
        // Calculate sharding
        const allSymbols = Object.keys(market.getTrackedSymbols());

        // Simple modulo batching
        const totalBatches = Math.ceil(allSymbols.length / batchSize);
        const currentBatch = batchIndex % totalBatches;
        const start = currentBatch * batchSize;
        const end = start + batchSize;

        const targetSymbols = allSymbols.slice(start, end);

        // Check which symbols already have historical data (for cold start logic)
        // Note: For sharded fetch, we might just assume history exists or checks strictly for these.
        // To be safe, let's just do daily update for these symbols. 
        // Cold start (history backfill) is best done manually or via a separate trigger if missing.
        // But let's keep the check for robustness if it's cheap.

        console.log(`[MarketData] Batch ${currentBatch}/${totalBatches}: Fetching ${targetSymbols.length} symbols (${targetSymbols.join(', ')})`);

        const existingSymbols = await db.getSymbolsWithHistory();
        const missingInBatch = targetSymbols.filter(s => !existingSymbols.has(s));

        // If any symbols in this batch are missing history, run cold start for THEM only
        if (missingInBatch.length > 0) {
            console.log(`[MarketData] Cold start for ${missingInBatch.length} symbols...`);
            // Only cold start the missing ones in this batch
            // We need to expose a method to cold start specific list? 
            // market.coldStart accepts existingSymbols Set, so it filters automatically.
            // But we want to restrict it to `missingInBatch`.

            // Logic: we can just call fetchHistory for them manually here, or rely on market.fetchQuotes to be just quote.
            // market.coldStart() iterates all missing. We should probably just let it be or optimize.
            // Let's implement specific cold start for this batch manually to avoid scanning everything.

            const coldItems = [];
            for (const s of missingInBatch) {
                const history = await market.fetchHistory(s);
                coldItems.push(...history);
            }
            if (coldItems.length > 0) {
                await db.saveMarketDataBatch(coldItems);
            }
        }

        // Fetch latest quotes for this batch
        const quotes = await market.fetchQuotes(targetSymbols);
        const saved = await db.saveMarketDataBatch(quotes);
        return { action: 'batch_update', saved, symbols: targetSymbols };

    } catch (error) {
        console.error('[MarketData] Error fetching market data:', error);
        return { action: 'error', error: String(error) };
    }
}

const MACRO_SOURCES = [
    'Fed Board',
    'Fed Monetary Policy',
    'Fed Speeches',
    'Fed Testimony',
    'Fed Rates (H.15)',
    'Fed Ind Prod (G.17)',
    'St Louis Fed Blog',
    'St Louis Fed Open Vault',
    'ECB Press & Policy',
    'ECB Blog',
    'ECB Stat Press',
    'Nasdaq Exchange',
    'BIS Central Bankers',
    'BIS Management',
    'BIS Research',
    'CEPR VoxEU'
];

async function generateDailyBriefing(db: DBService, ai: AliyunService, session: 'morning' | 'evening' = 'morning') {
    const now = new Date();
    // Beijing Time (UTC+8) for Report Date/ID
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const reportDate = beijingTime.toISOString().split('T')[0];

    // News Query Date (UTC)
    // Morning (08:00 BJT = 00:00 UTC): Context is overnight (yesterday UTC)
    // Evening (20:00 BJT = 12:00 UTC): Context is today (today UTC)
    let newsDate = reportDate;
    if (session === 'morning') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000); // approx yesterday
        newsDate = yesterday.toISOString().split('T')[0];
    } else {
        newsDate = now.toISOString().split('T')[0];
    }

    const sessionLabel = session === 'morning' ? '晨报' : '晚报';
    console.log(`Checking ${sessionLabel} for ${reportDate} (News Date: ${newsDate})...`);

    const existing = await db.getDailySummary(reportDate, session);
    if (existing) {
        console.log(`${sessionLabel} already exists for ${reportDate}. Skipping.`);
        return;
    }

    console.log(`Generating ${sessionLabel}...`);

    // 1. Fetch Spot News (24h)
    const todayNews = await db.getNewsByDate(newsDate);
    console.log(`Found ${todayNews.length} spot news items for ${newsDate}`);

    if (todayNews.length === 0) {
        console.log(`No spot news found for ${newsDate}. Skipping report.`);
        return;
    }

    // 2. Fetch Macro Context (7 days)
    console.log('Fetching macro context...');
    const macroNews = await db.getRecentMacroNews(MACRO_SOURCES, 7, 5);
    console.log(`Found ${macroNews.length} macro context items.`);

    // 3. Fetch Market Data
    const marketData = await db.getLatestMarketData();
    console.log(`Found ${marketData.length} market data items for report.`);

    // 4. Fetch Prediction Markets (Polymarket) with History
    console.log('Fetching prediction markets...');
    const polymarket = new PolymarketService();
    const currentMarkets = await polymarket.getMacroMarkets();

    // Get history (yesterday) for delta
    // Approximate "yesterday" from report date
    const historyDate = new Date(new Date(reportDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const historyItems = await db.getPredictionMarketHistory(historyDate);
    console.log(`Found ${historyItems.length} historical prediction items from ${historyDate}`);

    const marketsWithHistory = polymarket.compareWithHistory(currentMarkets, historyItems);
    const predictionSummary = polymarket.generateMarketSummaryForAI(marketsWithHistory);

    // 5. Generate Report with Dual Context + Prediction
    const report = await ai.generateMarketReport(todayNews, marketData, session, macroNews, predictionSummary);

    if (report) {
        // Format: 2026-02-13 → 2026年02月13日
        const [y, m, d] = reportDate.split('-');
        const title = `# VestLab 财经新闻${sessionLabel}（${y}年${m}月${d}日）`;
        const fullReport = `${title}\n\n${report}`;
        await db.saveDailySummary(reportDate, session, fullReport);
        console.log(`${sessionLabel} saved for ${reportDate}.`);
    }
}

async function generateTranslations(db: DBService, ai: AliyunService) {
    console.log('Starting daily translation...');
    // OPTIMIZATION: Reduced batch size to 5 to save CPU/Time
    const newsItems = await db.getRecentNewsWithoutTranslation('zh', 5);
    console.log(`Found ${newsItems.length} items to translate.`);

    for (const news of newsItems) {
        if (!news.id) continue;
        const contentToTranslate = news.description || news.title;
        const result = await ai.translateNews(news.title, contentToTranslate, news.source || '', 'zh');

        if (result) {
            await db.saveTranslation({
                news_id: news.id,
                language: 'zh',
                title: result.title,
                content: result.content
            });
            console.log(`Generated translation for news #${news.id}`);
        }
    }
    console.log('Translation complete.');
}
