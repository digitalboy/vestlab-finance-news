import { useEffect, useState } from 'react'
import { fetchMacroPredictions } from '@/lib/api'
import type { PolymarketEvent } from '@/lib/types'
import { PredictionMarketCard } from './PredictionMarketCard'
import { Hexagon } from 'lucide-react'

export function MacroPredictionSection() {
    const [markets, setMarkets] = useState<PolymarketEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [fade, setFade] = useState(true)
    const [isPaused, setIsPaused] = useState(false)

    useEffect(() => {
        fetchMacroPredictions()
            .then(data => {
                // Keep top 15 markets
                setMarkets(data.slice(0, 15))
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    // Carousel Timer
    useEffect(() => {
        if (markets.length <= 5 || isPaused) return

        const interval = setInterval(() => {
            setFade(false) // Start fade out

            setTimeout(() => {
                setCurrentIndex((prev) => {
                    const next = prev + 5
                    return next >= markets.length ? 0 : next
                })
                setFade(true) // Fade in
            }, 500) // Wait for fade out to finish (500ms duration)

        }, 8000) // Rotate every 8 seconds

        return () => clearInterval(interval)
    }, [markets.length, isPaused])

    if (loading) return null
    if (markets.length === 0) return null

    const currentBatch = markets.slice(currentIndex, currentIndex + 5)

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 mb-3 px-1">
                <Hexagon className="w-4 h-4 text-indigo-500 animate-pulse" />
                <h2 className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-wider uppercase">
                    预测市场 (Polymarket)
                    <span className="ml-3 text-[10px] text-slate-500 normal-case font-normal">
                        Top 15 • Page {Math.floor(currentIndex / 5) + 1}/{Math.ceil(markets.length / 5)}
                    </span>
                </h2>
                <div className="h-px flex-1 bg-border-subtle/50 ml-4" />
            </div>

            <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                {currentBatch.map((event) => (
                    <PredictionMarketCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    )
}
