import { useState, useEffect } from 'react'
import type { NewsItem } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { fetchMacroNews } from '@/lib/api'
import { MacroPredictionSection } from './MacroPredictionSection'

export function MacroFeed() {
    const [news, setNews] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchMacroNews(80)
            .then(setNews)
            .catch(() => setNews([]))
            .finally(() => setLoading(false))
    }, [])

    return (
        <section className="flex-1 flex flex-col gap-4 min-w-0 h-full">
            <MacroPredictionSection />

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-blue-600 rounded-full" />
                <h2 className="text-xl font-bold text-white">宏观背景</h2>
                <span className="text-xs text-slate-500 bg-surface px-2 py-0.5 rounded-full">
                    {news.length}
                </span>
            </div>

            {/* List */}
            <div className="flex-1 flex flex-col gap-3 custom-scroll overflow-y-auto pr-1 min-h-0">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-surface rounded-xl border border-border-subtle p-4 space-y-3">
                                <div className="skeleton h-3 w-20" />
                                <div className="skeleton h-5 w-full" />
                            </div>
                        ))}
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-sm">暂无宏观新闻</p>
                    </div>
                ) : (
                    news.map(item => <MacroCard key={item.id} item={item} />)
                )}
            </div>
        </section>
    )
}

function MacroCard({ item }: { item: NewsItem }) {
    const time = timeAgo(item.published_at)

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface/50 rounded-xl border border-border-subtle p-4 hover:bg-surface-hover hover:border-blue-500/50 transition-all duration-200 group cursor-pointer"
        >
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                    {item.source}
                </span>
                <span className="text-[11px] text-slate-500">{time}</span>
            </div>
            <h3 className="text-[14px] font-medium text-slate-300 group-hover:text-blue-200 transition-colors leading-snug mb-1.5">
                {item.translated_title || item.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {item.translated_content || item.description}
            </p>
        </a>
    )
}
