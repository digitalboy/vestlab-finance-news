import type { PolymarketEvent } from '@/lib/types'

interface PredictionMarketCardProps {
    event: PolymarketEvent
}

export function PredictionMarketCard({ event }: PredictionMarketCardProps) {
    // Check if we have multiple markets (Group Event)
    const isGroupEvent = event.markets.length > 1

    // If group event, take top 3 markets (backend already sorts by volume)
    const displayMarkets = isGroupEvent ? event.markets.slice(0, 3) : [event.markets[0]]

    // Safety check
    if (displayMarkets.length === 0 || !displayMarkets[0]) return null

    return (
        <a
            href={`https://polymarket.com/event/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-xl bg-surface/50 border border-border-subtle hover:bg-surface-alt/50 transition-colors group flex flex-col h-full"
        >
            <h4 className="text-xs font-semibold text-text-primary line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors mb-2">
                {event.title}
            </h4>

            <div className={`flex-1 ${isGroupEvent ? 'space-y-2' : ''}`}>
                {displayMarkets.map((market) => {
                    if (!market) return null

                    const topOutcome = market.outcomes.reduce((prev, current) => (prev.probability > current.probability) ? prev : current)
                    const isYesNo = market.outcomes.length === 2 && market.outcomes.some(o => o.label === 'Yes')

                    // Determine the label to show on the left
                    // For group events: use the group title (e.g. "Feb 28")
                    // For single events: use the outcome label (e.g. "Trump", "Yes")
                    const label = isGroupEvent ? market.groupItemTitle : topOutcome.label

                    return (
                        <div key={market.id} className="flex items-center gap-3 h-5">
                            {/* Left: Label (Fixed Width for alignment) */}
                            <div className="w-20 shrink-0 text-right text-[10px] text-slate-400 font-mono truncate" title={label}>
                                {label}
                            </div>

                            {/* Middle: Progress Bar */}
                            <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${isYesNo
                                        ? (topOutcome.label === 'Yes' ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 opacity-80' : 'bg-gradient-to-r from-rose-700 to-rose-600 opacity-80')
                                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                        }`}
                                    style={{ width: `${topOutcome.probability * 100}%` }}
                                />
                            </div>

                            {/* Right: Probability */}
                            <div className="w-8 shrink-0 text-right font-mono text-xs">
                                <span className={`font-bold ${topOutcome.label === 'Yes' ? 'text-emerald-600' : topOutcome.label === 'No' ? 'text-rose-600' : 'text-indigo-400'}`}>
                                    {(topOutcome.probability * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer info */}
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="text-[10px] text-slate-500 font-medium">
                    ${(event.totalVolume / 1000000).toFixed(1)}M Vol
                </div>
                {/* Only show '+X more' if it's a group event with more than 3 markets */}
                {isGroupEvent && event.marketCount > 3 && (
                    <span className="text-[10px] text-indigo-400/80">
                        +{event.marketCount - 3} more
                    </span>
                )}
            </div>
        </a>
    )
}
