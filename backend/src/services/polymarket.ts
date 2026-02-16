
import { Env } from '../types';

export interface PolymarketEvent {
    id: string;
    title: string;
    description: string;
    slug: string;
    markets: PolymarketMarket[];
    creationDate: string;
}

export interface PolymarketMarket {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    outcomes: string; // JSON string "['Yes', 'No']"
    outcomePrices: string; // JSON string "['0.95', '0.05']"
    volume: number;
    active: boolean;
    closed: boolean;
    groupItemTitle?: string; // For grouped markets (e.g., "March", "April")
}

export class PolymarketService {
    private cache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Fetch macro-economic related events from Polymarket
     */
    async getMacroMarkets() {
        // Check cache
        const now = Date.now();
        if (this.cache.data.length > 0 && (now - this.cache.timestamp) < this.CACHE_TTL) {
            console.log('[Polymarket] Returning cached data');
            return this.cache.data;
        }

        console.log('[Polymarket] Fetching fresh data from API...');
        const markets = await this.fetchFromGamma();

        if (markets.length > 0) {
            this.cache.data = markets;
            this.cache.timestamp = now;
        }

        return markets;
    }

    private async fetchFromGamma(): Promise<any[]> {
        const baseUrl = 'https://gamma-api.polymarket.com/events';
        const params = new URLSearchParams({
            limit: '20', // Fetch top 20 relevant events
            closed: 'false',
            // We can't filter by multiple tags in one query easily with their API sometimes, 
            // but let's try broader queries or multiple if needed. 
            // For now, let's fetch based on "popular" or specific logic, or just filtered broad list.
            // Actually Gamma API allows filtering by tag_slug.
        });

        // We will fetch a few specific key tags in parallel to get a good mix
        const tags = ['fed-rates', 'inflation', 'recession', 'economy', 'geopolitics'];
        const results: any[] = [];
        const seenIds = new Set<string>();

        // Limit concurrency if needed, but 5 requests is fine for Worker
        await Promise.all(tags.map(async (tag) => {
            try {
                const url = `${baseUrl}?limit=5&closed=false&tag_slug=${tag}&order=volume24hr&ascending=false`;
                const resp = await fetch(url, {
                    headers: { 'User-Agent': 'VestLab-Finance-News/1.0' }
                });
                if (!resp.ok) {
                    console.error(`[Polymarket] Failed to fetch tag ${tag}: ${resp.status}`);
                    return;
                }
                const data: any[] = await resp.json();

                for (const event of data) {
                    if (!seenIds.has(event.id)) {
                        seenIds.add(event.id);
                        const processed = this.processEvent(event);
                        if (processed) results.push(processed);
                    }
                }
            } catch (e) {
                console.error(`[Polymarket] Error fetching tag ${tag}`, e);
            }
        }));

        // Sort by volume descending to show most popular first
        return results.sort((a, b) => b.totalVolume - a.totalVolume);
    }

    private processEvent(event: any): any {
        try {
            // Simplified structure for Frontend/AI
            // We only want the main market or the most liquid market in the event
            const markets = event.markets || [];
            if (markets.length === 0) return null;

            // Sort markets by volume to find the representative one
            // Or if it's a Group event (like "Fed Rates"), it might have multiple relevant markets (Mar, May, Jun...)
            // For simplicity, we pass all markets but might filter on frontend

            const simplifiedMarkets = markets.map((m: any) => {
                let outcomes = [];
                let prices = [];
                try {
                    outcomes = JSON.parse(m.outcomes || '[]');
                    prices = JSON.parse(m.outcomePrices || '[]');
                } catch (e) {
                    return null; // Skip malformed
                }

                // Format outcomes with prices
                const formattedOutcomes = outcomes.map((label: string, idx: number) => ({
                    label: label,
                    probability: parseFloat(prices[idx] || '0')
                }));

                // Sort by probability desc logic (optional, but keep original order usually makes sense for Yes/No)

                return {
                    id: m.id,
                    question: m.question,
                    groupItemTitle: m.groupItemTitle || m.question, // e.g. "March", "April" or "Yes"
                    outcomes: formattedOutcomes,
                    volume: m.volume || 0
                };
            }).filter((m: any) => m !== null);

            if (simplifiedMarkets.length === 0) return null;

            return {
                id: event.id,
                title: event.title,
                description: event.description,
                slug: event.slug,
                volume: event.volume || 0, // Event level volume
                markets: simplifiedMarkets,
                marketCount: simplifiedMarkets.length,
                totalVolume: event.volume || 0 // Use for sorting
            };
        } catch (e) {
            console.error('[Polymarket] Error processing event', event.id, e);
            return null;
        }
    }

    /**
     * Generate a text summary of key markets for AI injection
     */
    generateMarketSummaryForAI(markets: any[]): string {
        if (!markets || markets.length === 0) return '';

        let summary = '### \uD83C\uDFB2 \u9884\u6D4B\u5E02\u573A\u60C5\u7eea (Polymarket)\n';
        summary += '\u4EE5\u4E0B\u662F\u5F53\u524D\u70ED\u95E8\u5B8F\u89C2\u9884\u6D4B\u5E02\u573A\u7684\u5B9E\u65F6\u8D54\u7387\u6570\u636E\uFF08\u53CD\u6620\u201C\u806A\u660E\u94B1\u201D\u7684\u771F\u91D1\u767D\u94F6\u62BC\u6CE8\uFF09\uFF1A\n\n';

        // Limit to top 5-8 most relevant/high volume
        const topMarkets = markets.slice(0, 8);

        for (const event of topMarkets) {
            summary += `**${event.title}**: `;

            // Check if it's a "Group" event (like "Fed Rates 2024") with multiple sub-markets
            if (event.markets.length > 1) {
                // List top 3 sub-markets by volume within this event
                const subMarkets = event.markets.sort((a: any, b: any) => b.volume - a.volume).slice(0, 3);
                const details = subMarkets.map((m: any) => {
                    const topOutcome = m.outcomes.reduce((prev: any, current: any) => (prev.probability > current.probability) ? prev : current);
                    return `[${m.groupItemTitle || 'Main'} -> ${topOutcome.label}: ${(topOutcome.probability * 100).toFixed(1)}%]`;
                }).join(', ');
                summary += `${details}\n`;
            } else {
                // Single market
                const m = event.markets[0];
                const outcomeStr = m.outcomes.map((o: any) => `${o.label}: ${(o.probability * 100).toFixed(1)}%`).join(', ');
                summary += `${outcomeStr}\n`;
            }
        }

        return summary;
    }
}
