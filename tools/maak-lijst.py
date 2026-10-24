#!/usr/bin/env python3
"""Maakt data.json: de handmatig te controleren lijst met playlists voor de site.

Gebruik (eigen Spotify-sleutels, rechtstreeks):
    SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... python3 tools/maak-lijst.py
Of via een bestaande proxy:
    API_BASE=https://jouw-worker.workers.dev python3 tools/maak-lijst.py

De site zelf gebruikt na het genereren geen API meer: ze leest enkel data.json.
Playlists van Spotify zelf staan in EXTRA (worden via de openbare oEmbed gecontroleerd).
"""
import base64
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

MIN_FOLLOWERS = 2000
MIN_TRACKS = 20
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data.json")

CATEGORIES = {
    "Chic diner": {"queries": ["elegant dinner jazz", "sophisticated dinner background", "fine dining instrumental"]},
    "Cocktailparty": {"queries": ["cocktail party lounge", "cocktail hour jazz", "sophisticated lounge"]},
    "Netwerkevent / receptie": {"queries": ["corporate reception background", "networking event instrumental", "elegant background music"]},
    "Bruiloft - ceremonie": {"queries": ["wedding ceremony instrumental", "romantic wedding background"]},
    "Bruiloft - feest": {"queries": ["wedding party dance hits", "wedding reception party"]},
    "Verjaardagsfeest": {"queries": ["birthday party hits", "feestmuziek verjaardag"]},
    "Achtergrond concert": {"queries": ["ambient concert background", "instrumental chill background"]},
    "Lounge / relax": {"queries": ["chill lounge background", "relaxed lounge instrumental"]},
    "Gala / award show": {"queries": ["gala evening elegant", "award show orchestral", "gala dinner music", "red carpet", "black tie event"]},
    "Zomerse borrel / terras": {"queries": ["summer terrace chill", "outdoor party background", "zomerse borrel", "summer lounge", "garden party", "beach bar chill"]},
    "Kerst / eindejaarsfeest": {"queries": ["christmas party hits", "holiday party background", "new year's eve party"]},
    "Brunch / lunch": {"queries": ["sunday brunch background", "brunch acoustic chill", "daytime lunch background"]},
    "Beurs / productlancering": {"queries": ["corporate event background", "product launch energetic", "trade show ambient", "conference background music", "business event playlist", "corporate upbeat"]},
    "Wijnproeverij / degustatie": {"queries": ["wine tasting background", "sommelier lounge jazz", "vineyard chill"]},
    "Modeshow / fashion event": {"queries": ["fashion show runway", "high fashion electronic", "editorial fashion playlist", "runway music", "fashion week playlist"]},
    "Opening / vernissage": {"queries": ["gallery opening ambient", "art exhibition background", "sophisticated art event", "museum ambient", "art gallery playlist"]},
    "Vintage thema (jaren 20-80)": {"queries": ["roaring twenties gatsby jazz", "retro disco party", "vintage vinyl classics", "1950s rock and roll", "70s disco", "80s party hits"]},
    "Kinderfeest / familiefeest": {"queries": ["kids party hits", "family fun background", "children's birthday songs", "kids dance party", "family friendly pop"]},
    "Halloween feest": {"queries": ["halloween party hits", "spooky halloween background", "halloween dance party"]},
    "Afterparty / late night": {"queries": ["late night house party", "afterparty techno", "club night background", "after hours", "late night lounge"]},
    "Seminarie / vergadering": {"queries": ["quiet focus background", "corporate meeting ambient", "subtle instrumental office", "office background music", "conference ambient"]},
    "Wellness / spa": {"queries": ["spa relaxation music", "wellness meditation background", "yoga calm ambient"]},
}

# genre -> (zoekterm, trefwoorden in naam/omschrijving)
GENRES = {
    "Jazz": ("jazz", ["jazz", "swing", "bebop"]),
    "Lounge / Chill": ("chill lounge", ["lounge", "chill", "downtempo"]),
    "Klassiek / Instrumentaal": ("classical instrumental", ["classical", "orchestra", "instrumental", "piano", "strings"]),
    "Pop": ("pop hits", ["pop"]),
    "House / Electronic": ("house electronic", ["house", "electronic", "techno", "edm"]),
    "R&B / Soul": ("rnb soul", ["r&b", "rnb", "soul"]),
    "Latin": ("latin", ["latin", "reggaeton", "salsa", "bachata"]),
    "Funk / Disco": ("funk disco", ["funk", "disco"]),
    "Rock": ("rock", ["rock"]),
    "Hip-Hop": ("hip hop", ["hip hop", "hip-hop", "rap"]),
    "Akoestisch": ("acoustic singer songwriter", ["acoustic", "singer-songwriter", "folk"]),
    "Wereldmuziek": ("world music", ["world", "afro", "bossa", "reggae", "ethnic"]),
}

# energie -> (label, zoekterm, trefwoorden)
ENERGIES = {
    "zeer_rustig": ("Heel rustig", "very calm minimal soft background", ["ambient", "sleep", "meditation", "calm", "soft", "minimal"]),
    "rustig": ("Rustig achtergrond", "ambient background calm", ["background", "relax", "lounge", "easy", "chill"]),
    "gezellig": ("Gezellig", "cozy background", ["cozy", "cosy", "coffee", "brunch", "dinner", "feel good", "feel-good"]),
    "energiek": ("Energiek", "energetic upbeat feelgood", ["upbeat", "energetic", "feelgood", "hits"]),
    "dansbaar": ("Dansbaar / feest", "upbeat dance party", ["dance", "party", "club", "dancefloor", "banger"]),
}

# Playlists van Spotify zelf (handmatig gekozen, via oEmbed gecontroleerd)
EXTRA = {
    "37i9dQZF1DX4wta20PHgwo": {"categories": ["Chic diner", "Cocktailparty", "Wijnproeverij / degustatie"], "genres": ["Jazz"], "energies": ["rustig"]},
    "37i9dQZF1DX0SM0LYsmbMT": {"categories": ["Chic diner", "Brunch / lunch", "Netwerkevent / receptie"], "genres": ["Jazz"], "energies": ["gezellig"]},
    "37i9dQZF1DWVqfgj8NZEp1": {"categories": ["Brunch / lunch", "Chic diner"], "genres": ["Jazz"], "energies": ["gezellig", "rustig"]},
    "37i9dQZF1DX4xuWVBs4FgJ": {"categories": ["Chic diner", "Brunch / lunch"], "genres": ["Lounge / Chill"], "energies": ["gezellig"]},
    "37i9dQZF1DX4sWSpwq3LiO": {"categories": ["Achtergrond concert", "Bruiloft - ceremonie", "Wellness / spa", "Seminarie / vergadering"], "genres": ["Klassiek / Instrumentaal"], "energies": ["zeer_rustig"]},
    "37i9dQZF1DX7K31D69s4M1": {"categories": ["Netwerkevent / receptie", "Opening / vernissage", "Seminarie / vergadering"], "genres": ["Klassiek / Instrumentaal"], "energies": ["zeer_rustig", "rustig"]},
    "37i9dQZF1DWWEJlAGA9gs0": {"categories": ["Gala / award show", "Bruiloft - ceremonie", "Opening / vernissage"], "genres": ["Klassiek / Instrumentaal"], "energies": ["rustig"]},
    "37i9dQZF1DX889U0CL85jj": {"categories": ["Lounge / relax", "Zomerse borrel / terras"], "genres": ["Lounge / Chill"], "energies": ["rustig"]},
    "37i9dQZF1DX6VdMW310YC7": {"categories": ["Lounge / relax", "Achtergrond concert"], "genres": ["Lounge / Chill", "House / Electronic"], "energies": ["rustig"]},
    "37i9dQZF1DX4WYpdgoIcn6": {"categories": ["Zomerse borrel / terras", "Cocktailparty"], "genres": ["Lounge / Chill", "Pop"], "energies": ["gezellig"]},
    "37i9dQZF1DX9uKNf5jGX6m": {"categories": ["Wellness / spa"], "genres": ["Klassiek / Instrumentaal"], "energies": ["zeer_rustig"]},
    "37i9dQZF1DX1s9knjP51Oa": {"categories": ["Wellness / spa", "Lounge / relax"], "genres": ["Lounge / Chill"], "energies": ["zeer_rustig"]},
}

HEADERS = {"User-Agent": "Mozilla/5.0 (maak-lijst.py)"}
API_BASE = os.environ.get("API_BASE", "").rstrip("/")
CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET")
_token = None


def token():
    global _token
    if _token is None:
        creds = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        req = urllib.request.Request(
            "https://accounts.spotify.com/api/token",
            data=b"grant_type=client_credentials",
            headers={**HEADERS, "Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
        )
        _token = json.load(urllib.request.urlopen(req, timeout=30))["access_token"]
    return _token


def get(path, params=None, retries=6):
    qs = "?" + urllib.parse.urlencode(params) if params else ""
    if API_BASE:
        url, headers = f"{API_BASE}{path}{qs}", dict(HEADERS)
    else:
        url, headers = f"https://api.spotify.com/v1{path}{qs}", {**HEADERS, "Authorization": f"Bearer {token()}"}
    for attempt in range(retries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "3")) + 1)
            elif e.code in (500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
            else:
                return None
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def oembed(pid):
    url = "https://open.spotify.com/oembed?url=" + urllib.parse.quote(f"https://open.spotify.com/playlist/{pid}")
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20))
        except Exception:
            time.sleep(2)
    return None


def main():
    if not API_BASE and not (CLIENT_ID and CLIENT_SECRET):
        sys.exit("Zet SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET, of API_BASE. Zie de uitleg bovenaan.")

    jobs = []  # (query, soort, label)
    for label, c in CATEGORIES.items():
        jobs += [(q, "categories", label) for q in c["queries"]]
    for label, (frag, _) in GENRES.items():
        jobs += [(f"{frag} playlist", "genres", label), (f"{frag} background music", "genres", label)]
    for key, (_, frag, _) in ENERGIES.items():
        jobs += [(frag, "energies", key), (f"{frag} playlist", "energies", key)]

    cands = {}

    def run(job):
        q, kind, label = job
        data = get("/search", {"q": q, "type": "playlist", "limit": 10}) or {}
        return job, [i for i in (data.get("playlists") or {}).get("items", []) if i]

    print(f"{len(jobs)} zoekopdrachten...", flush=True)
    with ThreadPoolExecutor(4) as ex:
        for (q, kind, label), items in ex.map(run, jobs):
            for it in items:
                c = cands.setdefault(it["id"], {"it": it, "categories": set(), "genres": set(), "energies": set()})
                c[kind].add(label)

    ids = [i for i, c in cands.items() if (c["it"].get("items") or {}).get("total", 0) >= MIN_TRACKS]
    print(f"{len(cands)} unieke playlists, {len(ids)} lang genoeg. Volgers ophalen...", flush=True)

    def followers(pid):
        d = get(f"/playlists/{pid}", {"fields": "id,followers"})
        return pid, ((d or {}).get("followers") or {}).get("total")

    fol = {}
    with ThreadPoolExecutor(4) as ex:
        for pid, n in ex.map(followers, ids):
            fol[pid] = n

    out = []
    for pid in ids:
        n = fol.get(pid)
        if n is None or n < MIN_FOLLOWERS:
            continue
        c = cands[pid]
        it = c["it"]
        name = it.get("name") or ""
        desc = re.sub(r"<[^>]+>", " ", html.unescape(it.get("description") or ""))
        desc = re.sub(r"\s+", " ", desc).strip()
        text = f"{name} {desc}".lower()
        genres, energies = set(c["genres"]), set(c["energies"])
        for label, (_, words) in GENRES.items():
            if any(re.search(rf"\b{re.escape(w)}", text) for w in words):
                genres.add(label)
        for key, (_, _, words) in ENERGIES.items():
            if any(re.search(rf"\b{re.escape(w)}", text) for w in words):
                energies.add(key)
        out.append({
            "id": pid,
            "name": name,
            "desc": desc[:160],
            "img": ((it.get("images") or [{}])[0] or {}).get("url"),
            "followers": n,
            "tracks": (it.get("items") or {}).get("total"),
            "categories": sorted(c["categories"]),
            "genres": sorted(genres),
            "energies": sorted(energies),
            "spotify": False,
        })

    for pid, tags in EXTRA.items():
        meta = oembed(pid)
        if not meta:
            print(f"  waarschuwing: {pid} niet gevonden, overgeslagen")
            continue
        out.append({
            "id": pid, "name": meta.get("title"), "desc": "Playlist van Spotify", "img": meta.get("thumbnail_url"),
            "followers": None, "tracks": None, "spotify": True, **tags,
        })

    out.sort(key=lambda p: -(p["followers"] or 0))
    data = {
        "categories": list(CATEGORIES),
        "genres": list(GENRES),
        "energies": {k: v[0] for k, v in ENERGIES.items()},
        "playlists": out,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"Klaar: {len(out)} playlists in data.json")


if __name__ == "__main__":
    main()
