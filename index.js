import { createReadStream } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createInterface } from 'node:readline';

// Get the filename from process.argv
const fileName = process.argv[2];

// If no filename is provided, print an error and exit.
if (!fileName) {
    console.error('Please provide a filename. Usage: node index.js <filename>');
    process.exit(1);
};

// Read the file and parse it into an array of URLs (lines)

const readFile = async (file) => {
    const fileStream = createReadStream(file);

    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const urls = [];

    for await (const line of rl) {
        urls.push(line.trim());
    };

    return urls;
};

const urls = await readFile(fileName);

if (urls.length === 0) {
    console.error('The file is empty or contains no valid URLs.');
    process.exit(1);
};

console.log('🦅 Health Hawk is on the hunt...\n');

// Define the checkUrl function
const checkUrl = (url) => {
    // This function should return a Promise.
    return new Promise((resolve) => {

        const startTime = Date.now();

        // 1. Determine if the URL is http or https to choose the right module.
        const protocol = url.startsWith('https') ? https : url.startsWith('http') ? http : null;
        if (!protocol) {
            const duration = Date.now() - startTime;
            return resolve({ url, error: 'Invalid URL protocol', duration, success: false });
        };
        const parsedUrl = new URL(url);
        const options = {
            method: 'GET',
            headers: {
                Connection: 'close'
            }
        };

        // 2. Create the HTTP GET request.
        const req = protocol.request(parsedUrl, options, (res) => {
            let body = '';

            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                // 3. On response, consume the data and then resolve with a result object containing { url, status, duration, success }.
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    return resolve({ url, status: res.statusCode, duration, success: true });
                } else {
                    return resolve({ url, status: res.statusCode, duration, success: false });
                };
            });

            // res.on('error', (err) => {
            //     const duration = Date.now() - startTime;
            //     return resolve({ url, error: err.message, duration, success: false });
            // });
        });

         // 4. On error, resolve with a result object containing { url, error: err.message, duration, success: false }.
        req.on('error', (err) => {
            const duration = Date.now() - startTime;
            return resolve({ url, error: err.message, duration, success: false });
        });

        // 5. Set a timeout (req.setTimeout) to abort slow requests and trigger an error.
        req.setTimeout(5000, () => {
            req.destroy();
            const duration = Date.now() - startTime;
            resolve({ url, error: "Timeout", duration, success: false });
        });

        req.end();

    });
};

// TODO: Step 4 - The main async function
const runHealthCheck = async () => {
    let healthyCount = 0;
    const totalCount = urls.length;

    // 4a. Map the `urls` array to an array of Promises by calling checkUrl on each.
    const promises = urls.map(url => checkUrl(url));

    // 4b. Use Promise.allSettled to wait for all these promises to finish.
    const results = await Promise.allSettled(promises);

    // 4c. Loop through the settled results.
        // For each result, print a status (✅/❌), the URL, the status/error, and the duration.
        // Keep a count of healthy endpoints.
    results.forEach((result) => {
        if (result.status === 'fulfilled') {
            const { url, status, error, duration, success } = result.value;
            if (success) {
                healthyCount++;
                console.log(`✅ ${url} - Status: ${status} - Latency_ms: ${duration}ms`);
            } else {
                console.log(`❌ ${url} - Error/Status: ${error || status} - Latency_ms: ${duration}ms`);
            };
        } else {
            console.log(`❌ Promise rejected for an unknown reason.`);
        };
    });

    // 4d. Print a summary: "X/Y endpoints healthy."
    console.log(`\n🦅 Health Hawk Summary: ${healthyCount}/${totalCount} endpoints healthy.`);
    if (healthyCount === totalCount) {
        console.log('All systems operational! 🚀');
    } else if (healthyCount === 0) {
        console.log('All systems down! Immediate attention required! 🚨');
    } else {
        console.log('Some systems are experiencing issues. Please investigate. ⚠️');
    };

    return;
};

runHealthCheck();