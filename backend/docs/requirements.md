# 需求规格说明书 (Requirements Specification)

## 1. 引言 (Introduction)

本项目旨在构建一个自动化的财经新闻聚合与总结系统。

## 2. 功能需求 (Functional Requirements)

### 2.1 新闻源 (News Sources)
- [x] **WSJ**: `https://feeds.content.dowjones.io/public/rss/RSSMarketsMain`
- [x] **Bloomberg**: `https://feeds.bloomberg.com/markets/news.rss`
- [x] **更新频率**: 每 15 分钟 (`*/15 * * * *`)。

### 2.2 AI 总结 (AI Summarization)
- [x] **触发时机**: 每天一次，美股收盘 30 分钟后。
    - 策略: 设置 Cron 为 `30 21 * * *` (UTC 21:30)。
    - 冬令时 (EST): 收盘 21:00 UTC -> 触发 21:30 UTC (+30m).
    - 夏令时 (EDT): 收盘 20:00 UTC -> 触发 21:30 UTC (+90m).
    - 确保任何季节都在收盘后执行。
- [x] **模型选择**: 阿里云 Qwen-plus (通义千问 Plus)。
- [ ] **提示词 (Prompt)**: 需设计，例如“请总结这篇新闻对金融市场的影响”。
- [x] **字数限制**: 暂时不限制 (No output token limit).

### 2.3 数据库 (Database - Cloudflare D1)
- [x] **Shared Database**: 使用现有的 `note-to-audio-db` (ID: `dec8c4bf-98bd-4e9a-b32b-ba613d6f8b09`)。
- [x] **Schema 设计**:
    - `news` 表: `id`, `source`, `title`, `url`, `published_at`, `author`, `image_url`, `tags`, `description` (RSS summary), `raw_content` (Full text).
    - `summaries` 表: `id`, `news_id`, `summary_text`, `model_used`, `created_at`.
    - `translations` 表 (New): `id`, `news_id`, `language` (e.g., 'zh'), `title` (translated), `content` (translated description), `created_at`.
- [x] **去重策略**: 基于 URL 进行去重。

## 3. 非功能需求 (Non-Functional Requirements)

- **性能**: Cloudflare Worker 的执行时间限制 (CPU time)。
- **成本**: 阿里云 API 调用的成本控制。
- **可靠性**: 错误处理 (如 RSS 源不可用、AI 接口超时)。
- **密钥管理**: 使用 Cloudflare Secrets 存储敏感信息 (API Keys)。
- **前端**: 不需要前端，仅提供后端 API。

## 4. 待确认问题 (Open Questions)

1. **具体的 RSS 源地址是什么？** [Solved] WSJ & Bloomberg URLs confirmed.
2. **需要前端展示界面吗？还是仅作为 API 提供数据？** [Solved] 不需要前端 (Backend API only).
3. **阿里云 AI 的 Access Key/Secret 如何管理？** [Solved] Cloudflare Secrets.
4. **数据库保留策略**：[Solved] 永久保存 (Permanent).
