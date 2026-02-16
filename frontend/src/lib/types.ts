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

export interface SummaryItem {
    session: 'morning' | 'evening'
    content: string
    created_at: string
}

export interface DailySummaryResponse {
    date: string
    session?: string
    summary?: string
    summaries?: SummaryItem[]
}

export type NewsSource = 'Bloomberg' | 'WSJ Markets' | 'WSJ Economy' | 'WSJ World' | 'NYT Business' | 'NYT World' | 'TechCrunch' | 'France 24 Business' | 'France 24 World' | 'BBC Business' | 'The Economist' | 'ST Asia' | 'ST Business' | 'ST World' | 'CEPR VoxEU' | 'Fed Board'
    | 'Fed Monetary Policy'
    | 'Fed Speeches'
    | 'Fed Testimony'
    | 'Fed Rates (H.15)'
    | 'Fed Ind Prod (G.17)'
    | 'St Louis Fed Blog'
    | 'St Louis Fed Open Vault'
    | 'ECB Press & Policy'
    | 'ECB Blog'
    | 'ECB Stat Press';

export interface SourceConfig {
    color: string
    label: string
}
