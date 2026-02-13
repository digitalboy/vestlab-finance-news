# VestLab Finance News Backend

## 项目概述 (Project Overview)

这是一个基于 Cloudflare Workers 的后端项目，旨在自动获取、总结并存储财经新闻。

主要功能是从 Bloomberg 和 Wall Street Journal (WSJ) 获取 RSS 新闻源，利用阿里云 AI 模型 (Qwen-plus) 进行内容总结，并将原始数据及总结存储在 Cloudflare D1 数据库 (Shared: `note-to-audio-db`) 中。

## 技术栈 (Tech Stack)

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (Shared: `note-to-audio-db`)
- **AI Service**: Aliyun Qwen-plus
- **Data Source**: RSS Feeds (Bloomberg, WSJ)
- **Language**: TypeScript

## 核心功能 (Core Features)

1.  **新闻抓取 (News Fetching)**
    - 定时任务: 每 15 分钟 (`*/15 * * * *`)。
    - 解析 Bloomberg 和 WSJ 的 RSS feed。
    - 去重: 基于 URL 去重。

2.  **智能总结 (AI Summarization)**
    - **Trigger**: 每天 21:30 UTC (美股收盘后)。
    - **Logic**: 聚合过去 24 小时的新闻，生成一份**每日市场总结报告 (Daily Market Report)**。
    - **Storage**: 存入 `daily_summaries` 表。

3.  **数据存储 (Data Storage)**
    - `news` 表: 存储新闻详情。
    - `daily_summaries` 表: 存储每日市场报告。
    - `translations` 表: 存储标题/简介的中文翻译。

## API 文档 (API Documentation)

详细接口说明请参考 [docs/api.md](./api.md)。

## 部署步骤 (Deployment)

1. **安装依赖**:
    ```bash
    npm install
    ```

2. **配置密钥**:
    ```bash
    npx wrangler secret put ALIYUN_API_KEY
    ```

3. **数据库迁移 (Remote)**:
    ```bash
    npx wrangler d1 migrations apply DB --remote
    ```
    *(This applies the consolidated migration 0011)*

4. **部署**:
    ```bash
    npx wrangler deploy
    ```

## 本地开发 (Local Development)

- 启动开发服务器:
    ```bash
    npm run dev
    ```
- 手动触发抓取 (Local): `http://localhost:8787/trigger-fetch`
- 手动触发总结 (Local): `http://localhost:8787/trigger-summary`
