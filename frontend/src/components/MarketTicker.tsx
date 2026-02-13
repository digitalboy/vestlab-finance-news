import type { MarketDataItem } from '@/lib/types'

interface MarketTickerProps {
    data: MarketDataItem[]
}

export function MarketTicker({ data }: MarketTickerProps) {
    if (!data.length) {
        return (
            <div className="flex-1 flex items-center justify-center py-2.5">
                <span className="text-slate-500 text-sm">暂无市场数据</span>
            </div>
        )
    }

    const items = data.map((item, i) => (
        <div key={`${item.symbol}-${i}`} className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-surface-hover/50 transition-colors cursor-default group">
            <span className="text-slate-400 text-xs font-medium group-hover:text-slate-200 transition-colors">{item.name}</span>
            <span className="font-mono font-medium text-sm text-slate-200">
                {item.price != null ? item.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--'}
            </span>
            <span className={`font-mono text-xs ${(item.change_percent ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                {(item.change_percent ?? 0) >= 0 ? '▲' : '▼'}{' '}
                {item.change_percent != null ? Math.abs(item.change_percent).toFixed(2) : '--'}%
            </span>
        </div>
    ))

    return (
        <div className="flex-1 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface-alt to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface-alt to-transparent z-10" />
            <div className="flex">
                <div className="ticker-track flex items-center gap-6 py-2.5 px-4 whitespace-nowrap">
                    {items}
                    {/* Duplicate for seamless loop */}
                    {items}
                </div>
            </div>
        </div>
    )
}
