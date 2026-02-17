
export type MarketCode = 'CN' | 'HK' | 'US';

// 2026 Holidays (YYYY-MM-DD)
// Source: Public Holiday Calendars for 2026 (Estimates/Official where available)
const HOLIDAYS_2026: Record<MarketCode, Set<string>> = {
    // A-Shares (CN) - SSE/SZSE
    // New Year: Jan 1
    // Spring Festival: Feb 16 (Eve) - Feb 22 (estimated)
    // Qingming: Apr 4-6
    // Labor Day: May 1-5
    // Dragon Boat: Jun 19
    // Mid-Autumn: Sep 25
    // National Day: Oct 1-7
    'CN': new Set([
        '2026-01-01',
        // Spring Festival (Lunar New Year is Feb 17)
        '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
        '2026-04-06', // Qingming (Apr 5 is Sunday)
        '2026-05-01', '2026-05-04', '2026-05-05', // Labor Day
        '2026-06-19', // Dragon Boat
        '2026-09-25', // Mid-Autumn
        '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07' // National Day
    ]),

    // Hong Kong (HK) - HKEX
    // Jan 1
    // Lunar New Year: Feb 17, 18, 19
    // Good Friday/Easter: Apr 3, 6
    // Qingming: Apr 4 (Sat) -> Apr 6 (Mon)? 
    // Labor Day: May 1
    // Buddha: May 25
    // Tuen Ng: Jun 19
    // HKSAR Day: Jul 1
    // National Day: Oct 1
    // Chung Yeung: Oct 19
    // Christmas: Dec 25, 26
    'HK': new Set([
        '2026-01-01',
        '2026-02-17', '2026-02-18', '2026-02-19', // LNY
        '2026-04-03', '2026-04-06', // Easter
        '2026-05-01', // Labor Day
        '2026-05-25', // Buddha
        '2026-06-19', // Tuen Ng
        '2026-07-01', // HKSAR
        '2026-10-01', // National
        '2026-10-19', // Chung Yeung
        '2026-12-25', '2026-12-26'
    ]),

    // US (NYSE/Nasdaq)
    // New Year: Jan 1
    // MLK: Jan 19
    // Washington: Feb 16
    // Good Friday: Apr 3
    // Memorial: May 25
    // Juneteenth: Jun 19
    // Independence: Jul 3 (Observed)
    // Labor: Sep 7
    // Thanksgiving: Nov 26
    // Christmas: Dec 25
    'US': new Set([
        '2026-01-01',
        '2026-01-19',
        '2026-02-16', // Presidents' Day
        '2026-04-03', // Good Friday
        '2026-05-25',
        '2026-06-19',
        '2026-07-03', // July 4 is Sat
        '2026-09-07',
        '2026-11-26',
        '2026-12-25'
    ])
};

export class MarketHolidayService {
    /**
     * Check if a specific date is a trading day for a market.
     * @param dateStr YYYY-MM-DD
     * @param market CN | HK | US
     */
    static isTradingDay(dateStr: string, market: MarketCode): boolean {
        const date = new Date(dateStr);
        const day = date.getUTCDay(); // 0=Sun, 6=Sat

        // Weekend check
        if (day === 0 || day === 6) return false;

        // Holiday check
        const holidays = HOLIDAYS_2026[market];
        if (holidays && holidays.has(dateStr)) return false;

        return true;
    }

    /**
     * Get trading status description for a date.
     * @param dateStr YYYY-MM-DD
     */
    static getGlobalMarketStatus(dateStr: string): string {
        const cn = this.isTradingDay(dateStr, 'CN') ? '开市' : '休市';
        const hk = this.isTradingDay(dateStr, 'HK') ? '开市' : '休市';
        const us = this.isTradingDay(dateStr, 'US') ? '开市' : '休市';

        // Check for specific holidays to add context
        let context = '';
        if (!this.isTradingDay(dateStr, 'CN')) {
            if (dateStr >= '2026-02-16' && dateStr <= '2026-02-22') context += '(CN: 春节假期)';
            else if (dateStr >= '2026-10-01' && dateStr <= '2026-10-07') context += '(CN: 国庆假期)';
        }
        if (!this.isTradingDay(dateStr, 'US')) {
            if (dateStr === '2026-02-16') context += '(US: 总统日)';
            else if (dateStr === '2026-11-26') context += '(US: 感恩节)';
            else if (dateStr === '2026-12-25') context += '(US: 圣诞节)';
        }

        return `A股: ${cn}, 港股: ${hk}, 美股: ${us} ${context}`;
    }
}
