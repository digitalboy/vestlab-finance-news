import { useState, useEffect } from 'react'
import './index.css'
import { MarketTicker } from '@/components/MarketTicker'
import { DailyBriefing } from '@/components/DailyBriefing'
import { NewsFeed } from '@/components/NewsFeed'
import { MacroFeed } from '@/components/MacroFeed'
import { MacroPredictionSection } from '@/components/MacroPredictionSection'
import { fetchMarketData } from '@/lib/api'
import type { MarketDataItem } from '@/lib/types'

function App() {
  const [marketData, setMarketData] = useState<MarketDataItem[]>([])

  useEffect(() => {
    fetchMarketData()
      .then(res => setMarketData(res.data || []))
      .catch(() => setMarketData([]))
  }, [])

  return (
    <div className="bg-[#0a0f1a] text-slate-200 font-sans min-h-screen lg:h-screen flex flex-col lg:overflow-hidden">
      {/* ═══ Top Nav ═══ */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface-alt/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-2 border-r border-border-subtle shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-white tracking-tight">VestLab</span>
              <span className="text-[10px] text-slate-500 font-medium">Finance News</span>
            </div>
          </div>

          {/* Market Ticker */}
          <MarketTicker data={marketData} />
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 w-full px-4 lg:px-6 py-6 lg:overflow-hidden flex flex-col gap-6">

        {/* Prediction Markets Banner */}
        <MacroPredictionSection />

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 lg:grid-rows-1">
          {/* Col 1: High Frequency News */}
          <NewsFeed />

          {/* Col 2: Macro Context */}
          <MacroFeed />

          {/* Col 3: AI Summary */}
          <DailyBriefing />
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-border-subtle py-4 px-6 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            </svg>
          </div>
          <span>VestLab © 2026 · 全球财经新闻聚合</span>
        </div>
        <span>Data: Yahoo Finance · AI: Qwen / Gemini</span>
      </footer>
    </div>
  )
}

export default App
