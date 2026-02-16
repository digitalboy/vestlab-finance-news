import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Copy, Check, Sun, Moon } from 'lucide-react'
import Markdown from 'react-markdown'
import { todayStr, formatDateCN } from '@/lib/utils'
import { fetchDailySummary } from '@/lib/api'
import type { SummaryItem } from '@/lib/types'

type Session = 'morning' | 'evening'

export function DailyBriefing() {
    const [selectedDate, setSelectedDate] = useState(todayStr())
    const [summaries, setSummaries] = useState<SummaryItem[]>([])
    const [activeSession, setActiveSession] = useState<Session>(() => {
        // Default: show morning before 14:00 BJT, evening after
        const hour = new Date().getHours()
        return hour < 14 ? 'morning' : 'evening'
    })
    const [loading, setLoading] = useState(true)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [calendarViewDate, setCalendarViewDate] = useState(new Date())
    const [copied, setCopied] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    const activeContent = summaries.find(s => s.session === activeSession)?.content || null
    const hasMorning = summaries.some(s => s.session === 'morning')
    const hasEvening = summaries.some(s => s.session === 'evening')

    const copyBriefing = useCallback(() => {
        if (!activeContent) return
        navigator.clipboard.writeText(activeContent).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [activeContent])

    const loadSummaries = useCallback(async (date: string) => {
        setLoading(true)
        try {
            const json = await fetchDailySummary(date)
            if (json.summaries && json.summaries.length > 0) {
                setSummaries(json.summaries)
            } else if (json.summary && !json.summary.includes('No summary')) {
                // Backward compat: single summary response
                setSummaries([{ session: 'morning', content: json.summary, created_at: '' }])
            } else {
                setSummaries([])
            }
        } catch {
            setSummaries([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadSummaries(selectedDate)
    }, [selectedDate, loadSummaries])

    // Auto-select first available tab when data loads
    useEffect(() => {
        if (summaries.length > 0) {
            const hasActive = summaries.some(s => s.session === activeSession)
            if (!hasActive) {
                setActiveSession(summaries[0].session)
            }
        }
    }, [summaries]) // eslint-disable-line react-hooks/exhaustive-deps

    // Close calendar on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)
            ) {
                setCalendarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const selectDate = (dateStr: string) => {
        setSelectedDate(dateStr)
        setCalendarOpen(false)
    }

    return (
        <section className="flex-1 flex flex-col gap-4 min-w-0 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-purple-600 rounded-full" />
                    <h2 className="text-xl font-bold text-white">AI 分析</h2>
                </div>

                {/* Calendar Trigger */}
                <div className="relative">
                    <button
                        ref={triggerRef}
                        onClick={() => {
                            setCalendarViewDate(new Date(selectedDate + 'T00:00:00'))
                            setCalendarOpen(prev => !prev)
                        }}
                        className="flex items-center gap-2 bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-surface-hover hover:border-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="font-mono text-sm">{formatDateCN(selectedDate)}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    {/* Calendar Popover */}
                    {calendarOpen && (
                        <div ref={popoverRef} className="absolute right-0 top-full mt-2 z-50">
                            <CalendarPopover
                                viewDate={calendarViewDate}
                                selectedDate={selectedDate}
                                onNavigate={(delta) => {
                                    const d = new Date(calendarViewDate)
                                    d.setMonth(d.getMonth() + delta)
                                    setCalendarViewDate(d)
                                }}
                                onSelect={selectDate}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Briefing Card */}
            <div className="bg-surface rounded-2xl border border-border-subtle overflow-hidden shadow-2xl shadow-black/20 flex-1 flex flex-col min-h-0">
                {/* Session Tabs */}
                {!loading && summaries.length > 0 && (
                    <div className="flex items-center border-b border-border-subtle shrink-0">
                        <button
                            onClick={() => setActiveSession('morning')}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${activeSession === 'morning'
                                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                                : hasMorning
                                    ? 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-surface-hover'
                                    : 'border-transparent text-slate-600 cursor-not-allowed'
                                }`}
                            disabled={!hasMorning}
                        >
                            <Sun className="w-4 h-4" />
                            <span>晨报</span>
                            {!hasMorning && <span className="text-[10px] text-slate-600 ml-1">—</span>}
                        </button>
                        <button
                            onClick={() => setActiveSession('evening')}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${activeSession === 'evening'
                                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                                : hasEvening
                                    ? 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-surface-hover'
                                    : 'border-transparent text-slate-600 cursor-not-allowed'
                                }`}
                            disabled={!hasEvening}
                        >
                            <Moon className="w-4 h-4" />
                            <span>晚报</span>
                            {!hasEvening && <span className="text-[10px] text-slate-600 ml-1">—</span>}
                        </button>
                        <div className="flex-1" />
                        {/* Copy button */}
                        {activeContent && (
                            <button
                                onClick={copyBriefing}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1 mr-3 rounded-lg hover:bg-surface-hover"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? '已复制' : '复制 MD'}
                            </button>
                        )}
                    </div>
                )}

                <div className="p-6 lg:p-8 prose-finance custom-scroll overflow-y-auto flex-1 min-h-0">
                    {loading ? (
                        <div className="space-y-4">
                            <div className="skeleton h-8 w-3/4" />
                            <div className="skeleton h-4 w-full" />
                            <div className="skeleton h-4 w-5/6" />
                            <div className="skeleton h-4 w-4/5" />
                            <div className="skeleton h-6 w-1/2 mt-6" />
                            <div className="skeleton h-4 w-full" />
                            <div className="skeleton h-4 w-3/4" />
                        </div>
                    ) : activeContent ? (
                        <Markdown>{activeContent}</Markdown>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="text-5xl mb-4">📭</div>
                            <h3 className="text-lg font-semibold text-slate-300 mb-2">暂无简报</h3>
                            <p className="text-sm text-slate-500 max-w-xs">
                                {selectedDate} 的{activeSession === 'morning' ? '晨报' : '晚报'}尚未生成，请稍后再来查看。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

// ─── Calendar Popover ───

interface CalendarPopoverProps {
    viewDate: Date
    selectedDate: string
    onNavigate: (delta: number) => void
    onSelect: (dateStr: string) => void
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function CalendarPopover({ viewDate, selectedDate, onNavigate, onSelect }: CalendarPopoverProps) {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const today = todayStr()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: React.ReactNode[] = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push(
            <div key={`prev-${i}`} className="calendar-day calendar-other-month">
                {daysInPrevMonth - i}
            </div>
        )
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const isFuture = dateStr > today
        const isSelected = dateStr === selectedDate
        const isToday = dateStr === today

        let cls = 'calendar-day'
        if (isFuture) cls += ' calendar-disabled'
        else if (isSelected) cls += ' calendar-selected'
        else if (isToday) cls += ' calendar-today'

        days.push(
            <div
                key={dateStr}
                className={cls}
                onClick={isFuture ? undefined : () => onSelect(dateStr)}
            >
                {d}
            </div>
        )
    }

    // Next month leading days
    const totalCells = firstDay + daysInMonth
    const remaining = (7 - (totalCells % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
        days.push(
            <div key={`next-${d}`} className="calendar-day calendar-other-month">{d}</div>
        )
    }

    return (
        <div className="bg-surface border border-border-subtle rounded-xl shadow-2xl shadow-black/40 p-4 w-[290px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={() => onNavigate(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-slate-400 hover:text-white">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-semibold text-slate-200">{year}年 {MONTH_NAMES[month]}</h3>
                <button onClick={() => onNavigate(1)} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-slate-400 hover:text-white">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="calendar-grid mb-1">
                {['日', '一', '二', '三', '四', '五', '六'].map(w => (
                    <div key={w} className="text-center text-[11px] font-medium text-slate-500 py-1">{w}</div>
                ))}
            </div>

            {/* Days */}
            <div className="calendar-grid">{days}</div>

            {/* Quick actions */}
            <div className="mt-3 pt-3 border-t border-border-subtle flex gap-2">
                <button
                    onClick={() => onSelect(todayStr())}
                    className="flex-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
                >
                    今天
                </button>
                <button
                    onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 1)
                        onSelect(d.toISOString().split('T')[0])
                    }}
                    className="flex-1 text-xs font-medium text-slate-400 hover:text-slate-300 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                >
                    昨天
                </button>
            </div>
        </div>
    )
}
