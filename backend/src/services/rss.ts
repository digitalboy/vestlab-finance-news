import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from '../types';

export class RSSService {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
    }

    /**
     * Normalize any date string to ISO 8601 UTC format.
     * Handles RFC 2822 (e.g. "Thu, 12 Feb 2026 08:39:36 GMT"),
     * ISO 8601, and other common RSS date formats.
     * Always returns UTC string like "2026-02-12T08:39:36.000Z".
     */
    private normalizeToUTC(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                console.warn(`Invalid date: "${dateStr}", using current time.`);
                return new Date().toISOString();
            }
            return date.toISOString();
        } catch {
            console.warn(`Failed to parse date: "${dateStr}", using current time.`);
            return new Date().toISOString();
        }
    }

    async fetchAndParse(sourceName: string, url: string): Promise<NewsItem[]> {
        try {
            console.log(`Fetching RSS from ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
            }

            const xmlText = await response.text();
            const feed = this.parser.parse(xmlText);

            const items = feed.rss?.channel?.item || [];
            const newsItems: NewsItem[] = [];

            // Handle single item vs array
            const itemArray = Array.isArray(items) ? items : [items];

            for (const item of itemArray) {
                const title = item.title;
                const link = item.link;

                // Normalize pubDate to UTC ISO 8601
                const pubDate = item.pubDate
                    ? this.normalizeToUTC(item.pubDate)
                    : new Date().toISOString();

                // Media/Image
                let imageUrl: string | undefined = undefined;
                if (item['media:content'] && item['media:content']['@_url']) {
                    imageUrl = item['media:content']['@_url'];
                } else if (item['media:thumbnail'] && item['media:thumbnail']['@_url']) {
                    imageUrl = item['media:thumbnail']['@_url'];
                }

                // Author/Creator - handle single or multiple authors
                let author: string | undefined = undefined;
                const creator = item['dc:creator'];
                if (creator) {
                    author = Array.isArray(creator) ? creator.join(', ') : creator;
                }

                // Tags/Categories
                let tags: string | undefined = undefined;
                if (item.category) {
                    const cat = Array.isArray(item.category)
                        ? item.category.join(',')
                        : item.category;
                    tags = typeof cat === 'string' ? cat : JSON.stringify(cat);
                }

                if (title && link) {
                    newsItems.push({
                        source: sourceName,
                        title,
                        url: link,
                        published_at: pubDate,
                        description: item.description,
                        author,
                        image_url: imageUrl,
                        tags
                    });
                }
            }

            return newsItems;
        } catch (error) {
            console.error(`Error parsing RSS from ${sourceName}:`, error);
            return [];
        }
    }
}
