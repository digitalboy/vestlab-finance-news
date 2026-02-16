import type { PolymarketEvent } from '@/lib/types'

interface PredictionMarketCardProps {
    event: PolymarketEvent
}

export function PredictionMarketCard({ event }: PredictionMarketCardProps) {
    // Use the first market or the most relevant one for display if multiple exist
    // We prefer the one with highest volume if marketCount > 1, but backend already sorted markets by volume? 
    // Backend returns `markets` array. Let's show the top one.
    const market = event.markets[0]
    if (!market) return null

    const topOutcome = market.outcomes.reduce((prev, current) => (prev.probability > current.probability) ? prev : current)
    const isYesNo = market.outcomes.length === 2 && market.outcomes.some(o => o.label === 'Yes')

    return (
        <a
            href={`https://polymarket.com/event/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-xl bg-surface/50 border border-border-subtle hover:bg-surface-alt/50 transition-colors group"
        >
            <div className="flex items-start justify-between gap-3 relative">
                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-text-primary line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors">
                        {event.title}
                    </h4>

                    <div className="mt-2 flex items-center justify-between">
                        {isYesNo ? (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-medium">{topOutcome.label}</span>
                                <span className={`font-bold ${topOutcome.label === 'Yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(topOutcome.probability * 100).toFixed(0)}%
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-medium truncate max-w-[80px]">{topOutcome.label}</span>
                                <span className="font-bold text-indigo-400">{(topOutcome.probability * 100).toFixed(0)}%</span>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${isYesNo && topOutcome.label === 'No' ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                            style={{ width: `${topOutcome.probability * 100}%` }}
                        />
                    </div>
                </div>

                {/* Volume Badge or Icon */}
                <div className="shrink-0 text-[10px] text-slate-500 font-medium bg-slate-800/50 px-1.5 py-0.5 rounded">
                    ${(event.totalVolume / 1000000).toFixed(1)}M
                </div>
            </div>
        </a>
    )
}
