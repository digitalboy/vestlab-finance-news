
// using native fetch

async function fetchData() {
    try {
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=5&closed=false&order=volume24hr&ascending=false");
        const data = await response.json();

        console.log(JSON.stringify(data[0], null, 2)); // Print the first event structure
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

fetchData();
