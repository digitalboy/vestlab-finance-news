import type { PolymarketEvent } from '@/lib/types'

interface PredictionMarketCardProps {
    event: PolymarketEvent
}

export function PredictionMarketCard({ event }: PredictionMarketCardProps) {
    // Check if we have multiple markets (Group Event)
    const isGroupEvent = event.markets.length > 1

    // If group event, take top 3 markets (backend already sorts by probability High->Low)
    // PROBLEM: If we have many >99% markets (already happened), they clog the top 3.
    // SOLUTION: Filter out markets with >99% probability (boring) UNLESS all markets are >99%.

    let interestingMarkets = event.markets;
    if (isGroupEvent) {
        // Try to filter out "Done Deal" markets (prob > 0.99 or < 0.01 if binary?? No, backend sends Yes prob)
        // Backend sends "Yes" prob. So >0.99 means it basically happened.
        const activeMarkets = event.markets.filter(m => {
            const yes = m.outcomes.find((o: any) => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
            // If finding logic fails, keep it.
            if (!yes) return true;
            return yes.probability < 0.99;
        });

        // If we have active markets, use them. Otherwise fallback to all (e.g. everything is 100%)
        if (activeMarkets.length > 0) {
            interestingMarkets = activeMarkets;
        }
    }

    const displayMarkets = isGroupEvent ? interestingMarkets.slice(0, 3) : [event.markets[0]]

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

                    // Logic to prefer "Yes" or positive outcome
                    const yesOutcome = market.outcomes.find((o) => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher')
                    const noOutcome = market.outcomes.find((o) => o.label === 'No' || o.label === 'Short' || o.label === 'Lower')
                    const isBinary = yesOutcome && noOutcome && market.outcomes.length === 2

                    // If binary, ALWAYS show the positive outcome (Yes/Long/Higher)
                    // Otherwise, fall back to the highest probability one
                    let topOutcome = isBinary ? yesOutcome : market.outcomes.reduce((prev, current) => (prev.probability > current.probability) ? prev : current)

                    if (!topOutcome) topOutcome = market.outcomes[0]

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
                                    className={`h-full rounded-full ${isBinary
                                        ? (topOutcome === yesOutcome ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 opacity-80' : 'bg-gradient-to-r from-rose-700 to-rose-600 opacity-80')
                                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                        }`}
                                    style={{ width: `${topOutcome.probability * 100}%` }}
                                />
                            </div>

                            {/* Right: Probability */}
                            <div className="w-8 shrink-0 text-right font-mono text-xs">
                                <span className={`font-bold ${(isBinary && topOutcome === yesOutcome) ? 'text-emerald-600' :
                                    (isBinary && topOutcome === noOutcome) ? 'text-rose-600' :
                                        'text-indigo-400'
                                    }`}>
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
