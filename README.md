# VaultX

A live crypto market dashboard built with Flask. VaultX pulls real-time price data from CoinGecko and layers on portfolio tracking, custom alerts, a news feed, and AI-generated market briefs powered by the Anthropic API.

## Features

- **Live prices** — Real-time crypto prices via CoinGecko, with 24h change, market cap, and volume
- **Portfolio tracking** — Track your holdings and watch performance over time
- **Price alerts** — Set custom alerts for coins hitting target prices
- **News feed** — Latest crypto news pulled from CoinGecko
- **AI market summaries** — Short, factual market briefs generated via Claude
- **Offline support** — Service worker enables basic offline functionality (PWA)
- **Resilient API layer** — Caching plus retry/backoff logic to handle CoinGecko rate limits gracefully

## Tech Stack

- **Backend:** Flask, Flask-Caching
- **API integrations:** CoinGecko API, Anthropic API
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Other:** python-dotenv for config, requests with retry/backoff

## Getting Started

### Prerequisites

- Python 3.9+
- A CoinGecko API key (free tier works)
- An Anthropic API key (for AI market summaries)

### Installation

1. Clone the repo
```bash
   git clone https://github.com/jasonyx-cyber/marketflow.git
   cd marketflow
```

2. Install dependencies
```bash
   pip install -r requirements.txt
```

3. Set up environment variables
```bash
   cp env.example .env
```
   Then fill in your own values in `.env`, including `ANTHROPIC_API_KEY`.

4. Run the app
```bash
   python app.py
```

The app will be available at `http://localhost:5000`.

## Environment Variables

See `env.example` for the full list, including Flask config, cache timeout, CoinGecko request settings, default tracked coins, and your Anthropic API key.

## Project Structure
marketflow/
├── app.py              # Flask app and routes
├── env.example          # Environment variable template
├── requirements.txt     # Python dependencies
├── static/               # JS, CSS, manifest, service worker
└── templates/            # HTML templates

## Roadmap

- [ ] Real database for user accounts (currently demo session-based auth)
- [ ] Persistent portfolio storage
- [ ] More currency/exchange support
