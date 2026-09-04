// ---------- Config ----------
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

// ---------- API base storage ----------
function getApiBase() {
  return (localStorage.getItem("api_base") || "").replace(/\/+$/, "");
}
function setApiBase(url) {
  localStorage.setItem("api_base", url.trim().replace(/\/+$/, ""));
}

function updateSetupUI() {
  const configured = !!getApiBase();
  setupNotice.classList.toggle("hidden", configured);
  searchSection.classList.toggle("hidden", !configured);
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

async function searchPlaylistsForQuery(query) {
  const params = new URLSearchParams({ q: query, type: "playlist", limit: "10" });
  const res = await fetch(`${getApiBase()}/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.playlists?.items || []).filter(Boolean);
}

async function fetchPlaylistDetails(id) {
  try {
    const params = new URLSearchParams({ fields: "id,name,external_urls,images,owner,followers,tracks.total" });
    const res = await fetch(`${getApiBase()}/playlists/${id}?${params.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function runSearch() {
  const queries = buildQueries();
  resultsEl.innerHTML = "";
  showStatus(`Zoeken op Spotify (${queries.length} zoekopdrachten)...`);

  const hitCounts = new Map();
  const stubs = new Map();
  for (const query of queries) {
    const items = await searchPlaylistsForQuery(query);
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
    showStatus("Geen playlists gevonden. Probeer een ander thema of categorie, of controleer je API-adres bij Instellingen.");
    return;
  }

  showStatus(`${candidates.length} kandidaten gevonden, details ophalen...`);

  const details = [];
  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchDetails = await Promise.all(batch.map((c) => fetchPlaylistDetails(c.id)));
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

// ---------- Init ----------
function init() {
  el("apiBaseInput").value = getApiBase();
  el("saveApiBaseBtn").addEventListener("click", () => {
    setApiBase(el("apiBaseInput").value);
    updateSetupUI();
  });

  el("settingsBtn").addEventListener("click", () => {
    setupNotice.classList.toggle("hidden");
  });

  el("searchBtn").addEventListener("click", runSearch);

  buildCategoryChips();
  buildEnergyChips();
  updateSetupUI();
}

init();
