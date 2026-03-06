import re
import time
import yaml
import httpx
import feedparser
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "feeds_config.yaml"
CACHE_TTL = 900  # 15 minutes

app = FastAPI(title="News Feed")

# In-memory cache: {url: {"fetched_at": float, "entries": list}}
_cache: dict = {}


def load_config() -> list[dict]:
    with open(CONFIG_PATH) as f:
        data = yaml.safe_load(f)
    return data.get("feeds", [])


def save_config(feeds: list[dict]):
    with open(CONFIG_PATH, "w") as f:
        yaml.dump({"feeds": feeds}, f, allow_unicode=True)


def fetch_feed(url: str, topic: str) -> list[dict]:
    now = time.time()
    cached = _cache.get(url)
    if cached and (now - cached["fetched_at"]) < CACHE_TTL:
        entries = cached["entries"]
    else:
        parsed = feedparser.parse(url)
        entries = []
        for entry in parsed.entries:
            summary = entry.get("summary", "")
            # Strip basic HTML tags from summary
            summary = re.sub(r"<[^>]+>", "", summary)
            summary = summary[:300].strip()

            published = ""
            if hasattr(entry, "published"):
                published = entry.published
            elif hasattr(entry, "updated"):
                published = entry.updated

            entries.append({
                "title": entry.get("title", "No title"),
                "link": entry.get("link", "#"),
                "summary": summary,
                "published": published,
                "source": parsed.feed.get("title", url),
            })
        _cache[url] = {"fetched_at": now, "entries": entries}

    return [dict(e, topic=topic) for e in entries]


@app.get("/api/topics")
def get_topics():
    feeds = load_config()
    topics = sorted({f["topic"] for f in feeds})
    return {"topics": topics}


@app.get("/api/news")
def get_news(topic: str | None = Query(default=None)):
    feeds = load_config()
    if topic:
        feeds = [f for f in feeds if f["topic"].lower() == topic.lower()]

    articles = []
    for feed in feeds:
        try:
            articles.extend(fetch_feed(feed["url"], feed["topic"]))
        except Exception:
            pass  # Skip broken feeds silently

    # Sort by published date descending (best-effort; unparseable dates go last)
    def sort_key(a):
        from email.utils import parsedate_to_datetime
        try:
            return parsedate_to_datetime(a["published"]).timestamp()
        except Exception:
            return 0.0

    articles.sort(key=sort_key, reverse=True)
    return {"articles": articles}


class FeedIn(BaseModel):
    url: str
    topic: str


@app.post("/api/feeds", status_code=201)
async def add_feed(feed: FeedIn):
    url = feed.url.strip()
    topic = feed.topic.strip()
    if not url or not topic:
        raise HTTPException(400, "url and topic are required")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(400, "url must start with http:// or https://")
    feeds = load_config()
    if any(f["url"] == url for f in feeds):
        raise HTTPException(409, "Feed URL already exists")
    feeds.append({"url": url, "topic": topic})
    save_config(feeds)
    _cache.pop(url, None)
    return {"ok": True}


@app.get("/api/feeds")
def get_feeds():
    feeds = load_config()
    return {"feeds": [{"idx": i, "url": f["url"], "topic": f["topic"]} for i, f in enumerate(feeds)]}


@app.delete("/api/feeds/{idx}")
def delete_feed(idx: int):
    feeds = load_config()
    if idx < 0 or idx >= len(feeds):
        raise HTTPException(404, "Feed not found")
    removed = feeds.pop(idx)
    save_config(feeds)
    _cache.pop(removed["url"], None)
    return {"ok": True}


@app.put("/api/feeds/{idx}")
async def update_feed(idx: int, feed: FeedIn):
    url = feed.url.strip()
    topic = feed.topic.strip()
    if not url or not topic:
        raise HTTPException(400, "url and topic are required")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(400, "url must start with http:// or https://")
    feeds = load_config()
    if idx < 0 or idx >= len(feeds):
        raise HTTPException(404, "Feed not found")
    if any(i != idx and f["url"] == url for i, f in enumerate(feeds)):
        raise HTTPException(409, "Feed URL already exists")
    old_url = feeds[idx]["url"]
    feeds[idx] = {"url": url, "topic": topic}
    save_config(feeds)
    _cache.pop(old_url, None)
    return {"ok": True}


@app.get("/api/feeds/search")
async def search_feeds(q: str):
    if not q or not q.strip():
        raise HTTPException(400, "q is required")
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(
            "https://feedly.com/v3/search/feeds",
            params={"query": q.strip(), "count": 15, "locale": "en"},
        )
    if not r.is_success:
        raise HTTPException(502, "Feed search unavailable")
    data = r.json()
    results = []
    for item in data.get("results", []):
        feed_id = item.get("feedId", "")
        url = feed_id.removeprefix("feed/")
        if url.startswith("http"):
            results.append({
                "title": item.get("title", url),
                "url": url,
                "subscribers": item.get("subscribers", 0),
            })
    return {"results": results}


# Serve static files
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "static" / "index.html")
