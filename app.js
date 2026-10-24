// De site leest enkel data.json (gemaakt met tools/maak-lijst.py). Geen API, geen sleutels.
const PAGE_SIZE = 12;

let DATA = null;
let selectedCategories = new Set();
let selectedGenres = new Set();
let selectedEnergy = null;
let allResults = [];
let shownCount = 0;

const el = (id) => document.getElementById(id);
const resultsEl = el("results");

function showStatus(msg) {
  const area = el("statusArea");
  area.classList.toggle("hidden", !msg);
  area.textContent = msg || "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- Zoeken in de lijst ----------
function searchPlaylists() {
  const tokens = el("themeInput").value.trim().toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  const minTracks = Number(el("minTracksSelect").value) || 0;

  return DATA.playlists
    .map((pl) => {
      let score = 0;

      if (selectedCategories.size) {
        const hits = pl.categories.filter((c) => selectedCategories.has(c)).length;
        if (!hits) return null;
        score += hits * 3;
      }
      if (selectedGenres.size) {
        const hits = pl.genres.filter((g) => selectedGenres.has(g)).length;
        if (!hits) return null;
        score += hits * 2;
      }
      if (selectedEnergy) {
        if (!pl.energies.includes(selectedEnergy)) return null;
        score += 2;
      }
      if (tokens.length) {
        const haystack = `${pl.name} ${pl.desc} ${pl.categories.join(" ")} ${pl.genres.join(" ")}`.toLowerCase();
        const hits = tokens.filter((t) => haystack.includes(t)).length;
        if (!hits) return null;
        const nameHits = tokens.filter((t) => pl.name.toLowerCase().includes(t)).length;
        score += hits * 3 + nameHits * 4;
      }
      if (minTracks && pl.tracks != null && pl.tracks < minTracks) return null;
      if (pl.spotify) score += 2;

      return { pl, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || (b.pl.followers || 0) - (a.pl.followers || 0))
    .map((x) => x.pl);
}

function runSearch() {
  resultsEl.innerHTML = "";
  el("moreBtn").classList.add("hidden");

  const nothingChosen =
    !selectedCategories.size && !selectedGenres.size && !selectedEnergy && !el("themeInput").value.trim();
  if (nothingChosen) {
    showStatus("Kies minstens een categorie, genre of energieniveau, of typ een thema.");
    return;
  }

  allResults = searchPlaylists();
  shownCount = 0;

  if (allResults.length === 0) {
    showStatus("Geen playlists gevonden. Kies minder filters, een kortere minimale lengte of een ander thema.");
    return;
  }
  showStatus(allResults.length === 1 ? "1 playlist gevonden." : `${allResults.length} playlists gevonden.`);
  renderMore();
}

function renderMore() {
  allResults.slice(shownCount, shownCount + PAGE_SIZE).forEach((pl) => {
    resultsEl.appendChild(buildResultCard(pl));
  });
  shownCount = Math.min(shownCount + PAGE_SIZE, allResults.length);
  el("moreBtn").classList.toggle("hidden", shownCount >= allResults.length);
  el("moreBtn").textContent = `Toon meer (${allResults.length - shownCount} over)`;
}

function buildResultCard(pl) {
  const name = pl.name || "Naamloze playlist";
  const webUrl = `https://open.spotify.com/playlist/${pl.id}`;
  const appUrl = `spotify:playlist:${pl.id}`;

  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    <a class="cover" href="${escapeHtml(appUrl)}">
      ${pl.img ? `<img src="${escapeHtml(pl.img)}" alt="" loading="lazy" />` : '<div class="cover-empty"></div>'}
      ${pl.spotify ? '<span class="badge">Spotify</span>' : ""}
    </a>
    <div class="result-body">
      <h3><a href="${escapeHtml(appUrl)}">${escapeHtml(name)}</a></h3>
      <div class="result-actions">
        <a class="btn btn-primary" href="${escapeHtml(appUrl)}">Open in Spotify-app</a>
        <button class="btn btn-ghost fav-btn" title="Bewaar in shortlist"></button>
      </div>
      <a class="web-link" href="${escapeHtml(webUrl)}" target="_blank" rel="noopener">of open in webspeler</a>
    </div>
  `;

  const img = card.querySelector("img");
  if (img) img.addEventListener("error", () => img.replaceWith(Object.assign(document.createElement("div"), { className: "cover-empty" })));

  const favBtn = card.querySelector(".fav-btn");
  const refresh = () => {
    const isFav = isFavorite(pl.id);
    favBtn.textContent = isFav ? "★" : "☆";
    favBtn.classList.toggle("active", isFav);
  };
  favBtn.addEventListener("click", () => {
    toggleFavorite({ id: pl.id, name, url: webUrl, img: pl.img });
    refresh();
  });
  refresh();
  return card;
}

// ---------- Favorieten (shortlist) ----------
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("favorites") || "[]");
  } catch (e) {
    return [];
  }
}
function saveFavorites(list) {
  try {
    localStorage.setItem("favorites", JSON.stringify(list));
  } catch (e) {
    // opslag niet beschikbaar (bv. privévenster)
  }
}
function isFavorite(id) {
  return getFavorites().some((f) => f.id === id);
}
function toggleFavorite(fav) {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === fav.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(fav);
  saveFavorites(list);
  renderFavorites();
}

function renderFavorites() {
  const list = getFavorites();
  const grid = el("favorites");
  grid.innerHTML = "";
  el("favoritesSection").classList.toggle("hidden", list.length === 0);

  list.forEach((fav) => {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.innerHTML = `
      ${fav.img ? `<img src="${escapeHtml(fav.img)}" alt="" />` : '<div class="cover-empty small"></div>'}
      <a href="spotify:playlist:${escapeHtml(fav.id)}">${escapeHtml(fav.name)}</a>
      <button class="btn btn-ghost" title="Verwijder uit shortlist">✕</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      toggleFavorite(fav);
      // sterretjes in de resultaten bijwerken
      resultsEl.innerHTML = "";
      allResults.slice(0, shownCount).forEach((pl) => resultsEl.appendChild(buildResultCard(pl)));
    });
    grid.appendChild(item);
  });
}

async function copyFavorites() {
  const text = getFavorites().map((f) => `${f.name}\n${f.url}`).join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    el("copyFavsBtn").textContent = "Gekopieerd!";
  } catch (e) {
    el("copyFavsBtn").textContent = "Kopiëren mislukt";
  }
  setTimeout(() => (el("copyFavsBtn").textContent = "Kopieer links"), 1500);
}

// ---------- Knoppen opbouwen ----------
function buildMultiSelectChips(containerId, labels, selectedSet) {
  const wrap = el(containerId);
  wrap.innerHTML = "";
  labels.forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (selectedSet.has(label)) selectedSet.delete(label);
      else selectedSet.add(label);
      btn.classList.toggle("active", selectedSet.has(label));
    });
    wrap.appendChild(btn);
  });
}

function buildEnergyChips(energies) {
  const wrap = el("energyChips");
  wrap.innerHTML = "";
  Object.entries(energies).forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      const wasActive = selectedEnergy === key;
      wrap.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      selectedEnergy = wasActive ? null : key;
      if (!wasActive) btn.classList.add("active");
    });
    wrap.appendChild(btn);
  });
}

// ---------- Start ----------
async function init() {
  el("searchBtn").addEventListener("click", runSearch);
  el("moreBtn").addEventListener("click", renderMore);
  el("copyFavsBtn").addEventListener("click", copyFavorites);
  el("themeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  renderFavorites();

  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (e) {
    showStatus("De lijst met playlists kon niet geladen worden. Probeer de pagina te herladen.");
    el("searchBtn").disabled = true;
    return;
  }

  buildMultiSelectChips("categoryChips", DATA.categories, selectedCategories);
  buildMultiSelectChips("genreChips", DATA.genres, selectedGenres);
  buildEnergyChips(DATA.energies);
}

init();
