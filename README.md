# Event Playlist Finder

Site openen, categorie(ën) kiezen (of zelf een thema typen), en een lijst krijgen
van bestaande Spotify-playlists die je kan gebruiken als achtergrondmuziek bij een
evenement — van chic diner tot bruiloftsfeest tot achtergrond bij een concert.

**Geen Spotify-login nodig.** De site praat via een kleine, gratis achtergrond-proxy
(Cloudflare Worker) met Spotify, dus jij (en iedereen die de link gebruikt) hoeft
nergens in te loggen.

**👉 https://breugelmansd.github.io/spotify-event-playlists/**

## Delen met collega's

Stuur gewoon de link: **https://breugelmansd.github.io/spotify-event-playlists/**

Collega's hoeven niets in te stellen, geen account aan te maken en niet in te loggen
op Spotify. Ze openen de link, kiezen een categorie en krijgen playlists. Om een
playlist te beluisteren hebben ze de Spotify-app (of de webspeler) nodig.

## Eenmalige setup (enkel voor de beheerder)

Dit is al gedaan. Het staat hier voor als je het ooit opnieuw moet opzetten.
De site praat via een Cloudflare Worker met Spotify. Die Worker bewaart de Spotify
Client ID en Secret als secrets. Het adres van de Worker staat in `app.js`
(`DEFAULT_API_BASE`).

1. Maak een app op https://developer.spotify.com/dashboard (Web API; de Redirect URI
   wordt niet gebruikt) en noteer Client ID en Client Secret.
2. Maak een Worker op https://dash.cloudflare.com, plak de code uit
   [`cloudflare-worker.js`](cloudflare-worker.js) en zet `SPOTIFY_CLIENT_ID` en
   `SPOTIFY_CLIENT_SECRET` als secrets.
3. Zet het Worker-adres in `DEFAULT_API_BASE` in `app.js`.

## Gebruik

1. Kies één of meerdere categorieën, en/of typ je eigen thema (bv. "jaren 20 gala",
   "beachclub ibiza", "kerstdiner").
2. Kies eventueel een genre, een energieniveau en een minimale lengte.
3. Klik **Zoek playlists**. Je krijgt de beste playlists te zien met afbeelding en titel,
   gesorteerd op relevantie en aantal volgers. Met "Toon meer" zie je er meer, met het
   sterretje bewaar je ze in je shortlist, en met "Open in Spotify-app" luister je.

## Technische achtergrond

- **Geen login**: de app gebruikt Spotify's "Client Credentials"-methode
  (app-niveau toegang tot publieke catalogusdata), niet een persoonlijke login.
  Dat betekent ook dat er geen toegang is tot iemands account of persoonlijke
  playlists — enkel zoeken in Spotify's publieke catalogus.
- **Waarom een Worker nodig is**: Client Credentials vereist een Client Secret.
  Die mag nooit in publieke website-code staan (iedereen zou hem kunnen
  overnemen), dus houdt de Worker dat geheim veilig op de server en geeft enkel
  zoekresultaten door.
- Spotify heeft begin 2026 hun API beperkt: "Featured Playlists" en "Category's
  Playlists" (de officiële curatie-endpoints) bestaan niet meer voor nieuwe apps.
  Deze app compenseert door meerdere slim samengestelde zoekopdrachten per
  categorie te combineren en te herrangschikken op relevantie + populariteit.
- **Bekende beperking**: de Worker-URL staat (indirect) in de broncode van deze
  publieke repo. Iemand die de URL kent, kan er in theorie los van de website
  gebruik van maken en zo jouw Spotify-API-quota verbruiken. Voor persoonlijk/
  informeel gebruik is dat risico verwaarloosbaar (Cloudflare's gratis laag
  staat 100.000 requests/dag toe, en je kan de Client Secret altijd vernieuwen
  in het Spotify dashboard als dat ooit nodig zou zijn).
