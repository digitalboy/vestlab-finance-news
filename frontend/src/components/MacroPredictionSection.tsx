import { useEffect, useState } from 'react'
import { fetchMacroPredictions } from '@/lib/api'
import type { PolymarketEvent } from '@/lib/types'
import { PredictionMarketCard } from './PredictionMarketCard'

export function MacroPredictionSection() {
    const [events, setEvents] = useState<PolymarketEvent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchMacroPredictions()
            .then(data => {
                // Take top 4 for display to save space
                setEvents(data.slice(0, 4))
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return null // or skeleton
    if (events.length === 0) return null

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    🎲 预测市场 (Polymarket)
                </span>
                <div className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {events.map(event => (
                    <PredictionMarketCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    )
}
