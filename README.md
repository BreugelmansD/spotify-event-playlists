# Event Playlist Finder

Kleine web-app die je Spotify-account linkt en op basis van een evenement-thema of
categorie (chic diner, cocktailparty, bruiloft, achtergrond concert, ...) automatisch
relevante bestaande Spotify-playlists opzoekt en rangschikt op populariteit.

Puur HTML/JS, geen installaties nodig (geen Node/npm) — draait via de ingebouwde
Python webserver van macOS.

## Eenmalige setup (5 minuten)

1. Ga naar https://developer.spotify.com/dashboard en log in met je Spotify-account.
2. Klik **Create app**.
   - App name: bv. `Event Playlist Finder`
   - App description: bv. `Persoonlijke tool voor playlists bij events`
   - Redirect URI: `http://127.0.0.1:8888/`
   - Vink **Web API** aan als API die je gebruikt.
   - Ga akkoord met de voorwaarden en klik **Save**.
3. Open je nieuwe app in het dashboard en klik **Settings**. Kopieer de **Client ID**.
4. Start de lokale server (zie hieronder) en open de app in je browser. Plak de
   Client ID in het invulveld boven aan de pagina en klik **Opslaan**.
5. Klik **Login met Spotify** en log in — je bent klaar.

Je Spotify-app staat standaard in *Development Mode*: enkel accounts die je zelf
toevoegt via **Settings > User Management** kunnen inloggen (max. 25). Voor eigen
gebruik hoef je hier niets voor te doen — je eigen account (de eigenaar van de app)
werkt automatisch.

## De app draaien

Open een terminal in deze map en start:

```bash
python3 -m http.server 8888
```

Open dan in je browser: http://127.0.0.1:8888/

Belangrijk: de poort (`8888`) moet exact overeenkomen met de Redirect URI die je
in het Spotify dashboard hebt ingesteld.

## Gebruik

1. Kies één of meerdere categorieën, en/of typ je eigen thema (bv. "jaren 20 gala",
   "beachclub ibiza", "kerstdiner").
2. Kies eventueel een energieniveau (rustig achtergrond / gezellig / dansbaar).
3. Klik **Zoek playlists**. De app doet meerdere zoekopdrachten op Spotify, combineert
   de resultaten en sorteert op relevantie + aantal volgers, en toont de beste 12
   playlists met een mini-player en een link om ze direct in Spotify te openen.

## Technische achtergrond

Spotify heeft begin 2026 hun API sterk beperkt: "Featured Playlists" en "Category's
Playlists" (de officiële curatie-endpoints) zijn niet meer beschikbaar voor nieuwe
apps. Deze app gebruikt daarom de gewone Search API met een set slim samengestelde
zoektermen per categorie, en compenseert de lagere limiet per zoekopdracht (max. 10
resultaten) door meerdere varianten te combineren en te herrangschikken op basis van
hoe vaak een playlist terugkomt en het aantal volgers.

Inloggen gebeurt via OAuth Authorization Code + PKCE — er is geen client secret
nodig, alles gebeurt in de browser. Tokens worden lokaal in `localStorage` bewaard.
