// ---------- Config ----------
const CATEGORIES = {
  "Chic diner": { context: "dinner", queries: ["elegant dinner jazz", "sophisticated dinner background", "fine dining instrumental"] },
  "Cocktailparty": { context: "cocktail party", queries: ["cocktail party lounge", "cocktail hour jazz", "sophisticated lounge"] },
  "Netwerkevent / receptie": { context: "corporate reception", queries: ["corporate reception background", "networking event instrumental", "elegant background music"] },
  "Bruiloft - ceremonie": { context: "wedding ceremony", queries: ["wedding ceremony instrumental", "romantic wedding background"] },
  "Bruiloft - feest": { context: "wedding party", queries: ["wedding party dance hits", "wedding reception party"] },
  "Verjaardagsfeest": { context: "birthday party", queries: ["birthday party hits", "feestmuziek verjaardag"] },
  "Achtergrond concert": { context: "ambient background", queries: ["ambient concert background", "instrumental chill background"] },
  "Lounge / relax": { context: "lounge", queries: ["chill lounge background", "relaxed lounge instrumental"] },
  "Gala / award show": { context: "gala evening", queries: ["gala evening elegant", "award show orchestral"] },
  "Zomerse borrel / terras": { context: "summer terrace", queries: ["summer terrace chill", "outdoor party background", "zomerse borrel"] },
  "Kerst / eindejaarsfeest": { context: "christmas holiday party", queries: ["christmas party hits", "holiday party background", "new year's eve party"] },
  "Brunch / lunch": { context: "brunch", queries: ["sunday brunch background", "brunch acoustic chill", "daytime lunch background"] },
  "Beurs / productlancering": { context: "trade show launch", queries: ["corporate event background", "product launch energetic", "trade show ambient"] },
  "Wijnproeverij / degustatie": { context: "wine tasting", queries: ["wine tasting background", "sommelier lounge jazz", "vineyard chill"] },
  "Modeshow / fashion event": { context: "fashion show", queries: ["fashion show runway", "high fashion electronic", "editorial fashion playlist"] },
  "Opening / vernissage": { context: "art gallery opening", queries: ["gallery opening ambient", "art exhibition background", "sophisticated art event"] },
  "Vintage thema (jaren 20-80)": { context: "retro vintage party", queries: ["roaring twenties gatsby jazz", "retro disco party", "vintage vinyl classics"] },
  "Kinderfeest / familiefeest": { context: "kids family party", queries: ["kids party hits", "family fun background", "children's birthday songs"] },
  "Halloween feest": { context: "halloween party", queries: ["halloween party hits", "spooky halloween background", "halloween dance party"] },
  "Afterparty / late night": { context: "late night party", queries: ["late night house party", "afterparty techno", "club night background"] },
  "Seminarie / vergadering": { context: "quiet office meeting", queries: ["quiet focus background", "corporate meeting ambient", "subtle instrumental office"] },
  "Wellness / spa": { context: "spa wellness", queries: ["spa relaxation music", "wellness meditation background", "yoga calm ambient"] },
};

const GENRES = {
  "Jazz": "jazz",
  "Lounge / Chill": "chill lounge",
  "Klassiek / Instrumentaal": "classical instrumental",
  "Pop": "pop hits",
  "House / Electronic": "house electronic",
  "R&B / Soul": "rnb soul",
  "Latin": "latin",
  "Funk / Disco": "funk disco",
  "Rock": "rock",
  "Hip-Hop": "hip hop",
  "Akoestisch": "acoustic singer songwriter",
  "Wereldmuziek": "world music",
};

const ENERGY_MODIFIERS = {
  zeer_rustig: "very calm minimal soft background",
  rustig: "ambient background calm",
  gezellig: "cozy background",
  energiek: "energetic upbeat feelgood",
  dansbaar: "upbeat dance party",
};

// ---------- State ----------
let selectedCategories = new Set();
let selectedGenres = new Set();
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

// ---------- Settings storage ----------
const DEFAULT_MIN_FOLLOWERS = 5000;

function getApiBase() {
  return (localStorage.getItem("api_base") || "").replace(/\/+$/, "");
}
function setApiBase(url) {
  localStorage.setItem("api_base", url.trim().replace(/\/+$/, ""));
}

function getMinFollowers() {
  const stored = localStorage.getItem("min_followers");
  return stored === null ? DEFAULT_MIN_FOLLOWERS : Number(stored);
}
function setMinFollowers(value) {
  const num = Number(value);
  localStorage.setItem("min_followers", Number.isFinite(num) && num >= 0 ? num : DEFAULT_MIN_FOLLOWERS);
}

function updateSetupUI() {
  const configured = !!getApiBase();
  setupNotice.classList.toggle("hidden", configured);
  searchSection.classList.toggle("hidden", !configured);
}

// ---------- Search + ranking ----------
function buildQueries() {
  const queries = new Set();
  const theme = el("themeInput").value.trim();

  selectedCategories.forEach((label) => {
    CATEGORIES[label].queries.forEach((q) => queries.add(q));
  });

  if (theme) {
    queries.add(theme);
    queries.add(`${theme} playlist`);
    queries.add(`${theme} background music`);
  }

  if (selectedGenres.size > 0) {
    const contexts = selectedCategories.size > 0
      ? [...selectedCategories].map((label) => CATEGORIES[label].context)
      : [theme || "event"];
    selectedGenres.forEach((genreLabel) => {
      const genreFragment = GENRES[genreLabel];
      contexts.forEach((context) => queries.add(`${genreFragment} ${context}`));
    });
  }

  if (selectedEnergy) {
    const modifier = ENERGY_MODIFIERS[selectedEnergy];
    const bases = selectedCategories.size > 0
      ? [...selectedCategories].map((label) => CATEGORIES[label].context)
      : [theme || "event"];
    bases.forEach((base) => queries.add(`${base} ${modifier}`));
  }

  if (queries.size === 0) {
    queries.add("background music event");
  }

  return [...queries].slice(0, 10);
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
    const params = new URLSearchParams({ fields: "id,name,external_urls,images,owner,followers" });
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
      if (d) details.push({ ...batch[idx].stub, ...d, hits: batch[idx].hits });
      else details.push({ ...batch[idx].stub, hits: batch[idx].hits, followers: null });
    });
  }

  details.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    const fa = a.followers?.total || 0;
    const fb = b.followers?.total || 0;
    return fb - fa;
  });

  const minFollowers = getMinFollowers();
  const filtered = details.filter((pl) => (pl.followers?.total || 0) >= minFollowers);

  if (filtered.length === 0) {
    showStatus(`Geen playlists gevonden met minstens ${minFollowers.toLocaleString("nl-BE")} volgers. Verlaag de drempel bij Instellingen of probeer een ander thema.`);
    return;
  }

  renderResults(filtered.slice(0, 12));
  showStatus(filtered.length < details.length ? `${details.length - filtered.length} playlist(s) weggefilterd wegens te weinig volgers.` : "");
}

function renderResults(playlists) {
  resultsEl.innerHTML = "";
  playlists.forEach((pl) => {
    const img = pl.images?.[0]?.url || "";
    const followers = pl.followers?.total;
    const owner = pl.owner?.display_name || pl.owner?.id || "";
    const trackCount = pl.items?.total;

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
function buildMultiSelectChips(containerId, labels, selectedSet) {
  const wrap = el(containerId);
  wrap.innerHTML = "";
  labels.forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (selectedSet.has(label)) {
        selectedSet.delete(label);
        btn.classList.remove("active");
      } else {
        selectedSet.add(label);
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
  el("minFollowersInput").value = getMinFollowers();
  el("saveSettingsBtn").addEventListener("click", () => {
    setApiBase(el("apiBaseInput").value);
    setMinFollowers(el("minFollowersInput").value);
    updateSetupUI();
  });

  el("settingsBtn").addEventListener("click", () => {
    setupNotice.classList.toggle("hidden");
  });

  el("searchBtn").addEventListener("click", runSearch);

  buildMultiSelectChips("categoryChips", Object.keys(CATEGORIES), selectedCategories);
  buildMultiSelectChips("genreChips", Object.keys(GENRES), selectedGenres);
  buildEnergyChips();
  updateSetupUI();
}

init();
