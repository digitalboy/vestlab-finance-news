
import { MarketDataService } from './src/services/market';

async function test() {
    const service = new MarketDataService();
    console.log('Fetching quotes...');
    const data = await service.fetchQuotes(['^GSPC']);
    console.log(JSON.stringify(data, null, 2));
}

test();
