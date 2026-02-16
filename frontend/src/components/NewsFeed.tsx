import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Copy, Check } from 'lucide-react'
import type { NewsItem, SourceConfig } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { fetchNews } from '@/lib/api'

const SOURCE_CONFIG: Record<string, SourceConfig> = {
    'Bloomberg': { color: 'bg-badge-bloomberg', label: 'Bloomberg' },
    'WSJ Markets': { color: 'bg-badge-wsj-markets', label: 'WSJ Markets' },
    'WSJ Economy': { color: 'bg-badge-wsj-economy', label: 'WSJ Economy' },
    'WSJ World': { color: 'bg-badge-wsj-world', label: 'WSJ World' },
    'NYT Business': { color: 'bg-emerald-700', label: 'NYT Biz' },
    'NYT World': { color: 'bg-teal-700', label: 'NYT World' },
    'TechCrunch': { color: 'bg-[#00a562] text-white', label: 'TechCrunch' },
    'France 24 Business': { color: 'bg-[#003d7e] text-white', label: 'France 24 Biz' },
    'France 24 World': { color: 'bg-[#005eb8] text-white', label: 'France 24' },
    'BBC Business': { color: 'bg-[#bb1919] text-white', label: 'BBC Biz' },
    'The Economist': { color: 'bg-[#e3120b] text-white', label: 'Economist' },
    // Straits Times
    'ST Asia': { color: 'bg-[#2E3192] text-white', label: 'ST Asia' },
    'ST Business': { color: 'bg-[#2E3192] text-white', label: 'ST Biz' },
    'ST World': { color: 'bg-[#2E3192] text-white', label: 'ST World' },
    // CEPR
    'CEPR VoxEU': { color: 'bg-[#800000] text-white', label: 'VoxEU' },
    // Gov
    'Fed Board': { color: 'bg-[#003057] text-white', label: 'Fed' },
    'St Louis Fed Blog': { color: 'bg-[#004c4c] text-white', label: 'STL Blog' },
    'St Louis Fed Open Vault': { color: 'bg-[#006666] text-white', label: 'STL Vault' },
}

function getSourceConfig(source: string): SourceConfig {
    return SOURCE_CONFIG[source] || { color: 'bg-slate-600', label: source }
}

export function NewsFeed() {
    const [allNews, setAllNews] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)
    const [source, setSource] = useState('all')
    const [search, setSearch] = useState('')

    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    // Fetch news when query changes
    useEffect(() => {
        setLoading(true)
        fetchNews(80, debouncedSearch)
            .then(setAllNews)
            .catch(() => setAllNews([]))
            .finally(() => setLoading(false))
    }, [debouncedSearch])

    const filtered = useMemo(() => {
        let list = allNews
        if (source !== 'all') {
            list = list.filter(n => n.source === source)
        }
        // Client-side search filtering removed in favor of server-side
        return list
    }, [allNews, source])

    return (
        <section className="lg:w-[40%] flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-amber-500 rounded-full" />
                    <h2 className="text-xl font-bold text-white">新闻列表</h2>
                    <span className="text-xs text-slate-500 bg-surface px-2 py-0.5 rounded-full">
                        {filtered.length}
                    </span>
                </div>
                <select
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    className="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                    <option value="all">全部来源</option>
                    <option value="Bloomberg">Bloomberg</option>
                    <option value="WSJ Markets">WSJ Markets</option>
                    <option value="WSJ Economy">WSJ Economy</option>
                    <option value="WSJ World">WSJ World</option>
                    <option value="NYT Business">NYT Business</option>
                    <option value="NYT World">NYT World</option>
                    <option value="TechCrunch">TechCrunch</option>
                    <option value="France 24 Business">France 24 Business</option>
                    <option value="France 24 World">France 24 World</option>
                    <option value="BBC Business">BBC Business</option>
                    <option value="The Economist">The Economist</option>
                    <option value="ST Asia">ST Asia</option>
                    <option value="ST Business">ST Business</option>
                    <option value="ST World">ST World</option>
                    <option value="CEPR VoxEU">CEPR VoxEU</option>
                    <option value="Fed Board">Fed Board</option>
                    <option value="St Louis Fed Blog">STL Blog</option>
                    <option value="St Louis Fed Open Vault">STL Open Vault</option>
                </select>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder="搜索新闻标题..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-surface border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
            </div>

            {/* News List */}
            <div className="flex flex-col gap-3 custom-scroll max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface rounded-xl border border-border-subtle p-4 space-y-3">
                                <div className="skeleton h-3 w-20" />
                                <div className="skeleton h-5 w-full" />
                                <div className="skeleton h-3 w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <div className="text-3xl mb-2">🔍</div>
                        <p className="text-sm">没有找到匹配的新闻</p>
                    </div>
                ) : (
                    filtered.map(item => <NewsCard key={item.id} item={item} />)
                )}
            </div>
        </section>
    )
}

function NewsCard({ item }: { item: NewsItem }) {
    const cfg = getSourceConfig(item.source)
    const title = item.translated_title || item.title
    const subtitle = item.translated_title ? item.title : ''
    const desc = item.translated_content || item.description || ''
    const time = timeAgo(item.published_at)
    const [copied, setCopied] = useState(false)

    const copyAsMarkdown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const parts = [
            `**${title}**`,
            subtitle ? `*${subtitle}*` : '',
            desc ? `\n${desc}` : '',
            `\n> 来源：${item.source} · [原文链接](${item.url})`,
        ].filter(Boolean)
        navigator.clipboard.writeText(parts.join('\n')).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [title, subtitle, desc, item.source, item.url])

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface rounded-xl border border-border-subtle p-4 hover:bg-surface-hover hover:border-slate-600 transition-all duration-200 group cursor-pointer relative"
        >
            <div className="flex items-center gap-2 mb-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white ${cfg.color}`}>
                    {cfg.label}
                </span>
                <span className="text-[11px] text-slate-500">{time}</span>
                <button
                    onClick={copyAsMarkdown}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                    title="复制为 Markdown"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                </button>
            </div>
            <h3 className="text-[15px] font-medium text-slate-200 group-hover:text-white transition-colors leading-snug mb-1.5 line-clamp-2">
                {title}
            </h3>
            {subtitle && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-1 mb-1.5">{subtitle}</p>
            )}
            {desc && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{desc}</p>
            )}
        </a>
    )
}
