# API Documentation

## Base URL
Dependent on your Cloudflare Worker deployment (e.g., `https://vestlab-finance-news.<your-subdomain>.workers.dev`).

## Public Endpoints

### 1. Get Latest News
Retrieve a list of the latest news items, including summaries and translations (if available).

- **URL**: `/api/news`
- **Method**: `GET`
- **Query Parameters**:
    - `limit` (optional): Number of items to return. Default: 50.
- **Response**: JSON Array of `NewsItem`.

```json
[
  {
    "id": 1,
    "source": "Bloomberg",
    "title": "Example News Title",
    "url": "https://bloomberg.com/...",
    "published_at": "2026-02-12T10:00:00Z",
    "summary": "AI generated summary...",
    "translations": [
        { "language": "zh", "title": "...", "content": "..." } 
    ]
  }
]
```
*(Note: Current implementation returns flat structure or joined summary, future updates may nest translations).*

## Manual Triggers (Admin/Cron)

These endpoints are used to manually trigger scheduled tasks.

### 1. Trigger News Fetch
Manually fetch latest RSS feeds from WSJ and Bloomberg.

- **URL**: `/trigger-fetch`
- **Method**: `GET`
- **Response**: `Fetch triggered`

### 2. Trigger Summarization
Manually trigger AI summarization for unsummarized news (last 24h).
*Note: Also triggers translation in current unified logic.*

- **URL**: `/trigger-summary`
- **Method**: `GET`
- **Response**: `Summary (and Translation) generation triggered`

### 3. Trigger Translation
Manually trigger AI translation for untranslated news.

- **URL**: `/trigger-translation`
- **Method**: `GET`
- **Response**: `Translation generation triggered`
