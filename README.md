# Event Playlist Finder

Site openen, categorie(ën) kiezen (of zelf een thema typen), en een lijst krijgen
van bestaande Spotify-playlists die je kan gebruiken als achtergrondmuziek bij een
evenement — van chic diner tot bruiloftsfeest tot achtergrond bij een concert.

**Geen Spotify-login en geen API nodig.** De site toont een vooraf samengestelde lijst
playlists, dus niemand hoeft ergens in te loggen of iets in te stellen.

**👉 https://breugelmansd.github.io/spotify-event-playlists/**

## Delen met collega's

Stuur gewoon de link: **https://breugelmansd.github.io/spotify-event-playlists/**

Collega's hoeven niets in te stellen of aan te maken en loggen nergens in. De site
gebruikt **geen Spotify-API en geen sleutels**: ze leest enkel een lijst met
vooraf gekozen playlists (`data.json`). Om te luisteren hebben ze de Spotify-app
(of de webspeler) nodig.

## De lijst bijwerken (enkel voor de beheerder)

`data.json` wordt gemaakt door `tools/maak-lijst.py`. Dat script zoekt playlists per
categorie, genre en energieniveau, houdt enkel populaire en lange lijsten over
(minstens 10.000 volgers, 20 nummers) en voegt de playlists van Spotify zelf toe
die bovenaan het script in `EXTRA` staan.

Verversen (dit gebruikt jouw eigen Spotify-sleutels, enkel op jouw Mac):

```bash
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... python3 tools/maak-lijst.py
```

Daarna `data.json` committen en pushen. Een playlist weghalen kan ook rechtstreeks in
`data.json`; een Spotify-playlist toevoegen doe je in `EXTRA` in het script.

## Gebruik

1. Kies een of meer categorieën, en/of typ een thema (bv. "gala", "piano", "kerst").
2. Kies eventueel een genre, een energieniveau en een minimale lengte.
3. Klik **Zoek playlists**. Je krijgt playlists met afbeelding en titel, de best passende
   eerst. Met "Toon meer" zie je er meer, met het sterretje bewaar je ze in je shortlist,
   en met "Open in Spotify-app" luister je.

## Technische achtergrond

- Statische site op GitHub Pages: `index.html`, `app.js`, `style.css` en `data.json`.
- Geen backend, geen API-sleutels, geen login. Het zoeken gebeurt in de browser,
  in de lijst uit `data.json`.
- Spotify beperkt sinds 2026 zijn API (geen eigen playlists meer in zoekresultaten voor
  nieuwe apps). Daarom worden de playlists van Spotify zelf met de hand toegevoegd:
  een playlist openen via zijn link heeft geen API nodig.
