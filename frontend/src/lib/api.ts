import type { MarketDataResponse, NewsItem, DailySummaryResponse, PolymarketEvent } from './types'

const API_BASE = 'https://vestlab-finance-news-backend.digitalboyzone.workers.dev'

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

export async function fetchNews(limit = 80, query?: string): Promise<NewsItem[]> {
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit.toString())
    if (query) params.set('q', query)

    const res = await fetch(`${API_BASE}/api/news?${params.toString()}`)
    if (!res.ok) throw new Error(`News fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchMacroNews(limit = 20): Promise<NewsItem[]> {
    const res = await fetch(`${API_BASE}/api/macro-news?limit=${limit}`)
    if (!res.ok) throw new Error(`Macro news fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchMacroPredictions(): Promise<PolymarketEvent[]> {
    const res = await fetch(`${API_BASE}/api/polymarket/macro`)
    if (!res.ok) throw new Error(`Polymarket fetch failed: ${res.status}`)
    return res.json()
}
