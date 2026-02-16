import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins} 分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} 天前`
    return date.toLocaleDateString('zh-CN')
}

export function todayStr(): string {
    // Return local date string YYYY-MM-DD
    const d = new Date()
    const offset = d.getTimezoneOffset() * 60000
    const localDate = new Date(d.getTime() - offset)
    return localDate.toISOString().split('T')[0]
}

export function formatDateCN(dateStr: string): string {
    const d = new Date(dateStr) // Use local time parsing usually, or append T00:00:00 to force local?
    // Actually dateStr is YYYY-MM-DD. new Date('YYYY-MM-DD') in JS is UTC.
    // We want to treat it as a local date.
    // Better: parse manually to avoid timezone shifts
    const [y, m, day] = dateStr.split('-').map(Number)

    const today = todayStr()
    if (dateStr === today) return `${m}月${day}日 · 今天`

    // Check yesterday
    const yestDate = new Date()
    yestDate.setDate(yestDate.getDate() - 1)
    const offset = yestDate.getTimezoneOffset() * 60000
    const localYest = new Date(yestDate.getTime() - offset).toISOString().split('T')[0]

    if (dateStr === localYest) return `${m}月${day}日 · 昨天`

    return `${y}年${m}月${day}日`
}
