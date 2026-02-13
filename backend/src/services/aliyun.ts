import { Env } from '../types';

const DASHSCOPE_ENDPOINT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const CLOUDFLARE_AI_GATEWAY = 'https://gateway.ai.cloudflare.com/v1/d06c9445a2675bdbf52fe47eab4f0278/beike/compat';

export class AliyunService {
    private aliyunKey: string;
    private googleKey: string;

    constructor(env: Env) {
        this.aliyunKey = env.ALIYUN_API_KEY;
        this.googleKey = env.GOOGLE_AI_KEY || '';
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

    async generateMarketReport(newsItems: any[]): Promise<string | null> {
        if (!this.aliyunKey || newsItems.length === 0) return null;

        const utcDate = new Date().toISOString().split('T')[0];
        const newsContext = newsItems.map((n, i) =>
            `${i + 1}. [${n.source || '未知'}] ${n.title}\n   ${n.description || ''}`
        ).join('\n\n');

        const prompt = `你是 VestLab 的新闻分析工程师 David。今天的日期是 ${utcDate}（UTC）。请基于以下来自 WSJ 和 Bloomberg 的新闻，撰写一份面向中国投资者的 **每日全球市场简报**。

新闻源涵盖四个维度：
- **WSJ Markets**：美股、债券、大宗商品、投资趋势
- **WSJ Economy**：就业、通胀、房地产等宏观经济数据
- **WSJ World**：国际地缘政治、贸易关系、能源政策
- **Bloomberg Markets**：全球股市、央行政策、并购IPO、加密货币

**报告结构**（使用 Markdown 格式）：

## 📊 市场脉搏
用 2-3 句话概括今日全球市场整体情绪和核心主线。

## 🔥 焦点事件
挑选 3-5 条最重要的新闻深度解读，每条包含：
- 事件概述
- 对市场的影响
- 对中国投资者的启示

## 📈 资产联动
简述各大类资产表现联动：美股（分板块）、美债、美元、黄金、原油、加密货币等。

## 🌍 地缘与政策
梳理可能影响市场的地缘政治动态和重要政策变化。

## 🔮 明日关注
列出明日或短期需要关注的事件/数据节点。

**要求**：
- 字数：800-1200字
- 语言：专业、客观、有洞见的中文
- 适当使用 emoji 增强可读性
- 站在全球视角，但突出对中国投资者的相关性
- 对于涉及中国的新闻（如中国汽车、贸易关系等），要特别深入分析
- 报告末尾署名：VestLab 新闻分析工程师 David，并注明日期 ${utcDate}

**今日新闻列表**（共 ${newsItems.length} 条）：
${newsContext}
`;

        try {
            return await this.chat(prompt);
        } catch (error) {
            console.error('Error generating market report:', error);
            return null;
        }
    }
}
