// ---------- Config ----------
const REDIRECT_URI = window.location.origin + window.location.pathname;
const AUTH_SCOPES = "user-read-private user-read-email";

const CATEGORY_QUERIES = {
  "Chic diner": ["elegant dinner jazz", "sophisticated dinner background", "fine dining instrumental"],
  "Cocktailparty": ["cocktail party lounge", "cocktail hour jazz", "sophisticated lounge"],
  "Netwerkevent / receptie": ["corporate reception background", "networking event instrumental", "elegant background music"],
  "Bruiloft - ceremonie": ["wedding ceremony instrumental", "romantic wedding background"],
  "Bruiloft - feest": ["wedding party dance hits", "wedding reception party"],
  "Verjaardagsfeest": ["birthday party hits", "feestmuziek verjaardag"],
  "Achtergrond concert": ["ambient concert background", "instrumental chill background"],
  "Lounge / relax": ["chill lounge background", "relaxed lounge instrumental"],
  "Gala / award show": ["gala evening elegant", "award show orchestral"],
  "Zomerse borrel / terras": ["summer terrace chill", "outdoor party background", "zomerse borrel"],
};

const ENERGY_MODIFIERS = {
  rustig: "ambient background calm",
  gezellig: "cozy background",
  dansbaar: "upbeat dance party",
};

// ---------- State ----------
let selectedCategories = new Set();
let selectedEnergy = null;

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const setupNotice = el("setupNotice");
const searchSection = el("searchSection");
const statusArea = el("statusArea");
const resultsEl = el("results");

function showStatus(msg) {
  if (!msg) {
    statusArea.classList.add("hidden");
    statusArea.textContent = "";
    return;
  }
  statusArea.classList.remove("hidden");
  statusArea.textContent = msg;
}

// ---------- Client ID storage ----------
function getClientId() {
  return localStorage.getItem("spotify_client_id") || "";
}
function setClientId(id) {
  localStorage.setItem("spotify_client_id", id.trim());
}

// ---------- PKCE helpers ----------
function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((v) => chars[v % chars.length]).join("");
}

async function sha256Base64Url(plain) {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ---------- Token storage ----------
function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiresAt = Date.now() + expires_in * 1000 - 30000;
  localStorage.setItem("sp_access_token", access_token);
  if (refresh_token) localStorage.setItem("sp_refresh_token", refresh_token);
  localStorage.setItem("sp_expires_at", String(expiresAt));
}

function clearTokens() {
  ["sp_access_token", "sp_refresh_token", "sp_expires_at"].forEach((k) => localStorage.removeItem(k));
}

async function getValidAccessToken() {
  const token = localStorage.getItem("sp_access_token");
  const expiresAt = Number(localStorage.getItem("sp_expires_at") || 0);
  if (token && Date.now() < expiresAt) return token;

  const refreshToken = localStorage.getItem("sp_refresh_token");
  if (!refreshToken) return null;

  const clientId = getClientId();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  saveTokens(data);
  return data.access_token;
}

// ---------- Auth flow ----------
async function startLogin() {
  const clientId = getClientId();
  if (!clientId) {
    setupNotice.classList.remove("hidden");
    return;
  }
  const codeVerifier = randomString(64);
  localStorage.setItem("sp_code_verifier", codeVerifier);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: AUTH_SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  const codeVerifier = localStorage.getItem("sp_code_verifier");
  const clientId = getClientId();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  window.history.replaceState({}, document.title, window.location.pathname);

  if (!res.ok) {
    showStatus("Inloggen mislukt. Controleer je Client ID en Redirect URI.");
    return false;
  }
  const data = await res.json();
  saveTokens(data);
  return true;
}

function logout() {
  clearTokens();
  updateAuthUI();
}

// ---------- UI wiring ----------
function buildCategoryChips() {
  const wrap = el("categoryChips");
  wrap.innerHTML = "";
  Object.keys(CATEGORY_QUERIES).forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (selectedCategories.has(label)) {
        selectedCategories.delete(label);
        btn.classList.remove("active");
      } else {
        selectedCategories.add(label);
        btn.classList.add("active");
      }
    });
    wrap.appendChild(btn);
  });
}

function buildEnergyChips() {
  const chips = document.querySelectorAll("#energyChips .chip");
  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.energy;
      const wasActive = btn.classList.contains("active");
      chips.forEach((b) => b.classList.remove("active"));
      if (!wasActive) {
        btn.classList.add("active");
        selectedEnergy = val;
      } else {
        selectedEnergy = null;
      }
    });
  });
}

async function updateAuthUI() {
  const token = await getValidAccessToken();
  const loginBtn = el("loginBtn");
  const userInfo = el("userInfo");

  if (!token) {
    loginBtn.classList.remove("hidden");
    userInfo.classList.add("hidden");
    searchSection.classList.add("hidden");
    return;
  }

  loginBtn.classList.add("hidden");
  userInfo.classList.remove("hidden");
  searchSection.classList.remove("hidden");

  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const me = await res.json();
      el("userName").textContent = me.display_name || me.id;
    }
  } catch (e) {
    // non-fatal
  }
}

// ---------- Search + ranking ----------
function buildQueries() {
  const queries = new Set();

  selectedCategories.forEach((label) => {
    CATEGORY_QUERIES[label].forEach((q) => queries.add(q));
  });

  const theme = el("themeInput").value.trim();
  if (theme) {
    queries.add(theme);
    queries.add(`${theme} playlist`);
    queries.add(`${theme} background music`);
  }

  if (selectedEnergy) {
    const modifier = ENERGY_MODIFIERS[selectedEnergy];
    const base = theme || [...selectedCategories][0] || "event";
    queries.add(`${base} ${modifier}`);
  }

  if (queries.size === 0) {
    queries.add("background music event");
  }

  return [...queries].slice(0, 8);
}

async function searchPlaylistsForQuery(token, query) {
  const params = new URLSearchParams({ q: query, type: "playlist", limit: "10" });
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.playlists?.items || []).filter(Boolean);
}

async function fetchPlaylistDetails(token, id) {
  try {
    const params = new URLSearchParams({ fields: "id,name,external_urls,images,owner,followers,tracks.total" });
    const res = await fetch(`https://api.spotify.com/v1/playlists/${id}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function runSearch() {
  const token = await getValidAccessToken();
  if (!token) {
    showStatus("Je bent niet (meer) ingelogd. Log opnieuw in.");
    return;
  }

  const queries = buildQueries();
  resultsEl.innerHTML = "";
  showStatus(`Zoeken op Spotify (${queries.length} zoekopdrachten)...`);

  const hitCounts = new Map();
  const stubs = new Map();
  for (const query of queries) {
    const items = await searchPlaylistsForQuery(token, query);
    items.forEach((item) => {
      hitCounts.set(item.id, (hitCounts.get(item.id) || 0) + 1);
      if (!stubs.has(item.id)) stubs.set(item.id, item);
    });
  }

  const candidates = [...hitCounts.keys()]
    .map((id) => ({ id, hits: hitCounts.get(id), stub: stubs.get(id) }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 24);

  if (candidates.length === 0) {
    showStatus("Geen playlists gevonden. Probeer een ander thema of categorie.");
    return;
  }

  showStatus(`${candidates.length} kandidaten gevonden, details ophalen...`);

  const details = [];
  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchDetails = await Promise.all(batch.map((c) => fetchPlaylistDetails(token, c.id)));
    batchDetails.forEach((d, idx) => {
      if (d) details.push({ ...d, hits: batch[idx].hits });
      else details.push({ ...batch[idx].stub, hits: batch[idx].hits, followers: null });
    });
  }

  details.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    const fa = a.followers?.total || 0;
    const fb = b.followers?.total || 0;
    return fb - fa;
  });

  renderResults(details.slice(0, 12));
  showStatus("");
}

function renderResults(playlists) {
  resultsEl.innerHTML = "";
  playlists.forEach((pl) => {
    const img = pl.images?.[0]?.url || "";
    const followers = pl.followers?.total;
    const owner = pl.owner?.display_name || pl.owner?.id || "";
    const trackCount = pl.tracks?.total;

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      ${img ? `<img src="${img}" alt="${escapeHtml(pl.name)}" loading="lazy" />` : ""}
      <div class="result-body">
        <h3>${escapeHtml(pl.name || "Naamloze playlist")}</h3>
        <div class="result-meta">
          ${owner ? `door ${escapeHtml(owner)}` : ""}
          ${trackCount ? ` · ${trackCount} tracks` : ""}
          ${followers != null ? ` · ${followers.toLocaleString("nl-BE")} volgers` : ""}
        </div>
        <div class="result-actions">
          <a class="btn btn-primary" href="${pl.external_urls?.spotify}" target="_blank" rel="noopener">Open in Spotify</a>
        </div>
        <div class="embed-wrap">
          <iframe src="https://open.spotify.com/embed/playlist/${pl.id}?utm_source=generator" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
        </div>
      </div>
    `;
    resultsEl.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------
async function init() {
  el("clientIdInput").value = getClientId();
  el("saveClientIdBtn").addEventListener("click", () => {
    setClientId(el("clientIdInput").value);
    setupNotice.classList.add("hidden");
    updateAuthUI();
  });

  el("loginBtn").addEventListener("click", startLogin);
  el("logoutBtn").addEventListener("click", logout);
  el("searchBtn").addEventListener("click", runSearch);

  buildCategoryChips();
  buildEnergyChips();

  if (!getClientId()) {
    setupNotice.classList.remove("hidden");
  }

  const gotToken = await handleAuthCallback();
  await updateAuthUI();

  if (gotToken) showStatus("");
}

init();
