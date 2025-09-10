import { createReadStream, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createInterface } from 'node:readline';
import pLimit from 'p-limit';
import chalk from 'chalk';

// -------------------- CLI FLAGS --------------------
const args = process.argv.slice(2);

// Help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🦅 Health Hawk - Website Health Checker

Usage:
  node index.js <file> [options]

Options:
  -h, --help          Show this help message
  -v, --verbose       Show detailed output
  --json <file>       Export results to a JSON file
  -t, --timeout <ms>  Set request timeout (default: 5000ms)
  -r, --retries <n>   Retry failed checks up to n times
  -w, --watch         Run health checks every 60s (Ctrl+C to stop)
`);
  process.exit(0);
}

// Required: filename
const fileName = args[0];
if (!fileName) {
  console.error('Please provide a filename. Usage: node index.js <file> [options]');
  process.exit(1);
};

// Parse options
const verbose = args.includes('-v') || args.includes('--verbose');
const jsonIndex = args.findIndex(a => a === '--json');
const jsonFile = jsonIndex !== -1 ? args[jsonIndex + 1] : null;
const timeoutIndex = args.findIndex(a => a === '-t' || a === '--timeout');
const timeout = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1], 10) : 5000;
const retryIndex = args.findIndex(a => a === '-r' || a === '--retries');
const retries = retryIndex !== -1 ? parseInt(args[retryIndex + 1], 10) : 0;
const watch = args.includes('-w') || args.includes('--watch');

const limit = pLimit(10); // concurrency cap

// -------------------- FILE READING --------------------
const readFile = async (file) => {
  const fileStream = createReadStream(file);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  const urls = [];
  for await (const line of rl) {
    if (line.trim()) urls.push(line.trim());
  }
  return urls;
};

const urls = await readFile(fileName);
if (urls.length === 0) {
  console.error('The file is empty or contains no valid URLs.');
  process.exit(1);
}

console.log('🦅 Health Hawk is on the hunt...\n');

// -------------------- HEALTH CHECK --------------------
const checkUrl = (url, retriesLeft = retries) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const protocol = url.startsWith('https') ? https : url.startsWith('http') ? http : null;

    if (!protocol) {
      const duration = Date.now() - startTime;
      return resolve({ url, error: 'Invalid URL protocol', duration, success: false });
    };

    const parsedUrl = new URL(url);
    const options = { method: 'GET', headers: { Connection: 'keep-alive' } };
    const req = protocol.request(parsedUrl, options, (res) => {
      res.resume(); // drain data safely
      const duration = Date.now() - startTime;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return resolve({ url, status: res.statusCode, duration, success: true });
      } else if (retriesLeft > 0) {
        if (verbose) console.log(chalk.yellow(`↻ Retry ${url} (${retries - retriesLeft + 1})`));
        return resolve(checkUrl(url, retriesLeft - 1));
      } else {
        return resolve({ url, status: res.statusCode, duration, success: false });
      }
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      if (retriesLeft > 0) {
        if (verbose) console.log(chalk.yellow(`↻ Retry ${url} (${retries - retriesLeft + 1})`));
        return resolve(checkUrl(url, retriesLeft - 1));
      }
      return resolve({ url, error: err.message, duration, success: false });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      const duration = Date.now() - startTime;
      if (retriesLeft > 0) {
        if (verbose) console.log(chalk.yellow(`↻ Retry ${url} (${retries - retriesLeft + 1})`));
        return resolve(checkUrl(url, retriesLeft - 1));
      }
      resolve({ url, error: "Timeout", duration, success: false });
    });

    req.end();
  });
};

// -------------------- RUNNER --------------------
const runHealthCheck = async () => {
  let healthyCount = 0;
  const totalCount = urls.length;

  const promises = urls.map(url => limit(() => checkUrl(url)));
  const results = await Promise.allSettled(promises);

  results.sort((a, b) => {
    if (a.status !== 'fulfilled' || b.status !== 'fulfilled') return 0;
    return (b.value.success === true) - (a.value.success === true);
  });

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { url, status, error, duration, success } = result.value;
      if (success) {
        healthyCount++;
        if (verbose) {
            console.log(chalk.green(`✅ ${url} - Status: ${status} - Latency_ms: ${duration}ms`));
        } else {
            console.log(chalk.green(`✅ ${url}`));
        };
    
      } else {
        if (verbose) {
            console.log(chalk.red(`❌ ${url} - Status: ${error || status} - Latency_ms: ${duration}ms`));
        } else {
            console.log(chalk.red(`❌ ${url}`));
        };
      };
    } else {
      console.log(chalk.bgRed(`❌ Unknown promise rejection`));
    };
  });

  console.log(`\n🦅 Health Hawk Summary: ${healthyCount}/${totalCount} healthy`);

  if (jsonFile) {
    const cleanResults = results.map(r => (r.status === 'fulfilled' ? r.value : { error: "unknown" }));
    writeFileSync(jsonFile, JSON.stringify(cleanResults, null, 2));
    if (verbose) console.log(chalk.blue(`Results written to ${jsonFile}`));
  }
};

// -------------------- WATCH MODE --------------------
if (watch) {
  console.log("Continuous mode enabled. Press Ctrl+C to stop.\n");
  runHealthCheck();
  setInterval(runHealthCheck, 60_000);
} else {
  runHealthCheck();
}
