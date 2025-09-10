# 🦅 Health Hawk
*A fast and lightweight website health checker for Node.js*

Health Hawk helps you quickly check the availability of multiple websites from a file.
It supports concurrency, retries, JSON export, and a watch mode to monitor health continuously.

---

## Features
-  Concurrent health checks (with a concurrency cap)
-  Automatic retries for failed requests
-  Latency measurement for each URL
-  JSON export of results
-  Watch mode for continuous monitoring
-  Colourful CLI output with [chalk](https://www.npmjs.com/package/chalk)

---

## Installation
Clone this repository and install dependencies:

git clone https://github.com/salvysnr/health-hawk.git
cd health-hawk
npm install

---

## 🛠️ Usage

### Basic

node index.js urls.txt

Where `urls.txt` contains a list of URLs (one per line):

https://example.com
http://myapi.dev/health
https://google.com
https://httpbin.org/status/200
https://httpbin.org/status/404

---

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `-h`, `--help` | Show help message | `node index.js --help` |
| `-v`, `--verbose` | Show detailed output (status, latency) | `node index.js urls.txt -v` |
| `--json <file>` | Export results to JSON | `node index.js urls.txt --json results.json` |
| `-t`, `--timeout <ms>` | Request timeout (default: `5000ms`) | `node index.js urls.txt -t 3000` |
| `-r`, `--retries <n>` | Retry failed checks up to `n` times | `node index.js urls.txt -r 2` |
| `-w`, `--watch` | Run checks every 60s (until Ctrl+C) | `node index.js urls.txt -w` |

---

### Examples

**Verbose output**

node index.js urls.txt -v

✅ https://google.com - Status: 200 - Latency_ms: 52ms
❌ http://broken.link - Status: Timeout - Latency_ms: 5000ms

**Export to JSON**

node index.js urls.txt --json results.json

Produces a file like:

[
  {
    "url": "https://google.com",
    "status": 200,
    "duration": 52,
    "success": true
  },
  {
    "url": "http://broken.link",
    "error": "Timeout",
    "duration": 5000,
    "success": false
  }
]

**Watch mode**

node index.js urls.txt -w

Continuously checks health every 60 seconds.

---

## Output Summary
At the end of each run, you’ll see a summary like:

🦅 Health Hawk Summary: 8/10 healthy

---

## Tech Stack
- [Node.js](https://nodejs.org/) (built-in `http`, `https`, `fs`, `readline`)
- [p-limit](https://www.npmjs.com/package/p-limit) (for concurrency)
- [chalk](https://www.npmjs.com/package/chalk) (for coloured CLI output)

---

## Roadmap / Future Ideas
- Parallel HEAD + GET fallback (for servers that block HEAD)
- Configurable concurrency levels
- Slack/email/webhook alerts for unhealthy URLs
- Docker support

---

## License
MIT License © 2025 [Salvation Otubu]

