# Event Playlist Finder

Site openen, categorie(ën) kiezen (of zelf een thema typen), en een lijst krijgen
van bestaande Spotify-playlists die je kan gebruiken als achtergrondmuziek bij een
evenement — van chic diner tot bruiloftsfeest tot achtergrond bij een concert.

**Geen Spotify-login nodig.** De site praat via een kleine, gratis achtergrond-proxy
(Cloudflare Worker) met Spotify, dus jij (en iedereen die de link gebruikt) hoeft
nergens in te loggen.

**👉 https://breugelmansd.github.io/spotify-event-playlists/**

## Eenmalige setup (~10 minuten)

Dit moet je één keer doen. Daarna werkt de link hierboven voor altijd, voor
iedereen, zonder inloggen.

### 1. Spotify-app aanmaken (geeft je een Client ID + Secret)

1. Ga naar https://developer.spotify.com/dashboard en log in.
2. Klik **Create app**.
   - App name: bv. `Event Playlist Finder`
   - App description: bv. `Persoonlijke tool voor playlists bij events`
   - Redirect URI: mag je leeg laten of iets invullen zoals `https://example.com`
     — wordt niet gebruikt, want er is geen login.
   - Vink **Web API** aan.
   - Akkoord en **Save**.
3. Open de app, ga naar **Settings** en noteer de **Client ID** en **Client Secret**
   (klik "View client secret").

### 2. Cloudflare Worker aanmaken (verbergt je Client Secret)

1. Ga naar https://dash.cloudflare.com en maak een gratis account (of log in).
2. **Workers & Pages** > **Create** > **Create Worker**. Geef een naam, bv.
   `spotify-event-proxy`, en klik **Deploy** (de standaard "Hello World" code).
3. Klik **Edit code**. Verwijder alle code en plak de inhoud van
   [`cloudflare-worker.js`](cloudflare-worker.js) uit deze repo. Klik **Deploy**.
4. Ga naar de Worker se **Settings** > **Variables and Secrets**. Voeg twee
   secrets toe:
   - `SPOTIFY_CLIENT_ID` = je Client ID van stap 1
   - `SPOTIFY_CLIENT_SECRET` = je Client Secret van stap 1
5. Kopieer de URL van je Worker bovenaan de pagina, bv.
   `https://spotify-event-proxy.jouwnaam.workers.dev`.

### 3. Worker-URL koppelen aan de site

1. Open https://breugelmansd.github.io/spotify-event-playlists/
2. Klik **Instellingen** rechtsboven.
3. Plak de Worker-URL uit stap 2 en klik **Opslaan**.

Klaar — de site werkt nu, voor jou en voor iedereen die de link opent, zonder
dat iemand ooit hoeft in te loggen.

## Gebruik

1. Kies één of meerdere categorieën, en/of typ je eigen thema (bv. "jaren 20 gala",
   "beachclub ibiza", "kerstdiner").
2. Kies eventueel een energieniveau (rustig achtergrond / gezellig / dansbaar).
3. Klik **Zoek playlists**. Je krijgt de beste 12 playlists te zien, gesorteerd op
   relevantie en aantal volgers, elk met een mini-player en een link om direct in
   Spotify te openen.

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
