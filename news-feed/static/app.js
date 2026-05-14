const grid = document.getElementById("news-grid");
const filtersNav = document.getElementById("topic-filters");
const statusEl = document.getElementById("status");
const favToggleBtn = document.getElementById("fav-toggle");
const favCountEl = document.getElementById("fav-count");
const favPanel = document.getElementById("fav-panel");
const favBackdrop = document.getElementById("fav-backdrop");
const favList = document.getElementById("fav-list");
const viewToggleBtn = document.getElementById("view-toggle");
const darkToggle = document.getElementById("dark-toggle");
const notifToggleBtn = document.getElementById("notif-toggle");
const refreshCountdownEl = document.getElementById("refresh-countdown");
const jellyToggleBtn = document.getElementById("jelly-toggle");
const jellyBg = document.getElementById("jelly-bg");

// Reader modal refs
const readerBackdrop = document.getElementById("reader-backdrop");
const readerModal = document.getElementById("reader-modal");
const readerClose = document.getElementById("reader-close");
const readerImage = document.getElementById("reader-image");
const readerImageWrap = document.getElementById("reader-image-wrap");
const readerTitle = document.getElementById("reader-title");
const readerSource = document.getElementById("reader-source");
const readerDate = document.getElementById("reader-date");
const readerSummary = document.getElementById("reader-summary");
const readerLink = document.getElementById("reader-link");
const readerTopic = document.getElementById("reader-topic");

// Setup view refs
const setupBtn = document.getElementById("setup-btn");
const setupView = document.getElementById("setup-view");
const setupFeedList = document.getElementById("setup-feed-list");
const setupBackBtn = document.getElementById("setup-back-btn");
const newsMain = document.querySelector("main");

// Add Feed modal refs
const addFeedBtn = document.getElementById("add-feed-btn");
const addFeedModal = document.getElementById("add-feed-modal");
const addFeedBackdrop = document.getElementById("add-feed-backdrop");
const addFeedClose = document.getElementById("add-feed-close");
const addFeedStatus = document.getElementById("add-feed-status");
const addFeedSubmit = document.getElementById("add-feed-submit");
const feedUrlInput = document.getElementById("feed-url-input");
const feedTopicInput = document.getElementById("feed-topic-input");
const topicSuggestions = document.getElementById("topic-suggestions");
const feedSearchInput = document.getElementById("feed-search-input");
const feedSearchBtn = document.getElementById("feed-search-btn");
const feedSearchResults = document.getElementById("feed-search-results");
const modalTabs = document.querySelectorAll(".modal-tab");

// --- Cookie utilities ---

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch { /* ignore if cookie too large */ }
}

function getCookie(name) {
  const match = document.cookie.split("; ").find(r => r.startsWith(name + "="));
  if (!match) return null;
  try { return decodeURIComponent(match.split("=").slice(1).join("=")); } catch { return null; }
}

// --- Per-topic color ---

function topicHue(topic) {
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (Math.imul(h, 31) + topic.charCodeAt(i)) | 0;
  return (h >>> 0) % 360;
}

function topicBg(topic) {
  const hue = topicHue(topic);
  return `hsl(${hue},62%,46%)`;
}

// --- Theme (random fixed color + dark mode) ---

function getOrCreateHue() {
  let hue = parseInt(localStorage.getItem("nf_theme_hue"), 10);
  if (isNaN(hue)) {
    hue = Math.floor(Math.random() * 360);
    localStorage.setItem("nf_theme_hue", hue);
  }
  return hue;
}

function isDarkMode() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function applyTheme() {
  const dark = isDarkMode();
  const hue = getOrCreateHue();
  const h2 = (hue + 28) % 360;
  const root = document.documentElement;
  root.style.setProperty("--header-bg",
    dark
      ? `linear-gradient(135deg, hsl(${hue},58%,14%) 0%, hsl(${h2},52%,26%) 100%)`
      : `linear-gradient(135deg, hsl(${hue},62%,18%) 0%, hsl(${h2},55%,34%) 100%)`);
  root.style.setProperty("--accent",      `hsl(${hue},${dark ? 72 : 68}%,${dark ? 60 : 52}%)`);
  root.style.setProperty("--accent-dark", `hsl(${hue},${dark ? 68 : 65}%,${dark ? 50 : 42}%)`);
}

function setDarkMode(dark) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("nf_dark", "1");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("nf_dark", "0");
  }
  applyTheme();
}

darkToggle.addEventListener("click", () => setDarkMode(!isDarkMode()));

applyTheme();

let activeTopic = "";
let activeTab = "paste";
let selectedSearchUrl = "";
let selectedIdx = -1;

// --- Pagination ---
const PAGE_SIZE = { card: 20, list: 30 };
let allArticles = [];
let displayedCount = 0;

const sentinel = document.createElement("div");
sentinel.id = "load-sentinel";
document.querySelector("main").appendChild(sentinel);

const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) appendMoreCards();
}, { rootMargin: "300px" });

function getPageSize() {
  return PAGE_SIZE[viewMode] || 20;
}

function appendMoreCards() {
  const next = allArticles.slice(displayedCount, displayedCount + getPageSize());
  if (!next.length) return;
  next.forEach(a => grid.insertAdjacentHTML("beforeend", cardTemplate(a)));
  displayedCount += next.length;
  if (displayedCount >= allArticles.length) scrollObserver.unobserve(sentinel);
}

// --- View mode ---

let viewMode = localStorage.getItem("nf_view") || "card";

function setViewMode(mode) {
  viewMode = mode;
  grid.classList.toggle("list-mode", mode === "list");
  viewToggleBtn.classList.toggle("list-active", mode === "list");
  localStorage.setItem("nf_view", mode);
  if (allArticles.length) renderCards(allArticles);
}

viewToggleBtn.addEventListener("click", () => {
  setViewMode(viewMode === "card" ? "list" : "card");
});

// --- Favorites ---

const FAV_KEY = "nf_favorites";
const FEEDS_COOKIE = "nf_feeds";

function loadFavorites() {
  try {
    const ls = localStorage.getItem(FAV_KEY);
    if (ls !== null) return JSON.parse(ls) || [];
  } catch { /* fall through to cookie */ }
  try {
    const ck = getCookie(FAV_KEY);
    if (ck !== null) return JSON.parse(ck) || [];
  } catch { /* ignore */ }
  return [];
}

function saveFavorites(favs) {
  const json = JSON.stringify(favs);
  localStorage.setItem(FAV_KEY, json);
  setCookie(FAV_KEY, json);
}

function saveFeedsToCookie(feeds) {
  setCookie(FEEDS_COOKIE, JSON.stringify(feeds.map(f => ({ url: f.url, topic: f.topic }))));
}

function isFavorited(link) {
  return loadFavorites().some(f => f.link === link);
}

function updateBadge() {
  const count = loadFavorites().length;
  if (count > 0) {
    favCountEl.textContent = count;
    favCountEl.hidden = false;
  } else {
    favCountEl.hidden = true;
  }
}

function toggleFavorite(article) {
  let favs = loadFavorites();
  const idx = favs.findIndex(f => f.link === article.link);
  if (idx === -1) {
    favs.push(article);
  } else {
    favs.splice(idx, 1);
  }
  saveFavorites(favs);
  updateBadge();

  // Update collect button state on visible cards
  const btn = grid.querySelector(`.collect-btn[data-link="${CSS.escape(article.link)}"]`);
  if (btn) btn.classList.toggle("collected", idx === -1);

  // Refresh panel if open
  if (!favPanel.classList.contains("hidden")) {
    renderFavPanel();
  }
}

function cardTemplate(a, inPanel = false) {
  const collected = isFavorited(a.link);
  const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const actionBtn = inPanel
    ? `<button class="fav-remove-btn" data-link="${escAttr(a.link)}" aria-label="Remove from favorites">&times; Remove</button>`
    : `<button class="collect-btn${collected ? " collected" : ""}" data-link="${escAttr(a.link)}" aria-label="Save to favorites">${heartSvg}</button>`;
  return `
    <article class="card" data-article="${escData(a)}">
      ${a.image ? `<div class="card-img-wrap"><img class="card-img" src="${escAttr(a.image)}" alt="" loading="lazy" onerror="this.closest('.card-img-wrap').remove()"></div>` : ""}
      <div class="card-meta">
        <span class="card-topic" style="background:${topicBg(a.topic)}">${escHtml(a.topic)}</span>
        <span>${escHtml(formatDate(a.published))}</span>
      </div>
      <div class="card-title">${escHtml(a.title)}</div>
      <div class="card-source">${escHtml(a.source)}</div>
      ${a.summary ? `<p class="card-summary">${escHtml(a.summary)}</p>` : ""}
      <div class="card-footer">
        <a class="card-link" href="${escAttr(a.link)}" target="_blank" rel="noopener noreferrer">Read more &rarr;</a>
        ${actionBtn}
      </div>
    </article>
  `;
}

function renderFavPanel() {
  const favs = loadFavorites();
  if (!favs.length) {
    favList.innerHTML = `<p class="fav-empty">No saved articles yet.</p>`;
    return;
  }
  favList.innerHTML = favs.map(a => cardTemplate(a, true)).join("");
}

function removeFavorite(link) {
  const favs = loadFavorites().filter(f => f.link !== link);
  saveFavorites(favs);
  updateBadge();
  const btn = grid.querySelector(`.collect-btn[data-link="${CSS.escape(link)}"]`);
  if (btn) btn.classList.remove("collected");
  renderFavPanel();
}

function removeAllFavorites() {
  if (!loadFavorites().length) return;
  if (!confirm("Remove all favorites?")) return;
  saveFavorites([]);
  updateBadge();
  grid.querySelectorAll(".collect-btn.collected").forEach(b => b.classList.remove("collected"));
  renderFavPanel();
}

favList.addEventListener("click", (e) => {
  const btn = e.target.closest(".fav-remove-btn");
  if (btn) removeFavorite(btn.dataset.link);
});

document.getElementById("fav-remove-all").addEventListener("click", removeAllFavorites);

function openFavPanel() {
  renderFavPanel();
  favPanel.classList.remove("hidden");
  favBackdrop.classList.remove("hidden");
}

function closeFavPanel() {
  favPanel.classList.add("hidden");
  favBackdrop.classList.add("hidden");
}

favToggleBtn.addEventListener("click", () => {
  if (favPanel.classList.contains("hidden")) {
    openFavPanel();
  } else {
    closeFavPanel();
  }
});

document.getElementById("fav-close").addEventListener("click", closeFavPanel);
favBackdrop.addEventListener("click", closeFavPanel);

// Delegate collect-btn clicks for both grid and panel
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".collect-btn");
  if (!btn) return;
  const link = btn.dataset.link;

  // Find article data from grid cards or favorites
  let article = null;

  // Try grid first
  const gridCards = [...grid.querySelectorAll(".card")];
  for (const card of gridCards) {
    const cardBtn = card.querySelector(".collect-btn");
    if (cardBtn && cardBtn.dataset.link === link) {
      article = {
        title: card.querySelector(".card-title")?.textContent || "",
        link,
        summary: card.querySelector(".card-summary")?.textContent || "",
        published: card.querySelector(".card-meta span:last-child")?.textContent || "",
        source: card.querySelector(".card-source")?.textContent || "",
        topic: card.querySelector(".card-topic")?.textContent || "",
      };
      break;
    }
  }

  // Fall back to favorites list (for panel cards)
  if (!article) {
    const favs = loadFavorites();
    article = favs.find(f => f.link === link);
  }

  if (article) toggleFavorite(article);
});

// --- Setup View ---

async function openSetupView() {
  newsMain.classList.add("hidden");
  setupView.classList.remove("hidden");
  await loadSetupFeeds();
}

function closeSetupView() {
  setupView.classList.add("hidden");
  newsMain.classList.remove("hidden");
}

setupBtn.addEventListener("click", openSetupView);
setupBackBtn.addEventListener("click", closeSetupView);

async function loadSetupFeeds() {
  setupFeedList.innerHTML = `<p class="setup-loading">Loading…</p>`;
  const res = await fetch("/api/feeds");
  const { feeds } = await res.json();
  saveFeedsToCookie(feeds);
  renderSetupFeeds(feeds);
}

function renderSetupFeeds(feeds) {
  if (!feeds.length) {
    setupFeedList.innerHTML = `<p class="setup-empty">No feeds configured.</p>`;
    return;
  }
  setupFeedList.innerHTML = feeds.map(f => `
    <div class="setup-feed-row" data-idx="${f.idx}">
      <span class="setup-topic-pill" style="background:${topicBg(f.topic)}">${escHtml(f.topic)}</span>
      <span class="setup-url">${escHtml(f.url)}</span>
      <div class="setup-actions">
        <button class="setup-edit-btn" data-idx="${f.idx}" data-url="${escAttr(f.url)}" data-topic="${escHtml(f.topic)}">Edit</button>
        <button class="setup-delete-btn" data-idx="${f.idx}">Delete</button>
      </div>
    </div>
  `).join("");
}

function makeEditRow(idx, url, topic) {
  return `
    <div class="setup-feed-row editing" data-idx="${idx}">
      <input class="setup-edit-topic" type="text" value="${escHtml(topic)}" placeholder="Topic" />
      <input class="setup-edit-url" type="url" value="${escAttr(url)}" placeholder="https://…" />
      <div class="setup-actions">
        <button class="setup-save-btn" data-idx="${idx}">Save</button>
        <button class="setup-cancel-btn" data-idx="${idx}">Cancel</button>
      </div>
      <div class="setup-row-status hidden"></div>
    </div>
  `;
}

setupFeedList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".setup-edit-btn");
  const cancelBtn = e.target.closest(".setup-cancel-btn");
  const saveBtn = e.target.closest(".setup-save-btn");
  const deleteBtn = e.target.closest(".setup-delete-btn");

  if (editBtn) {
    const idx = editBtn.dataset.idx;
    const url = editBtn.dataset.url;
    const topic = editBtn.dataset.topic;
    const row = setupFeedList.querySelector(`.setup-feed-row[data-idx="${idx}"]`);
    row.outerHTML = makeEditRow(idx, url, topic);
    return;
  }

  if (cancelBtn) {
    await loadSetupFeeds();
    return;
  }

  if (saveBtn) {
    const idx = parseInt(saveBtn.dataset.idx, 10);
    const row = setupFeedList.querySelector(`.setup-feed-row[data-idx="${idx}"]`);
    const urlInput = row.querySelector(".setup-edit-url");
    const topicInput = row.querySelector(".setup-edit-topic");
    const statusEl = row.querySelector(".setup-row-status");
    const url = urlInput.value.trim();
    const topic = topicInput.value.trim();

    saveBtn.disabled = true;
    statusEl.classList.add("hidden");
    statusEl.textContent = "";

    try {
      const res = await fetch(`/api/feeds/${idx}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, topic }),
      });
      if (res.ok) {
        await loadSetupFeeds();
      } else {
        const data = await res.json().catch(() => ({}));
        statusEl.textContent = data.detail || "Failed to save.";
        statusEl.classList.remove("hidden");
        saveBtn.disabled = false;
      }
    } catch {
      statusEl.textContent = "Network error.";
      statusEl.classList.remove("hidden");
      saveBtn.disabled = false;
    }
    return;
  }

  if (deleteBtn) {
    if (!confirm("Delete this feed?")) return;
    const idx = parseInt(deleteBtn.dataset.idx, 10);
    try {
      await fetch(`/api/feeds/${idx}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    await loadSetupFeeds();
    const topics = await fetchTopics();
    renderTopics(topics);
  }
});

// --- Utilities ---

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (isError ? " error" : "");
}

function clearStatus() {
  statusEl.className = "status hidden";
  statusEl.textContent = "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderSkeletons(count = 6) {
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton">
      <div class="skel-line short"></div>
      <div class="skel-line title"></div>
      <div class="skel-line medium"></div>
      <div class="skel-line tall"></div>
      <div class="skel-line tall"></div>
      <div class="skel-line short"></div>
    </div>
  `).join("");
}

function renderCards(articles) {
  allArticles = articles;
  displayedCount = 0;
  selectedIdx = -1;
  scrollObserver.unobserve(sentinel);

  if (!articles.length) {
    grid.innerHTML = "";
    setStatus("No articles found for this topic.");
    return;
  }
  clearStatus();

  const first = articles.slice(0, getPageSize());
  grid.innerHTML = first.map(a => cardTemplate(a)).join("");
  displayedCount = first.length;

  if (displayedCount < allArticles.length) scrollObserver.observe(sentinel);
}

function escData(obj) {
  return JSON.stringify(obj).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  // Only allow http/https URLs
  const s = String(str).trim();
  if (/^https?:\/\//i.test(s)) return s.replace(/"/g, "%22");
  return "#";
}

// --- API calls ---

async function fetchTopics() {
  const res = await fetch("/api/topics");
  if (!res.ok) throw new Error("Failed to load topics");
  const { topics } = await res.json();
  return topics;
}

async function fetchNews(topic = "") {
  const url = topic ? `/api/news?topic=${encodeURIComponent(topic)}` : "/api/news";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load news");
  const { articles } = await res.json();
  return articles;
}

// --- Add Feed Modal ---

function openAddFeedModal() {
  feedUrlInput.value = "";
  feedTopicInput.value = "";
  feedSearchInput.value = "";
  feedSearchResults.innerHTML = "";
  selectedSearchUrl = "";
  setModalStatus("", "");
  // Reset to paste tab
  switchTab("paste");
  addFeedModal.classList.remove("hidden");
  addFeedBackdrop.classList.remove("hidden");
}

function closeAddFeedModal() {
  addFeedModal.classList.add("hidden");
  addFeedBackdrop.classList.add("hidden");
}

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tab-paste").classList.toggle("hidden", tab !== "paste");
  document.getElementById("tab-search").classList.toggle("hidden", tab !== "search");
  modalTabs.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
  selectedSearchUrl = "";
  feedSearchResults.innerHTML = "";
  setModalStatus("", "");
}

function setModalStatus(msg, type) {
  addFeedStatus.textContent = msg;
  addFeedStatus.className = "modal-status" + (msg ? "" : " hidden") + (type ? " " + type : "");
}

function renderSearchResults(results) {
  if (!results.length) {
    feedSearchResults.innerHTML = `<li class="no-results">No feeds found.</li>`;
    return;
  }
  feedSearchResults.innerHTML = results.map(r => `
    <li class="feed-result-item" data-url="${escAttr(r.url)}" data-title="${escHtml(r.title)}">
      <span class="result-title">${escHtml(r.title)}</span>
      <span class="result-url">${escHtml(r.url)}</span>
    </li>
  `).join("");
}

modalTabs.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

addFeedBtn.addEventListener("click", openAddFeedModal);
addFeedClose.addEventListener("click", closeAddFeedModal);
addFeedBackdrop.addEventListener("click", closeAddFeedModal);

// --- Reader modal ---

function openReader(article) {
  readerTopic.textContent = article.topic;
  readerTopic.style.background = topicBg(article.topic);
  readerTitle.textContent = article.title;
  readerSource.textContent = article.source;
  readerDate.textContent = formatDate(article.published);
  readerSummary.textContent = article.summary || "";
  readerLink.href = escAttr(article.link);

  if (article.image) {
    readerImage.src = article.image;
    readerImage.alt = article.title;
    readerImageWrap.classList.remove("hidden");
  } else {
    readerImageWrap.classList.add("hidden");
    readerImage.src = "";
  }

  readerModal.classList.remove("hidden");
  readerBackdrop.classList.remove("hidden");
}

function closeReader() {
  readerModal.classList.add("hidden");
  readerBackdrop.classList.add("hidden");
}

readerClose.addEventListener("click", closeReader);
readerBackdrop.addEventListener("click", closeReader);

// --- Keyboard navigation ---

function getVisibleCards() {
  return [...grid.querySelectorAll(".card")];
}

function setSelected(idx) {
  const cards = getVisibleCards();
  if (selectedIdx >= 0 && selectedIdx < cards.length) {
    cards[selectedIdx].classList.remove("kb-selected");
  }
  selectedIdx = idx;
  if (idx >= 0 && idx < cards.length) {
    cards[idx].classList.add("kb-selected");
    cards[idx].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeReader(); return; }

  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  const modalOpen = !readerModal.classList.contains("hidden") ||
    !addFeedModal.classList.contains("hidden") ||
    !favPanel.classList.contains("hidden");
  if (modalOpen) return;

  const cards = getVisibleCards();

  switch (e.key) {
    case "j":
    case "ArrowDown":
      e.preventDefault();
      setSelected(Math.min(selectedIdx + 1, cards.length - 1));
      break;
    case "k":
    case "ArrowUp":
      e.preventDefault();
      setSelected(Math.max(selectedIdx <= 0 ? 0 : selectedIdx - 1, 0));
      break;
    case "Enter":
      if (selectedIdx >= 0 && selectedIdx < cards.length) {
        const raw = cards[selectedIdx].dataset.article;
        if (raw) { selectedIdx = -1; openReader(JSON.parse(raw)); }
      }
      break;
    case "f":
      if (selectedIdx >= 0 && selectedIdx < cards.length) {
        const btn = cards[selectedIdx].querySelector(".collect-btn");
        if (btn) btn.click();
      }
      break;
    case "d":
      setDarkMode(!isDarkMode());
      break;
  }
});

document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  if (e.target.closest("a, button")) return;
  const raw = card.dataset.article;
  if (!raw) return;
  openReader(JSON.parse(raw));
});

// --- Auto-refresh & Notifications ---

const AUTO_REFRESH_MS = 5 * 60 * 1000;
let notifEnabled = localStorage.getItem("nf_notif") === "1";
let knownLinks = new Set(JSON.parse(localStorage.getItem("nf_known_links") || "[]"));
let refreshSecsLeft = AUTO_REFRESH_MS / 1000;

function updateNotifBtn() {
  notifToggleBtn.classList.toggle("active", notifEnabled);
}

function saveKnownLinks(articles) {
  articles.forEach(a => knownLinks.add(a.link));
  try { localStorage.setItem("nf_known_links", JSON.stringify([...knownLinks])); } catch { /* quota */ }
}

function formatCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startAutoRefresh() {
  refreshCountdownEl.textContent = formatCountdown(refreshSecsLeft);

  setInterval(() => {
    refreshSecsLeft = Math.max(0, refreshSecsLeft - 1);
    refreshCountdownEl.textContent = formatCountdown(refreshSecsLeft);
  }, 1000);

  setInterval(async () => {
    refreshSecsLeft = AUTO_REFRESH_MS / 1000;
    try {
      const articles = await fetchNews(activeTopic);
      const newArticles = articles.filter(a => !knownLinks.has(a.link));
      renderCards(articles);
      saveKnownLinks(articles);
      if (newArticles.length && notifEnabled && "Notification" in window && Notification.permission === "granted") {
        newArticles.slice(0, 3).forEach(a => {
          new Notification(a.title, { body: (a.summary || a.source).slice(0, 90) });
        });
      }
    } catch { /* silent — user will see stale data, that's OK */ }
  }, AUTO_REFRESH_MS);
}

if ("Notification" in window) {
  notifToggleBtn.addEventListener("click", async () => {
    if (!notifEnabled) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        notifEnabled = true;
        localStorage.setItem("nf_notif", "1");
      }
    } else {
      notifEnabled = false;
      localStorage.setItem("nf_notif", "0");
    }
    updateNotifBtn();
  });
} else {
  notifToggleBtn.hidden = true;
}

// --- Jellyfish theme ---

let jellyActive = localStorage.getItem("nf_jelly") === "1";

function rnd(min, max) { return Math.random() * (max - min) + min; }

function spawnJellyfish(n = 8) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "jellyfish";
    const size = rnd(50, 130);
    const hue = Math.round(rnd(190, 280));
    const sat = Math.round(rnd(50, 70));
    const lit = Math.round(rnd(40, 65));
    el.style.cssText = [
      `left:${rnd(5, 90).toFixed(1)}%`,
      `top:${rnd(5, 85).toFixed(1)}%`,
      `width:${size.toFixed(0)}px`,
      `height:${size.toFixed(0)}px`,
      `background:hsl(${hue},${sat}%,${lit}%)`,
      `color:hsl(${hue},${sat}%,${lit}%)`,
      `animation-duration:${rnd(4, 9).toFixed(1)}s`,
      `animation-delay:${rnd(0, 5).toFixed(1)}s`,
    ].join(";");
    jellyBg.appendChild(el);
  }
}

function spawnBubbles(n = 20) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "bubble";
    const size = rnd(2, 8).toFixed(1);
    el.style.cssText = [
      `left:${rnd(0, 100).toFixed(1)}%`,
      `bottom:${rnd(-5, 5).toFixed(1)}%`,
      `width:${size}px`,
      `height:${size}px`,
      `animation-duration:${rnd(5, 13).toFixed(1)}s`,
      `animation-delay:${rnd(0, 10).toFixed(1)}s`,
    ].join(";");
    jellyBg.appendChild(el);
  }
}

function applyJellyfish(active) {
  jellyActive = active;
  if (active) {
    document.documentElement.setAttribute("data-jelly", "");
    jellyBg.innerHTML = "";
    spawnJellyfish(8);
    spawnBubbles(20);
    jellyToggleBtn.classList.add("active");
  } else {
    document.documentElement.removeAttribute("data-jelly");
    jellyBg.innerHTML = "";
    jellyToggleBtn.classList.remove("active");
  }
  localStorage.setItem("nf_jelly", active ? "1" : "0");
}

jellyToggleBtn.addEventListener("click", () => applyJellyfish(!jellyActive));

feedSearchBtn.addEventListener("click", async () => {
  const q = feedSearchInput.value.trim();
  if (!q) return;
  feedSearchBtn.disabled = true;
  feedSearchResults.innerHTML = `<li class="no-results">Searching…</li>`;
  selectedSearchUrl = "";
  try {
    const res = await fetch(`/api/feeds/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Search failed");
    const { results } = await res.json();
    renderSearchResults(results);
  } catch {
    feedSearchResults.innerHTML = `<li class="no-results">Search unavailable.</li>`;
  } finally {
    feedSearchBtn.disabled = false;
  }
});

feedSearchResults.addEventListener("click", (e) => {
  const item = e.target.closest(".feed-result-item");
  if (!item) return;
  feedSearchResults.querySelectorAll(".feed-result-item").forEach(el => el.classList.remove("selected"));
  item.classList.add("selected");
  selectedSearchUrl = item.dataset.url;
  if (!feedTopicInput.value.trim()) {
    feedTopicInput.value = item.dataset.title;
  }
});

addFeedSubmit.addEventListener("click", async () => {
  const url = activeTab === "paste" ? feedUrlInput.value.trim() : selectedSearchUrl;
  const topic = feedTopicInput.value.trim();

  if (!url) {
    setModalStatus(activeTab === "paste" ? "Please enter a feed URL." : "Please select a feed from the results.", "error");
    return;
  }
  if (!topic) {
    setModalStatus("Please enter a topic.", "error");
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    setModalStatus("URL must start with http:// or https://", "error");
    return;
  }

  addFeedSubmit.disabled = true;
  setModalStatus("Adding…", "");
  try {
    const res = await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, topic }),
    });
    if (res.status === 409) {
      setModalStatus("This feed URL already exists.", "error");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setModalStatus(data.detail || "Failed to add feed.", "error");
      return;
    }
    closeAddFeedModal();
    const topics = await fetchTopics();
    renderTopics(topics);
    await loadNews(activeTopic);
  } catch {
    setModalStatus("Network error. Is the server running?", "error");
  } finally {
    addFeedSubmit.disabled = false;
  }
});

// --- Render topic buttons ---

function renderTopics(topics) {
  const existing = filtersNav.querySelectorAll(".topic-btn");
  existing.forEach(b => { if (b.dataset.topic !== "") b.remove(); });

  topics.forEach(topic => {
    const btn = document.createElement("button");
    btn.className = "topic-btn";
    btn.dataset.topic = topic;
    btn.textContent = topic;
    btn.style.setProperty("--topic-clr", topicBg(topic));
    filtersNav.appendChild(btn);
  });

  // Populate datalist for topic autocomplete
  topicSuggestions.innerHTML = topics.map(t => `<option value="${escHtml(t)}"></option>`).join("");
}

// --- Event handling ---

filtersNav.addEventListener("click", async (e) => {
  const btn = e.target.closest(".topic-btn");
  if (!btn) return;

  filtersNav.querySelectorAll(".topic-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeTopic = btn.dataset.topic;

  await loadNews(activeTopic);
});

// --- Load flows ---

async function loadNews(topic = "") {
  renderSkeletons();
  clearStatus();
  try {
    const articles = await fetchNews(topic);
    renderCards(articles);
  } catch (err) {
    grid.innerHTML = "";
    setStatus("Could not load articles. Is the server running?", true);
  }
}

async function init() {
  updateBadge();
  updateNotifBtn();
  setViewMode(viewMode);
  try {
    const topics = await fetchTopics();
    renderTopics(topics);
  } catch {
    // Topics failed — still try to show all news
  }
  await loadNews();
  saveKnownLinks(allArticles);
  startAutoRefresh();
  applyJellyfish(jellyActive);
}

init();
