# 系统架构文档 (System Architecture)

## 1. 系统组件 (System Components)

### 1.1 Cloudflare Worker
- **Role**: 核心逻辑处理。
- **Functions**:
    - `scheduled()`: Cron 触发器，定期执行抓取任务。
    - `fetch()`: API 接口，供外部（或前端）查询。
    - RSS Parser: 解析 XML 数据。
    - AI Client: 调用阿里云通义千问 API。
    - DB Client: 操作 D1 数据库。

### 1.2 Cloudflare D1 (Database)
- **Role**: 持久化存储 (Shared Database: `note-to-audio-db`).
- **Tables**:
    - `news`
    - `summaries`
    - `translations` (New: Stores translated title/description)
    - `errors` (可选，记录抓取错误)

### 1.3 Aliyun AI Service
- **Role**: 文本摘要。
- **Model**: `qwen-plus`.
- **Protocol**: HTTP/HTTPS REST API.

## 2. 数据库设计 (Database Design)

```sql
-- News Table
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL, -- 'bloomberg', 'wsj'
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    published_at TIMESTAMP,
    author TEXT,
    image_url TEXT,
    tags TEXT, -- Comma separated
    description TEXT, -- RSS description
    raw_content TEXT, -- Full content (if scraped)
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Summaries Table
CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL,
    summary TEXT,
    model_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (news_id) REFERENCES news(id)
);
```

## 3. 数据流 (Data Flow)

1. **Triggers**:
    - **Fetch News**: Cron (`*/15 * * * *`).
    - **Summarize**: Cron (`30 21 * * *` - Daily 21:30 UTC).
2. **Fetch**: Worker fetches RSS XML from Bloomberg/WSJ.
3. **Parse**: Extract items (title, link, pubDate).
4. **Filter**: Check DB `news.url` to skip existing. Store new URLs.
5. **Summarize**:
   - Triggered by Daily Cron.
   - Query unsummarized news from DB (created in last 24h?).
   - Send content to Aliyun AI.
   - Store results in `summaries`.

## 4. API 设计 (API Design)

See [docs/api.md](./api.md) for detailed endpoint documentation.

- `GET /api/news`: List latest news.
- `GET /trigger-*`: Manual triggers for Cron tasks.
