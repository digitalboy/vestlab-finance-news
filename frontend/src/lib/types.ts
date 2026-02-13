export interface MarketDataItem {
    symbol: string
    name: string
    type: string
    price: number | null
    change_amount: number | null
    change_percent: number | null
    day_high: number | null
    day_low: number | null
    previous_close: number | null
    market_time: string
    date: string
}

export interface MarketDataResponse {
    count: number
    data: MarketDataItem[]
}

export interface NewsItem {
    id: string
    source: string
    title: string
    url: string
    published_at: string
    description?: string
    translated_title?: string
    translated_content?: string
}

export interface DailySummaryResponse {
    date: string
    summary: string
}

export type NewsSource = 'Bloomberg' | 'WSJ Markets' | 'WSJ Economy' | 'WSJ World'

export interface SourceConfig {
    color: string
    label: string
}
