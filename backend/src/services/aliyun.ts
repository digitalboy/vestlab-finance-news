import { Env, MarketDataItem } from '../types';

const DASHSCOPE_ENDPOINT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const CLOUDFLARE_AI_GATEWAY = 'https://gateway.ai.cloudflare.com/v1/d06c9445a2675bdbf52fe47eab4f0278/beike/compat';

import { MarketHolidayService } from './holidays';

export class AliyunService {
    private aliyunKey: string;
    private googleKey: string;

    constructor(env: Env) {
        this.aliyunKey = env.ALIYUN_API_KEY;
        this.googleKey = env.GOOGLE_AI_KEY || '';
    }

    private getNextDay(dateStr: string): string {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }

    /**
     * Call Aliyun DashScope API (primary).
     */
    private async chatAliyun(prompt: string, model: string = 'qwen-plus-latest'): Promise<string> {
        const url = `${DASHSCOPE_ENDPOINT}/chat/completions`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.aliyunKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Aliyun API error: ${response.status} - ${errorBody}`);
        }

        const data: any = await response.json();
        return data?.choices?.[0]?.message?.content || '';
    }

    /**
     * Call Gemini via Cloudflare AI Gateway (fallback).
     */
    private async chatGemini(prompt: string, model: string = 'google-ai-studio/gemini-2.5-flash'): Promise<string> {
        if (!this.googleKey) {
            throw new Error('Google AI key not configured');
        }
        const url = `${CLOUDFLARE_AI_GATEWAY}/chat/completions`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.googleKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
        }

        const data: any = await response.json();
        return data?.choices?.[0]?.message?.content || '';
    }

    /**
     * Smart chat: Aliyun primary → content blocked → fallback to Gemini.
     */
    private async chat(prompt: string): Promise<string | null> {
        try {
            return await this.chatAliyun(prompt);
        } catch (error: any) {
            const errMsg = error?.message || '';
            // Content moderation blocked by Aliyun
            if (errMsg.includes('data_inspection_failed') || errMsg.includes('inappropriate content')) {
                console.warn('Aliyun content blocked, falling back to Gemini...');
                try {
                    return await this.chatGemini(prompt);
                } catch (geminiError) {
                    console.error('Gemini fallback also failed:', geminiError);
                    throw geminiError;
                }
            }
            throw error;
        }
    }

    async translateNews(title: string, content: string, source: string = '', targetLang: string = 'zh'): Promise<{ title: string, content: string } | null> {
        if (!this.aliyunKey) return null;

        const prompt = `你是一位专业的财经新闻翻译编辑。请将以下英文财经新闻翻译成中文。

**翻译准则**：
- 金融术语需使用地道的中文表达（如 Fed → 美联储，yield curve → 收益率曲线，M&A → 并购）
- 公司名保留英文原名，首次出现时可加中文注释（如 Cisco Systems（思科））
- 人名保留英文
- 数字、百分比、日期保持原样
- 标题要简洁有力，适合新闻标题风格
- 内容要通顺专业，避免机翻痕迹

**返回格式**：仅返回一个 JSON 对象，包含 "title" 和 "content" 两个字段，不要返回任何其他内容。

**新闻来源**: ${source || '未知'}
**原文标题**: ${title}
**原文内容**: ${content}
`;
        try {
            const text = await this.chat(prompt);
            if (!text) return null;

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                return { title: text, content: '' };
            }

        } catch (error) {
            console.error('Error translating news:', error);
            return null;
        }
    }

    /**
     * Format market data into a readable block for prompt injection.
     */
    private formatMarketDataForPrompt(marketData: MarketDataItem[]): string {
        if (!marketData || marketData.length === 0) return '';

        // Beijing time today
        const now = new Date();
        const bjtToday = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

        const indices = marketData.filter(m => m.type === 'index');
        const commodities = marketData.filter(m => m.type === 'commodity');
        const bonds = marketData.filter(m => m.type === 'bond');
        const currencies = marketData.filter(m => m.type === 'currency');
        const stocks = marketData.filter(m => m.type === 'stock');

        const formatLine = (m: MarketDataItem) => {
            const sign = (m.change_amount ?? 0) >= 0 ? '+' : '';
            const price = m.price != null ? m.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
            const change = m.change_percent != null ? `${sign}${m.change_percent.toFixed(2)}%` : 'N/A';
            const dataDate = m.market_time ? m.market_time.split('T')[0] : '';
            const stale = dataDate && dataDate !== bjtToday ? ` [${dataDate} \u2014 \u975E\u4ECA\u65E5\u6570\u636E]` : '';
            return `- ${m.name} (${m.symbol}): ${price} (${change})${stale}`;
        };

        let block = '\n\ud83d\udcca **\u5168\u7403\u5e02\u573a\u6570\u636e\uff08\u6765\u81ea Yahoo Finance\uff09**\uff1a\n';
        block += '\u26a0\ufe0f \u4ee5\u4e0b\u6570\u636e\u4e3a\u771f\u5b9e\u5e02\u573a\u6570\u636e\uff0c\u8bf7\u5728\u62a5\u544a\u4e2d\u51c6\u786e\u5f15\u7528\uff0c\u4e0d\u8981\u7f16\u9020\u6216\u4fee\u6539\u6570\u5b57\u3002\u6807\u6ce8\u201c\u975e\u4eca\u65e5\u6570\u636e\u201d\u7684\u8868\u793a\u8be5\u5e02\u573a\u5f53\u65e5\u4f11\u5e02\uff0c\u6570\u636e\u4e3a\u6700\u8fd1\u4e00\u4e2a\u4ea4\u6613\u65e5\u7684\u3002\u8bf7\u81ea\u7136\u5730\u4f7f\u7528\u201c\u4e0a\u4e00\u4ea4\u6613\u65e5\u201d\u6765\u63cf\u8ff0\u8fd9\u4e9b\u5e02\u573a\u3002\n\n';

        const sections: { label: string; items: MarketDataItem[] }[] = [
            { label: '**主要指数：**', items: indices },
            { label: '**美元与汇率：**', items: currencies },
            { label: '**美债收益率：**', items: bonds },
            { label: '**大宗商品：**', items: commodities },
            { label: '**个股：**', items: stocks },
        ];

        for (const sec of sections) {
            if (sec.items.length > 0) {
                block += sec.label + '\n';
                for (const m of sec.items) block += formatLine(m) + '\n';
                block += '\n';
            }
        }

        return block;
    }

    async generateMarketReport(newsItems: any[], marketData: MarketDataItem[] = [], session: 'morning' | 'evening' = 'morning', macroContext: any[] = [], predictionMarketSummary: string = ''): Promise<string | null> {
        if (!this.aliyunKey || newsItems.length === 0) return null;

        const now = new Date();
        const bjt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const bjtDate = bjt.toISOString().split('T')[0];
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const dayOfWeek = weekdays[bjt.getUTCDay()];
        const isWeekend = bjt.getUTCDay() === 0 || bjt.getUTCDay() === 6;
        const tradingDayNote = isWeekend
            ? '（今天是周末，全球主要股市休市，数据为最近一个交易日的收盘数据。请勿使用“今日市场”类表述，应使用“上一交易日”或“本周”来描述。）'
            : '（今天是交易日）';

        const newsContext = newsItems.map((n, i) =>
            `${i + 1}. [${n.source || '未知'}] ${n.title}\n   ${n.description || ''}`
        ).join('\n\n');

        let macroBlock = '';
        if (macroContext && macroContext.length > 0) {
            const macroItems = macroContext.map((n, i) =>
                `- [${n.source}] (${n.published_at?.split('T')[0]}) ${n.title}\n  ${n.description || ''}`
            ).join('\n');

            macroBlock = `
【📅 近期宏观背景参考（过去7天）】
以下是近期发布的重要宏观分析（即时性较低但影响深远），请在解读今日市场波动时，结合这些背景信息（例如：如果今日美债收益率变动，是否与前几天的联储官员讲话有关？）：
${macroItems}
`;
        }

        const marketDataBlock = this.formatMarketDataForPrompt(marketData);

        const sessionLabel = session === 'morning' ? '晨报' : '晚报';
        const sessionEmoji = session === 'morning' ? '🌅' : '🌆';

        const sessionGuidance = session === 'morning'
            ? `本期为 **晨报**（北京时间 08:00 发布），重点覆盖：
- 隔夜美股完整交易日表现（三大指数、板块轮动、个股异动）
- 欧洲市场收盘情况
- 隔夜重大事件（美联储、经济数据、地缘政治等）
- 对今日亚太市场（A股、港股、日股）的开盘影响展望
- 美债收益率、美元指数、黄金原油等避险/风险资产的隔夜走势`
            : `本期为 **晚报**（北京时间 20:00 发布），重点覆盖：
- 今日亚太市场收盘总结（A股三大指数、港股恒指/科技指数、日经等）
- 今日亚太市场热点板块和重要个股
- 欧洲早盘动态（截至发稿时的走势）
- 美股盘前期货情绪和关键预期
- 今日国内政策、经济数据对市场的影响
- 人民币汇率、北向资金、南向资金等跨境资金流向`;

        const prompt = `你是 VestLab 的新闻分析工程师 David。今天是 ${bjtDate} ${dayOfWeek}（北京时间）。${tradingDayNote}
请基于以下市场数据和新闻，撰写一份面向中国投资者的 **每日全球市场${sessionLabel}**。

${sessionEmoji} **${sessionLabel}定位**：
${sessionGuidance}

新闻源涵盖两个维度：
1. **Spot News (即时新闻)**：过去24小时发生的市场动态。
2. **Macro Context (宏观背景)**：过去7天发布的重要政策/智库分析。

${marketDataBlock}

${predictionMarketSummary}

${macroBlock}

**今日即时新闻列表**（共 ${newsItems.length} 条）：
${newsContext}

**报告结构**（使用 Markdown 格式）：

## 📊 市场脉搏
用 2-3 句话概括${session === 'morning' ? '隔夜' : '今日'}全球市场整体情绪和核心主线。引用上方的真实指数数据。**请尝试结合“宏观背景”和“预测市场情绪”来解释今日的市场走势（如果有相关性）。**

## 🔥 焦点事件
挑选 3-5 条最重要的新闻深度解读，每条包含：
- 事件概述
- 对市场的影响
- 对中国投资者的启示

## 🎲 预测市场信号 (Smart Money Sentiment)
**请基于提供的 Polymarket 数据，专门撰写一段分析。**
- 总结当前市场对关键宏观事件（如降息、衰退）的共识概率。
- 比较这些概率与当前新闻/资产价格是否一致？（例如：如果股市大跌但降息概率上升，说明市场在定价衰退风险）。
- 如果没有提供预测市场数据，则跳过此部分。

## 📈 资产联动
引用上方的真实指数、美元指数、美债收益率和商品数据，分析各大类资产联动逻辑：${session === 'morning' ? '美股（分板块）→ 美债收益率变动 → 美元指数 → 黄金/原油 → 加密货币等' : 'A股（分板块）→ 港股 → 日股 → 人民币汇率 → 美元指数 → 黄金/原油等'}。重点分析美债收益率和美元指数变动对全球资产的传导机制。

## 🌍 地缘与政策
梳理可能影响市场的地缘政治动态和重要政策变化。如果有相关的宏观背景信息，请在此处引用。

## 🔮 ${session === 'morning' ? '今日关注' : '明日关注'}
列出${session === 'morning' ? '今日亚太交易日' : '明日或短期'}需要关注的事件/数据节点。

**要求**：
- 字数：800-1200字
- 语言：专业、客观、有洞见的中文
- 适当使用 emoji 增强可读性
- 站在全球视角，但突出对中国投资者的相关性
- 对于涉及中国的新闻（如中国汽车、贸易关系等），要特别深入分析
- **必须准确引用上方提供的市场数据，不要编造任何数字**
- 报告末尾署名：VestLab 新闻分析工程师 David，并注明日期 ${bjtDate} ${dayOfWeek}（${sessionLabel}）
`;

        try {
            return await this.chat(prompt);
        } catch (error) {
            console.error('Error generating market report:', error);
            return null;
        }
    }
}

