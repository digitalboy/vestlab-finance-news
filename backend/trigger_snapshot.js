const http = require('http');

console.log('Attempting to trigger snapshot...');

const req = http.request({
    hostname: 'vestlab-finance-news-backend.digitalboy.workers.dev',
    port: 443,
    path: '/trigger-polymarket-snapshot',
    method: 'GET',
    timeout: 5000
}, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`BODY: ${data}`);
    });
});

req.on('error', (e) => {
    console.error(`Request failed: ${e.message}`);
});

req.end();
