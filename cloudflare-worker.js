// Plak deze code in je Cloudflare Worker (dash.cloudflare.com > Workers & Pages
// > jouw worker > Edit code). Zet SPOTIFY_CLIENT_ID en SPOTIFY_CLIENT_SECRET als
// secret environment variables in de Worker Settings > Variables.
//
// Deze proxy houdt je Spotify Client Secret veilig op de server: de website zelf
// bevat geen geheimen en gebruikers hoeven nooit in te loggen op Spotify.

const ALLOWED_ORIGIN = "https://breugelmansd.github.io";
const ALLOWED_PREFIXES = ["/search", "/playlists/"];

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAppToken(env) {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const creds = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (!ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }

    try {
      const token = await getAppToken(env);
      const spotifyUrl = `https://api.spotify.com/v1${url.pathname}${url.search}`;
      const spotifyRes = await fetch(spotifyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await spotifyRes.text();
      return new Response(body, {
        status: spotifyRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "proxy_error", message: String(err) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
  },
};
