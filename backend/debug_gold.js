const baseUrl = 'https://gamma-api.polymarket.com/events';

async function check() {
    const slug = 'what-will-gold-gc-hit-by-end-of-february';
    console.log(`\n=== Checking Valid Slug: ${slug} ===`);
    try {
        const url = `${baseUrl}?slug=${slug}`;
        console.log(`Fetching ${url}...`);
        const resp = await fetch(url);
        if (!resp.ok) {
            console.error(`Error: ${resp.status}`);
            return;
        }
        const data = await resp.json();
        const e = Array.isArray(data) ? data[0] : data;

        if (e) {
            console.log(`[${e.id}] ${e.title} (Closed: ${e.closed})`);
            console.log(`End Date: ${e.endDate}`); // Check end date
            console.log(`Markets count: ${e.markets.length}`);

            // Simulate the simplified mapping in PolymarketService
            const simplifiedMarkets = e.markets.map(m => {
                let outcomes = [];
                let prices = [];
                try {
                    outcomes = JSON.parse(m.outcomes || '[]');
                    prices = JSON.parse(m.outcomePrices || '[]');
                } catch (e) { return null; }

                const formattedOutcomes = outcomes.map((label, idx) => ({
                    label: label,
                    probability: parseFloat(prices[idx] || '0')
                }));

                return {
                    id: m.id,
                    groupItemTitle: m.groupItemTitle, // Check this!
                    question: m.question,
                    outcomes: formattedOutcomes,
                    volume: m.volume || 0
                };
            });

            // Apply the EXACT sorting logic from PolymarketService
            simplifiedMarkets.sort((a, b) => {
                const getScore = (m) => {
                    const yes = m.outcomes.find(o => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
                    if (yes) return yes.probability;
                    return -1;
                };

                const scoreA = getScore(a);
                const scoreB = getScore(b);

                if (scoreA !== -1 && scoreB !== -1) {
                    return scoreB - scoreA;
                }
                return (b.volume || 0) - (a.volume || 0);
            });

            console.log('\n--- Processed & Sorted Markets ---');
            simplifiedMarkets.forEach((m, i) => {
                const yes = m.outcomes.find(o => o.label === 'Yes' || o.label === 'Long' || o.label === 'Higher');
                const prob = yes ? yes.probability : 'N/A';
                console.log(`#${i + 1} [${m.groupItemTitle || m.question}] Yes Prob: ${prob} (Vol: ${m.volume})`);
            });

        } else {
            console.log('No event found for slug');
        }
    } catch (e) { console.error(e); }
}

check();
