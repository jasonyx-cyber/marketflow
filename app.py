import os
from datetime import datetime
from functools import wraps

import requests
from flask import Flask, render_template, jsonify, request, current_app, session, redirect, url_for
from flask_caching import Cache
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter, Retry

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")

app.config.update(
    DEBUG=os.getenv("FLASK_DEBUG", "False").lower() in ("1", "true", "yes"),
    CACHE_TYPE=os.getenv("CACHE_TYPE", "SimpleCache"),
    CACHE_DEFAULT_TIMEOUT=int(os.getenv("CACHE_DEFAULT_TIMEOUT", 60)),
    COINGECKO_TIMEOUT=float(os.getenv("COINGECKO_TIMEOUT", 10.0)),
    COINGECKO_RETRIES=int(os.getenv("COINGECKO_RETRIES", 3)),
    COINGECKO_BACKOFF_FACTOR=float(os.getenv("COINGECKO_BACKOFF_FACTOR", 0.5)),
    DEFAULT_IDS=os.getenv("DEFAULT_IDS", "bitcoin,ethereum,solana,binancecoin,cardano"),
    DEFAULT_VS_CURRENCY=os.getenv("DEFAULT_VS_CURRENCY", "usd"),
    SECRET_KEY=os.getenv("SECRET_KEY", "vaultx-secret-key-change-in-prod"),
)

cache = Cache(app)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

def create_session(retries, backoff_factor):
    session = requests.Session()
    retry = Retry(
        total=retries,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        backoff_factor=backoff_factor,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session

_session = create_session(
    retries=app.config["COINGECKO_RETRIES"],
    backoff_factor=app.config["COINGECKO_BACKOFF_FACTOR"],
)

def safe_get(url, params=None):
    timeout = current_app.config["COINGECKO_TIMEOUT"]
    resp = _session.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()

def json_error_handler(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else 502
            msg = "Rate limited by CoinGecko — try again in a moment." if code == 429 else \
                  "CoinGecko API access denied. You may need a free API key at coingecko.com." if code == 403 else \
                  f"CoinGecko returned {code}."
            return jsonify({"status": "error", "message": msg, "code": code,
                            "timestamp": datetime.utcnow().isoformat() + "Z"}), 502
        except requests.RequestException as e:
            return jsonify({"status": "error", "message": "Network error reaching CoinGecko.",
                            "detail": str(e), "timestamp": datetime.utcnow().isoformat() + "Z"}), 502
        except Exception as e:
            current_app.logger.exception("Unhandled exception")
            return jsonify({"status": "error", "message": "Internal server error.",
                            "detail": str(e), "timestamp": datetime.utcnow().isoformat() + "Z"}), 500
    return wrapper

@app.route("/login")
def login():
    if session.get("logged_in"):
        return redirect(url_for("home"))
    return render_template("landing.html")

@app.route("/signup")
def signup():
    if session.get("logged_in"):
        return redirect(url_for("home"))
    return render_template("landing.html")

@app.route("/auth/signin", methods=["POST"])
def auth_signin():
    data = request.get_json()
    email    = data.get("email", "").strip()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required."}), 400
    # Simple demo auth — replace with real DB in production
    session["logged_in"] = True
    session["user_email"] = email
    session["user_name"]  = email.split("@")[0].capitalize()
    return jsonify({"status": "ok", "redirect": "/"})

@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json()
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required."}), 400
    if len(password) < 8:
        return jsonify({"status": "error", "message": "Password must be at least 8 characters."}), 400
    session["logged_in"] = True
    session["user_email"] = email
    session["user_name"]  = name or email.split("@")[0].capitalize()
    return jsonify({"status": "ok", "redirect": "/"})

@app.route("/auth/signout")
def auth_signout():
    session.clear()
    return redirect(url_for("login"))


@app.route('/logout')
def logout_alias():
    """Alias for older templates that link to /logout."""
    return redirect(url_for('auth_signout'))

@app.route("/")
def home():
    return render_template("index.html", user_name=session.get("user_name", "Guest"))

@app.route("/crypto")
@json_error_handler
def crypto():
    ids = request.args.get("ids", current_app.config["DEFAULT_IDS"])
    vs_currencies = request.args.get("vs_currencies", current_app.config["DEFAULT_VS_CURRENCY"])

    cache_key = f"crypto:{ids}:{vs_currencies}"
    cached = cache.get(cache_key)
    if cached:
        cached["cached"] = True
        return jsonify(cached)

    data = safe_get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={
            "ids": ids,
            "vs_currencies": vs_currencies,
            "include_24hr_change": "true",
            "include_market_cap": "true",
            "include_24hr_vol": "true",
            "include_last_updated_at": "true",
        },
    )

    payload = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cached": False,
        "query": {"ids": ids, "vs_currencies": vs_currencies},
        "data": data,
    }
    cache.set(cache_key, payload)
    return jsonify(payload)

@app.route("/history")
@json_error_handler
def history():
    coin_id  = request.args.get("id", "bitcoin")
    currency = request.args.get("vs_currency", "usd")
    cache_key = f"history:{coin_id}:{currency}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    data   = safe_get(
        f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
        params={"vs_currency": currency, "days": "7", "interval": "daily"},
    )
    prices  = [p[1] for p in data.get("prices", [])]
    payload = {"status": "ok", "coin": coin_id, "currency": currency, "prices": prices}
    cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)

@app.route("/news")
@json_error_handler
def news():
    cache_key = "crypto_news"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    data     = safe_get("https://api.coingecko.com/api/v3/news")
    raw_list = data.get("data") or (data if isinstance(data, list) else [])
    articles = []
    for item in raw_list[:12]:
        articles.append({
            "title":       item.get("title", ""),
            "description": item.get("description", "") or item.get("author", ""),
            "url":         item.get("url", "#"),
            "thumb":       item.get("thumb_2x") or item.get("small_image", ""),
            "published":   item.get("updated_at") or item.get("published_at", ""),
            "source":      item.get("news_site") or item.get("author", ""),
        })

    payload = {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z", "articles": articles}
    cache.set(cache_key, payload, timeout=600)
    return jsonify(payload)

@app.route("/ai-summary")
@json_error_handler
def ai_summary():
    """AI market brief for a coin via Anthropic API."""
    coin     = request.args.get("coin", "bitcoin")
    currency = request.args.get("currency", "usd")
    price    = request.args.get("price", "N/A")
    change   = request.args.get("change", "N/A")
    mcap     = request.args.get("mcap", "N/A")

    cache_key = f"ai:{coin}:{currency}:{round(float(price.replace(',','')) if price not in ('N/A','null') else 0, -2)}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        prompt = (
            f"Give a brief 2-3 sentence market intelligence summary for {coin.upper()} right now. "
            f"Current price: {price} {currency.upper()}. "
            f"24h change: {change}%. Market cap: {mcap}. "
            f"Be concise and factual. Mention the price trend, any notable market context, "
            f"and one key insight for traders. No disclaimers, no markdown, plain text only."
        )
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=180,
            messages=[{"role": "user", "content": prompt}]
        )
        summary = message.content[0].text.strip()
        payload = {"status": "ok", "coin": coin, "summary": summary}
        cache.set(cache_key, payload, timeout=300)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"})

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=app.config["DEBUG"],
    )
