import type { MarketDataResponse, NewsItem, DailySummaryResponse } from './types'

const API_BASE = 'https://vestlab-finance-news.digitalboyzone.workers.dev'

export async function fetchMarketData(): Promise<MarketDataResponse> {
    const res = await fetch(`${API_BASE}/api/market-data`)
    if (!res.ok) throw new Error(`Market data fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchDailySummary(date?: string): Promise<DailySummaryResponse> {
    const url = date
        ? `${API_BASE}/api/daily-summary?date=${date}`
        : `${API_BASE}/api/daily-summary`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Daily summary fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchNews(limit = 80): Promise<NewsItem[]> {
    const res = await fetch(`${API_BASE}/api/news?limit=${limit}`)
    if (!res.ok) throw new Error(`News fetch failed: ${res.status}`)
    return res.json()
}
