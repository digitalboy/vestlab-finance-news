const baseUrl = 'https://gamma-api.polymarket.com/events';

async function check() {
    // 1. Check specific slug provided by user
    const slug = 'how-many-fed-rate-cuts-in-2026';
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

        // Gamma API for slug returns an array
        const e = Array.isArray(data) ? data[0] : data;

        if (e) {
            console.log(`[${e.id}] ${e.title} (Closed: ${e.closed})`);
            e.markets.forEach(m => {
                console.log(`  Market ID: ${m.id}`);
                console.log(`  Question: ${m.question}`);
                const outcomes = JSON.parse(m.outcomes);
                const prices = JSON.parse(m.outcomePrices);

                // Combine outcome + price
                const combined = outcomes.map((o, i) => ({ label: o, price: prices[i] }));
                // Sort by price desc to see what the "top 2" logic would see
                combined.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

                console.log('  --- Top Outcomes (Sorted) ---');
                combined.forEach(item => {
                    console.log(`    ${item.label}: ${item.price}`);
                });
            });
        } else {
            console.log('No event found for slug');
        }
    } catch (e) { console.error(e); }
}

check();
