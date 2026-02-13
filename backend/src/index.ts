import { Hono } from 'hono';
import { DBService } from './services/db';
import { RSSService } from './services/rss';
import { AliyunService } from './services/aliyun';
import { MarketDataService } from './services/market';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// API Routes
app.get('/api/news', async (c) => {
    const db = new DBService(c.env.DB);
    const limit = Number(c.req.query('limit')) || 50;
    const news = await db.getLatestNews(limit);
    return c.json(news);
});

app.get('/api/daily-summary', async (c) => {
    const db = new DBService(c.env.DB);
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const summary = await db.getDailySummary(date);
    return c.json({ date, summary: summary || 'No summary available for this date.' });
});

app.get('/api/market-data', async (c) => {
    const db = new DBService(c.env.DB);
    const date = c.req.query('date');
    const data = date
        ? await db.getMarketDataByDate(date)
        : await db.getLatestMarketData();
    return c.json({ count: data.length, data });
});

// Manual Triggers
app.get('/trigger-fetch', async (c) => {
    const db = new DBService(c.env.DB);
    const rss = new RSSService();
    await fetchNews(db, rss);
    return c.text('Fetch triggered');
});

app.get('/trigger-summary', async (c) => {
    const db = new DBService(c.env.DB);
    const ai = new AliyunService(c.env);

    // Manually trigger daily briefing
    await generateDailyBriefing(db, ai);

    // Also runs translation
    await generateTranslations(db, ai);

    return c.text('Daily Briefing (and Translation) generation triggered');
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
    const result = await fetchMarketData(db, market);
    return c.json(result);
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

        if (event.cron === '*/15 * * * *') {
            // Fetch news, then translate any untranslated items
            // Also fetch market data on each cycle
            ctx.waitUntil(
                Promise.all([
                    fetchNews(db, rss).then(() => generateTranslations(db, ai)),
                    fetchMarketData(db, market),
                ])
            );
        } else if (event.cron === '30 21 * * *') {
            // 21:30 UTC: Fetch latest market data, then generate daily briefing
            ctx.waitUntil(
                fetchMarketData(db, market).then(() => generateDailyBriefing(db, ai))
            );
        } else {
            console.log('Unknown cron trigger, running default fetch + translate');
            ctx.waitUntil(
                fetchNews(db, rss).then(() => generateTranslations(db, ai))
            );
        }
    }
};

// --- Helper Functions ---

async function fetchNews(db: DBService, rss: RSSService) {
    const sources = [
        { name: 'WSJ Markets', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
        { name: 'WSJ Economy', url: 'https://feeds.content.dowjones.io/public/rss/socialeconomyfeed' },
        { name: 'WSJ World', url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews' },
        { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' }
    ];

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

async function fetchMarketData(db: DBService, market: MarketDataService) {
    try {
        // Check which symbols already have historical data
        const existingSymbols = await db.getSymbolsWithHistory();
        const allSymbols = Object.keys(market.getTrackedSymbols());
        const missingCount = allSymbols.filter(s => !existingSymbols.has(s)).length;

        // If any symbols are missing history, run cold start for those
        if (missingCount > 0) {
            console.log(`[MarketData] ${missingCount}/${allSymbols.length} symbols need cold start...`);
            const historicalItems = await market.coldStart(existingSymbols);
            const saved = await db.saveMarketDataBatch(historicalItems);
            // Also fetch latest quotes after cold start
            const quotes = await market.fetchQuotes();
            const quoteSaved = await db.saveMarketDataBatch(quotes);
            return { action: 'cold_start', history_saved: saved, quotes_saved: quoteSaved, missing: missingCount };
        }

        // All symbols have history — just do daily update
        console.log('[MarketData] Fetching latest quotes...');
        const quotes = await market.fetchQuotes();
        const saved = await db.saveMarketDataBatch(quotes);
        return { action: 'daily_update', saved };
    } catch (error) {
        console.error('[MarketData] Error fetching market data:', error);
        return { action: 'error', error: String(error) };
    }
}

async function generateDailyBriefing(db: DBService, ai: AliyunService) {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking daily briefing for ${today}...`);

    const existing = await db.getDailySummary(today);
    if (existing) {
        console.log('Daily briefing already exists. Skipping.');
        return;
    }

    console.log('Generating daily briefing...');
    const todayNews = await db.getNewsByDate(today);
    console.log(`Found ${todayNews.length} news items for ${today}`);

    if (todayNews.length === 0) {
        console.log('No news found for today. Skipping report.');
        return;
    }

    // Fetch today's market data for the report
    const marketData = await db.getLatestMarketData();
    console.log(`Found ${marketData.length} market data items for report.`);

    const report = await ai.generateMarketReport(todayNews, marketData);

    if (report) {
        // Format: 2026-02-13 → 2026年02月13日
        const [y, m, d] = today.split('-');
        const title = `# VestLab 财经新闻综述（${y}年${m}月${d}日）`;
        const fullReport = `${title}\n\n${report}`;
        await db.saveDailySummary(today, fullReport);
        console.log('Daily briefing saved.');
    }
}

async function generateTranslations(db: DBService, ai: AliyunService) {
    console.log('Starting daily translation...');
    const newsItems = await db.getRecentNewsWithoutTranslation('zh', 20);

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
