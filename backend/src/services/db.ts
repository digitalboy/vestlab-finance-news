import { NewsItem } from '../types';

export class DBService {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async urlExists(url: string): Promise<boolean> {
        const result = await this.db.prepare(
            'SELECT 1 FROM news WHERE url = ? LIMIT 1'
        ).bind(url).first();
        return !!result;
    }

    async saveNews(news: NewsItem): Promise<string | null> {
        const id = crypto.randomUUID();
        console.log(`Saving news: ${news.title} (${news.url})`);
        try {
            await this.db.prepare(
                `INSERT INTO news (id, source, title, url, published_at, author, image_url, tags, description, raw_content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                id,
                news.source,
                news.title,
                news.url,
                news.published_at,
                news.author || null,
                news.image_url || null,
                news.tags || null,
                news.description || null,
                news.raw_content || null
            ).run();

            return id;
        } catch (e) {
            console.error('Error saving news:', e);
            return null;
        }
    }

    async saveTranslation(translation: any): Promise<void> {
        const id = crypto.randomUUID();
        try {
            await this.db.prepare(
                `INSERT INTO translations (id, news_id, language, title, content) VALUES (?, ?, ?, ?, ?)`
            ).bind(
                id,
                translation.news_id,
                translation.language,
                translation.title,
                translation.content
            ).run();
        } catch (e) {
            console.log(`Translation for news ${translation.news_id} (${translation.language}) might already exist.`);
        }
    }

    async getRecentNewsWithoutTranslation(language: string = 'zh', limit: number = 20): Promise<NewsItem[]> {
        const query = `
        SELECT n.* FROM news n
        LEFT JOIN translations t ON n.id = t.news_id AND t.language = ?
        WHERE t.id IS NULL
        AND n.crawled_at > datetime('now', '-24 hours')
        ORDER BY n.published_at DESC
        LIMIT ?
      `;
        const { results } = await this.db.prepare(query).bind(language, limit).all<NewsItem>();
        return results;
    }

    async getLatestNews(limit: number = 50): Promise<any[]> {
        const query = `
      SELECT n.*, t.title as translated_title, t.content as translated_content
      FROM news n
      LEFT JOIN translations t ON n.id = t.news_id AND t.language = 'zh'
      ORDER BY n.published_at DESC
      LIMIT ?
    `;
        const { results } = await this.db.prepare(query).bind(limit).all();
        return results;
    }

    async getNewsByDate(date: string): Promise<any[]> {
        const query = `
      SELECT n.*, t.title as translated_title, t.content as translated_content
      FROM news n
      LEFT JOIN translations t ON n.id = t.news_id AND t.language = 'zh'
      WHERE DATE(n.published_at) = ? OR DATE(n.crawled_at) = ?
      ORDER BY n.published_at DESC
    `;
        const { results } = await this.db.prepare(query).bind(date, date).all();
        return results;
    }

    async getDailySummary(date: string): Promise<string | null> {
        const result = await this.db.prepare(
            'SELECT content FROM daily_summaries WHERE date = ?'
        ).bind(date).first<{ content: string }>();
        return result ? result.content : null;
    }

    async saveDailySummary(date: string, content: string): Promise<void> {
        await this.db.prepare(
            'INSERT OR REPLACE INTO daily_summaries (date, content) VALUES (?, ?)'
        ).bind(date, content).run();
    }
}
