const symbol = '^GSPC';
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

async function check() {
    console.log(`Fetching ${url}...`);
    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        if (!resp.ok) {
            console.error(`Error: ${resp.status}`);
            console.log(await resp.text());
            return;
        }
        const data = await resp.json();
        const result = data?.chart?.result?.[0];
        if (result) {
            console.log('Meta:', JSON.stringify(result.meta, null, 2));
        } else {
            console.log('No result found');
        }
    } catch (e) {
        console.error(e);
    }
}

check();
