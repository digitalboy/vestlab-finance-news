
// using native fetch

async function fetchData() {
    try {
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=10&closed=false&tag_slug=finance&order=volume24hr&ascending=false");
        const data = await response.json();

        console.log(`Found ${data.length} events for tag 'finance'`);
        data.forEach(event => {
            console.log(`- ${event.title} (Vol: $${event.volume})`);
        });
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

fetchData();
