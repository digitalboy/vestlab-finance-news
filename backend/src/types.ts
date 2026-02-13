export interface NewsItem {
    id?: string;
    source: string;
    title: string;
    url: string;
    published_at: string;
    author?: string;
    image_url?: string;
    tags?: string;
    description?: string;
    raw_content?: string;
    crawled_at?: string;
}

export interface TranslationItem {
    id?: string;
    news_id: string;
    language: string;
    title: string;
    content: string;
    created_at?: string;
}

export interface Env {
    DB: D1Database;
    ALIYUN_API_KEY: string;
    GOOGLE_AI_KEY?: string;
}
