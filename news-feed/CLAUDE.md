# News Feed — Claude Code Guide

## Project Overview
Personal RSS news aggregator. FastAPI backend fetches and caches RSS feeds; plain HTML/CSS/JS frontend renders filterable article cards.

## Dev Setup

```bash
cd news-feed
pip install -r requirements.txt
python -m uvicorn main:app --reload
# Visit http://localhost:8000cha
```

No build step, no database, no environment variables required.

## Project Structure

```
news-feed/
├── main.py              # FastAPI app — API routes + static file serving
├── feeds_config.yaml    # RSS feed list with topic tags (edit to add feeds)
├── requirements.txt
└── static/
    ├── index.html       # App shell
    ├── style.css        # Card grid layout, topic button styles
    └── app.js           # Fetch topics/news, render cards, handle filters
```

## Key Architecture Decisions

- **No database.** All state is in-memory. Restart clears the cache.
- **Cache (`_cache` dict in `main.py`):** Per-feed-URL, TTL = 15 min (`CACHE_TTL = 900`). Avoids hammering RSS sources on every request.
- **Config is read per-request** (`load_config()` called on each API hit), so adding a feed to `feeds_config.yaml` takes effect immediately without a server restart.
- **No frontend framework.** Vanilla JS only — `app.js` uses `fetch`, `innerHTML`, and DOM APIs directly.
- **XSS prevention:** All user-visible RSS content is passed through `escHtml()` / `escAttr()` in `app.js`. Only `http`/`https` URLs are allowed in card links.

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/topics` | Returns sorted list of distinct topics from config |
| `GET /api/news` | Returns all articles, sorted newest-first |
| `GET /api/news?topic=Technology` | Returns articles filtered to one topic (case-insensitive) |

Article shape: `{ title, link, summary, published, source, topic }`

## Adding RSS Feeds

Edit `feeds_config.yaml` — no restart needed:

```yaml
feeds:
  - url: https://example.com/feed.rss
    topic: MyTopic
```

Topics are derived from the config; a new topic automatically gets a filter button in the UI.

## Common Tasks

**Change cache TTL:** Edit `CACHE_TTL` in `main.py:11`.

**Add a new topic filter:** Just add a feed with that topic to `feeds_config.yaml`.

**Change summary length:** Edit the `[:300]` slice in `main.py:38`.

**Style changes:** All styles are in `static/style.css`. Accent color is `#e94560`.

## Dependencies

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `feedparser` | RSS/Atom parsing |
| `pyyaml` | Config file loading |
| `httpx` | (Available for async HTTP if needed) |

## Known Limitations

- Broken or unreachable feeds are silently skipped (`except Exception: pass` in `get_news`).
- Cache is process-local — multiple uvicorn workers would each have their own cache.
- `feedparser` is synchronous; slow feeds block the request thread.
- Date sorting uses `email.utils.parsedate_to_datetime`; feeds with non-RFC-2822 dates sort to the bottom.
