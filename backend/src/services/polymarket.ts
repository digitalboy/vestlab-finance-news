
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
        // const params = new URLSearchParams({ ... }); // Not used directly in loop below

        // We will fetch a few specific key tags in parallel to get a good mix
        const tags = ['fed-rates', 'inflation', 'recession', 'economy', 'geopolitics', 'finance', 'commodities'];
        const results: any[] = [];
        const seenIds = new Set<string>();

        // Limit concurrency if needed, but 5 requests is fine for Worker
        await Promise.all(tags.map(async (tag) => {
            try {
                // Fetch active markets only (closed=false)
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

                return {
                    id: m.id,
                    question: m.question,
                    groupItemTitle: m.groupItemTitle,
                    outcomes: formattedOutcomes,
                    volume: m.volume || 0
                };
            }).filter((m: any) => m !== null);

            // Sort markets within the event:
            // 1. Prefer markets with "Yes" outcome
            // 2. Sort by "Yes" probability descending
            simplifiedMarkets.sort((a: any, b: any) => {
                const getScore = (m: any) => {
                    const yes = m.outcomes.find((o: any) => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
                    if (yes) return yes.probability;
                    // Fallback to max probability if no "Yes" (but this might be "No", so be careful. 
                    // Better to just use volume if no clear positive outcome
                    return -1;
                };

                const scoreA = getScore(a);
                const scoreB = getScore(b);

                if (scoreA !== -1 && scoreB !== -1) {
                    return scoreB - scoreA; // Descending probability
                }
                return (b.volume || 0) - (a.volume || 0); // Fallback to volume
            });

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

    generateMarketSummaryForAI(markets: any[]): string {
        if (!markets || markets.length === 0) return '';

        let summary = '### 🎲 预测市场信号 (Polymarket Sentiment)\n';
        summary += 'From Polymarket (Betting on Future Events):\n\n';

        // Limit to top 8 most relevant/high volume
        const topMarkets = markets.slice(0, 8);

        for (const event of topMarkets) {
            summary += `**Event: ${event.title}**\n`;

            // If multiple markets (Group Event), sort by the probability of the "Yes" outcome
            // This ensures we show the most likely scenarios (e.g. "2 cuts", "3 cuts") rather than just high volume outliers
            const subMarkets = event.markets.map((m: any) => {
                const yesOutcome = m.outcomes.find((o: any) => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
                // If "Yes" exists, use its prob. If not, use volume as fallback.
                const score = yesOutcome ? yesOutcome.probability : -1;
                return { ...m, sortScore: score };
            }).sort((a: any, b: any) => {
                if (a.sortScore !== -1 && b.sortScore !== -1) return b.sortScore - a.sortScore;
                return b.volume - a.volume;
            }).slice(0, 5);

            for (const m of subMarkets) {
                let displayOutcomes = [];

                // Check if it's a standard Binary Yes/No market
                const yes = m.outcomes.find((o: any) => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
                const no = m.outcomes.find((o: any) => o.label === 'No' || o.label === 'Short' || o.label === 'Lower');

                if (yes && no && m.outcomes.length === 2) {
                    // Normalize: Always show "Yes" (or the positive side) to represent the event probability
                    // This solves the "Sometimes yes, sometimes no" confusion
                    displayOutcomes = [yes];
                } else {
                    // Multi-outcome (e.g. Candidates): Show top 2 by probability
                    displayOutcomes = [...m.outcomes].sort((a: any, b: any) => b.probability - a.probability).slice(0, 2);
                }

                const outcomeStr = displayOutcomes.map((o: any) => {
                    const prob = (o.probability * 100).toFixed(1);
                    let deltaStr = '';
                    if (o.isNew) {
                        deltaStr = ' (🆕 New)';
                    } else if (o.delta !== undefined) {
                        const sign = o.delta > 0 ? '+' : '';
                        const deltaPercent = (o.delta * 100).toFixed(1);
                        const emoji = o.delta > 0 ? '🔺' : (o.delta < 0 ? '🔻' : '');
                        if (o.delta === 0) deltaStr = ' (unchanged)';
                        else deltaStr = ` (${emoji}${sign}${deltaPercent}%)`;
                    }
                    return `${o.label}: ${prob}%${deltaStr}`;
                }).join(', ');

                // Include Question to disambiguate
                summary += `- Market: "${m.question}" -> [ ${outcomeStr} ]\n`;
            }
            summary += '\n';
        }

        console.log('[Polymarket] Generated AI Summary Preview:\n', summary);
        return summary;
    }

    /**
     * Compare current markets with historical data to compute deltas
     */
    compareWithHistory(currentMarkets: any[], historyItems: any[]): any[] {
        if (!historyItems || historyItems.length === 0) return currentMarkets;

        const historyMap = new Map<string, number>();
        // Key: market_id + outcome_label -> probability
        for (const item of historyItems) {
            historyMap.set(`${item.market_id}|${item.outcome_label}`, item.probability);
        }

        for (const event of currentMarkets) {
            for (const market of event.markets) {
                for (const outcome of market.outcomes) {
                    const key = `${market.id}|${outcome.label}`;
                    if (historyMap.has(key)) {
                        const prevProb = historyMap.get(key)!;
                        const diff = outcome.probability - prevProb;
                        // Avoid floating point noise
                        if (Math.abs(diff) > 0.001) {
                            outcome.delta = diff;
                        } else {
                            outcome.delta = 0;
                        }
                    } else {
                        outcome.isNew = true;
                    }
                }
            }
        }
        return currentMarkets;
    }

    /**
     * Flatten current markets for DB storage
     */
    prepareForStorage(markets: any[], date: string): any[] {
        const items: any[] = [];
        for (const event of markets) {
            for (const market of event.markets) {
                for (const outcome of market.outcomes) {
                    items.push({
                        id: `${market.id}-${outcome.label}-${date}`, // Unique ID per day
                        event_id: event.id,
                        market_id: market.id,
                        title: event.title + (market.groupItemTitle ? ` - ${market.groupItemTitle}` : ''),
                        outcome_label: outcome.label,
                        probability: outcome.probability,
                        volume: market.volume,
                        date: date
                    });
                }
            }
        }
        return items;
    }
}
