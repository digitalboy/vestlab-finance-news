import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DBService } from './services/db';
import { RSSService } from './services/rss';
import { AliyunService } from './services/aliyun';
import { MarketDataService } from './services/market';
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
    const session = (c.req.query('session') as 'morning' | 'evening') || 'morning';

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

        if (event.cron === '*/10 * * * *') {
            // Fetch news, then translate any untranslated items
            // Also fetch market data on each cycle
            // OPTIMIZATION: Split RSS fetching to stay within CPU limits
            // 10-min interval: 00(A), 10(B), 20(A), 30(B), 40(A), 50(B)
            const minute = new Date(event.scheduledTime).getUTCMinutes();
            const group = (minute % 20 < 10) ? 'A' : 'B';

            ctx.waitUntil(
                Promise.all([
                    fetchNews(db, rss, group).then(() => generateTranslations(db, ai)),
                    fetchMarketData(db, market),
                ])
            );
        } else if (event.cron === '0 0 * * *') {
            // UTC 00:00 (BJT 08:00): Morning briefing — covers US/EU close
            ctx.waitUntil(
                fetchMarketData(db, market).then(() => generateDailyBriefing(db, ai, 'morning'))
            );
        } else if (event.cron === '0 12 * * *') {
            // UTC 12:00 (BJT 20:00): Evening briefing — covers Asia close
            ctx.waitUntil(
                fetchMarketData(db, market).then(() => generateDailyBriefing(db, ai, 'evening'))
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

async function fetchNews(db: DBService, rss: RSSService, group: 'A' | 'B' | 'all' = 'all') {
    const allSources = [
        // Group A: Markets & Business (High Priority)
        { group: 'A', name: 'WSJ Markets', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
        { group: 'A', name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
        { group: 'A', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
        { group: 'A', name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },

        // Group B: Economy & World (Macro)
        { group: 'B', name: 'WSJ Economy', url: 'https://feeds.content.dowjones.io/public/rss/socialeconomyfeed' },
        { group: 'B', name: 'WSJ World', url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews' },
        { group: 'B', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    ];

    const sources = group === 'all'
        ? allSources
        : allSources.filter(s => s.group === group);

    console.log(`[RSS] Fetching group ${group} (${sources.length} sources)...`);

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
    const todayNews = await db.getNewsByDate(newsDate);
    console.log(`Found ${todayNews.length} news items for ${newsDate}`);

    if (todayNews.length === 0) {
        console.log(`No news found for ${newsDate}. Skipping report.`);
        return;
    }

    // Fetch today's market data for the report
    const marketData = await db.getLatestMarketData();
    console.log(`Found ${marketData.length} market data items for report.`);

    const report = await ai.generateMarketReport(todayNews, marketData, session);

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
    console.log('Starting daily translation...');
    // OPTIMIZATION: Reduce batch size to 5 to avoid CPU timeout
    const newsItems = await db.getRecentNewsWithoutTranslation('zh', 5);

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
