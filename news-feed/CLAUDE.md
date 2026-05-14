# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Personal RSS news aggregator. FastAPI backend fetches and caches RSS feeds; plain HTML/CSS/JS frontend renders filterable article cards.

## Dev Setup

```bash
cd news-feed
pip install -r requirements.txt
python -m uvicorn main:app --reload
# Visit http://localhost:8000
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
- **XSS prevention:** All user-visible RSS content passes through `escHtml()` / `escAttr()` / `escData()` in `app.js`. Only `http`/`https` URLs are allowed in card links. `escData()` is used specifically for JSON embedded in `data-article` attributes.

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/topics` | Returns sorted list of distinct topics from config |
| `GET /api/news` | Returns all articles, sorted newest-first |
| `GET /api/news?topic=Technology` | Returns articles filtered to one topic (case-insensitive) |
| `GET /api/feeds` | List all configured feeds with index |
| `POST /api/feeds` | Add feed `{url, topic}` — 409 if duplicate URL |
| `PUT /api/feeds/{idx}` | Edit feed at index |
| `DELETE /api/feeds/{idx}` | Remove feed at index, evicts cache entry |
| `GET /api/feeds/search?q=X` | Proxy search against Feedly's public feed index |

Article shape: `{ title, link, summary, published, source, topic, image }`

Image extraction priority in `get_image()`: `media_thumbnail` → `media_content` (image type) → `enclosures` (image type). Returns `""` if none found.

## Frontend State & localStorage Keys

| Key | Purpose |
|---|---|
| `nf_dark` | `"1"` = dark mode, `"0"` = light, absent = follow system |
| `nf_theme_hue` | Accent color hue (0–360), random on first visit |
| `nf_view` | `"card"` or `"list"` |
| `nf_favorites` | JSON array of saved article objects |
| `nf_notif` | `"1"` = browser notifications enabled |
| `nf_known_links` | JSON array of seen article URLs (for new-article detection on auto-refresh) |
| `nf_jelly` | `"1"` = jellyfish background theme active |

## Recently Added Features

**Auto-refresh (`app.js`):** `startAutoRefresh()` runs two intervals — a 1-second countdown tick and a 5-minute fetch cycle (`AUTO_REFRESH_MS`). On each cycle it diffs new articles against `knownLinks` and fires browser `Notification` objects (up to 3) if permission is granted and `notifEnabled` is true.

**Keyboard navigation (`app.js`):** Global `keydown` handler. `j`/`↓` and `k`/`↑` move `selectedIdx`; `setSelected()` adds/removes `.kb-selected` class and scrolls the card into view. `Enter` opens the reader modal, `f` toggles favorite, `d` toggles dark mode. Handler is skipped when focus is in an input or a modal is open.

**Jellyfish theme (`app.js` + `style.css`):** `applyJellyfish(active)` toggles `data-jelly` on `<html>`. CSS shows `.jelly-bg` only when `html[data-jelly]` is set. `spawnJellyfish()` and `spawnBubbles()` create DOM elements with randomized inline styles and CSS keyframe animations (`jelly-float`, `bubble-rise`).

## Adding RSS Feeds

Edit `feeds_config.yaml` — no restart needed:

```yaml
feeds:
  - url: https://example.com/feed.rss
    topic: MyTopic
```

Topics are derived from the config; a new topic automatically gets a filter button in the UI.

## Common Tasks

**Change cache TTL:** Edit `CACHE_TTL` in `main.py`.

**Change summary length:** Edit the `[:300]` slice in `main.py`.

**Change auto-refresh interval:** Edit `AUTO_REFRESH_MS` in `app.js`.

## Known Limitations

- Broken or unreachable feeds are silently skipped (`except Exception: pass` in `get_news`).
- Cache is process-local — multiple uvicorn workers would each have their own cache.
- `feedparser` is synchronous; slow feeds block the request thread (wrapping in `asyncio.to_thread` would fix this).
- Date sorting uses `email.utils.parsedate_to_datetime`; feeds with non-RFC-2822 dates sort to the bottom.
- `nf_known_links` grows unboundedly in localStorage — should be capped at ~500 entries.
