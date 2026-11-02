# Self-hosting LibreWXR for OpenRadar

OpenRadar is a client. It has no backend of its own and works against any
LibreWXR-compatible instance. This guide covers deploying that instance, exposing
it safely, and pointing OpenRadar at it.

For the data contract and licences, see [Data sources](DATA_SOURCES.md). For the
client-side setting, see [Configuration § Data source](CONFIGURATION.md#22-data-source).

> LibreWXR is a separate project under **AGPL-3.0-or-later**. This guide is
> operational guidance, not a copy of its documentation. Always check the
> upstream README and `docs/configuration-reference.md` for the current variable
> list before deploying a new version.

---

## 1. What OpenRadar expects

A compatible server must expose:

| Endpoint | Required | Used for |
| --- | --- | --- |
| `GET /public/weather-maps.json` | Yes | Catalog: frame times, tile `host`, palettes, satellite list |
| `GET /v2/radar/...` | Yes | Radar and nowcast tiles |
| `GET /v2/satellite/...` | No | Satellite overlay |
| `GET /v2/alerts` | No | WMO CAP alert overlay |
| `GET /v2/ws` | No | Future live-update transport; not used by v0.1.0 |

The catalog's `host` field is authoritative for tiles and may differ from the
URL you enter in OpenRadar. If you put the API behind a proxy but leave `host`
pointing at `http://localhost:8080`, desktop clients will fail to load tiles.

Minimum catalog shape:

```jsonc
{
  "version": "2.0",
  "generated": 1767225600,
  "host": "https://radar.example.com",
  "radar": {
    "past":    [{ "time": 1767222000, "path": "/v2/radar/1767222000" }],
    "nowcast": [{ "time": 1767225600, "path": "/v2/radar/1767225600" }],
    "colorSchemes": [{ "id": 2, "name": "Universal Blue" }]
  },
  "satellite": {
    "infrared": [{ "time": 1767222000, "path": "/v2/satellite/1767222000" }]
  }
}
```

OpenRadar rejects an empty `radar.past` + `radar.nowcast` catalog rather than
showing an empty map. `satellite.infrared` may be empty or absent. Palettes may
be absent, in which case the client uses its built-in list.

---

## 2. Deploy with Docker (recommended)

LibreWXR ships a Docker Compose deployment with two roles:

- **pipeline** — fetches radar, NWP, satellite, alerts, and lightning data.
- **renderer** — serves the API and tile endpoints from a shared cache volume.

### 2.1 Host requirements

| Resource | Minimum | Comfortable |
| --- | --- | --- |
| CPU | 2 cores | 4–8 cores |
| RAM | 2 GB | 8–16 GB for full coverage |
| Disk | 10 GB | 40 GB+ for cache and logs |
| Network | Outbound HTTPS to upstream providers | Same, with monitoring |

Full global coverage with the complete NWP chain is memory-hungry. A
CONUS-only, radar-only deployment is dramatically smaller. See
[§7 Capacity](#7-capacity-and-tuning).

### 2.2 Install

```bash
git clone https://github.com/JoshuaKimsey/LibreWXR.git
cd LibreWXR
cp .env.example .env
```

Edit `.env`. A conservative starting point for a small VPS:

```bash
COMPOSE_PROFILES=multi
LIBREWXR_WORKERS=2
LIBREWXR_PUBLIC_URL=https://radar.example.com
LIBREWXR_ENABLED_REGIONS=CONUS
LIBREWXR_CACHE_DIR=/data/cache
```

Then:

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f pipeline
```

The first start downloads several hundred MB of data and may take minutes before
the catalog is populated. Tiles may be empty during the initial ingest.

### 2.3 Bare metal

LibreWXR requires Python 3.11+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install .
cp .env.example .env
python -m librewxr.main
```

For multi-process operation, run the pipeline separately from render workers and
give both the same `LIBREWXR_CACHE_DIR`:

```bash
export LIBREWXR_CACHE_DIR=/var/lib/librewxr

# Terminal 1
python -m librewxr.data_pipeline

# Terminal 2
LIBREWXR_RENDER_ONLY=1 python -m librewxr.main
```

A systemd unit should run both under a dedicated user with a writable cache
directory. Restart the pipeline and renderer together after upgrades.

---

## 3. Essential configuration

These variables matter most for an OpenRadar deployment. The upstream reference
is authoritative for the full list.

| Variable | Default | Why it matters |
| --- | --- | --- |
| `LIBREWXR_PUBLIC_URL` | `http://localhost:8080` | **Must** be the externally reachable URL. It is echoed as `host` in the catalog and used for tile URLs. |
| `LIBREWXR_PORT` | `8080` | Bind port on bare metal; host-side port in the stock Compose file. |
| `LIBREWXR_CACHE_DIR` | per-host temp dir | Persistent cache shared by pipeline and renderers. Set it explicitly in production. |
| `LIBREWXR_CORS_ORIGINS` | `["*"]` | Restrict to your app origins if the instance is public. |
| `LIBREWXR_WORKERS` | profile-dependent | Render worker count; roughly one per physical core for busy instances. |
| `LIBREWXR_ENABLED_REGIONS` | `ALL` | Limit radar regions to reduce RAM and bandwidth. |
| `LIBREWXR_MAX_FRAMES` | `12` | Radar history length. More frames = more memory. |
| `LIBREWXR_RADAR_ENABLED` | `true` | Master radar switch. |
| `LIBREWXR_SATELLITE_ENABLED` | `true` | Serve `/v2/satellite`; disable to save ~360 MB. |
| `LIBREWXR_ALERTS_ENABLED` | `true` | Serve `/v2/alerts`; disable if you do not need alerts. |
| `LIBREWXR_WEBSOCKET_ENABLED` | `true` | Push channel for future clients; not needed by v0.1.0. |

### 3.1 Region selection

`LIBREWXR_ENABLED_REGIONS` accepts individual region codes and group names such
as `CONUS`, `US`, `CANADA`, `CENTRAL_AMERICA`, `EUROPE`, `SOUTHEAST_ASIA`,
`TAIWAN`, `JAPAN`, and `ALL`. Mix freely:

```bash
LIBREWXR_ENABLED_REGIONS=CONUS,EUROPE
```

Outside the enabled radar domains, LibreWXR may still fill frames from global
satellite-derived precipitation or NWP; that data is modelled or IR-derived,
not radar-grade. Do not describe it as radar observation.

### 3.2 A radar-only instance

```bash
LIBREWXR_SATELLITE_ENABLED=false
LIBREWXR_ALERTS_ENABLED=false
LIBREWXR_WEBSOCKET_ENABLED=false
LIBREWXR_ENABLED_REGIONS=CONUS
LIBREWXR_MAX_FRAMES=6
```

OpenRadar detects the missing capabilities from the catalog and disables the
corresponding controls. No client change is needed.

### 3.3 A satellite/alerts instance

If you disable radar entirely, the catalog has no radar frames, and OpenRadar
will show its “no radar frames” error. Keep at least one radar region enabled for
a usable OpenRadar instance.

---

## 4. Reverse proxy and TLS

The desktop webview rejects self-signed certificates. Use a certificate from a
publicly trusted CA, or a locally trusted CA installed in the OS trust store for
private deployments.

### 4.1 Caddy

Caddy obtains and renews certificates automatically:

```caddyfile
radar.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
```

WebSocket upgrades work without extra configuration. If you use a custom
`LIBREWXR_WEBSOCKET_PATH`, add a matching route.

### 4.2 nginx

```nginx
server {
    listen 443 ssl http2;
    server_name radar.example.com;

    ssl_certificate     /etc/letsencrypt/live/radar.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/radar.example.com/privkey.pem;

    client_max_body_size 8m;
    proxy_read_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /v2/ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Tune `proxy_read_timeout` upward if you enable long-lived WebSocket clients.
Cache tile responses at the proxy if you expect many users; LibreWXR already
serves tiles with a short `Cache-Control` lifetime.

### 4.3 Direct TLS

For a small deployment without a proxy, set both:

```bash
LIBREWXR_SSL_CERTFILE=/etc/letsencrypt/live/radar.example.com/fullchain.pem
LIBREWXR_SSL_KEYFILE=/etc/letsencrypt/live/radar.example.com/privkey.pem
```

Setting only one has no effect. Most deployments should terminate TLS at the
proxy instead.

---

## 5. CORS origins

Browsers and webviews enforce CORS on the catalog and tile requests. LibreWXR
allows all origins by default. If you restrict it, include every origin that
will load the app:

| Client | Origin |
| --- | --- |
| Tauri on Linux/macOS | `tauri://localhost` |
| Tauri on Windows | `http://tauri.localhost` |
| Browser dev server | `http://localhost:1420` |
| Static web deployment | your exact `https://…` origin |
| Local preview | `http://localhost:4173` (`npm run preview`) |

Using the upstream's JSON-style list syntax:

```bash
LIBREWXR_CORS_ORIGINS=["tauri://localhost","http://tauri.localhost","https://radar.example.com"]
```

Notes:

- Follow the exact list syntax documented by your LibreWXR version; the example
  above matches the current JSON-style default.
- WebSocket handshakes use the same list. Once it is not `*`, a browser
  handshake with an unlisted `Origin` is closed with code `1008`. Non-browser
  clients without an `Origin` header are still allowed.
- `tauri://localhost` and `http://tauri.localhost` look unusual but are the real
  webview origins. Missing them produces “catalog loads, tiles fail” or a CORS
  error in the webview console.

---

## 6. Point OpenRadar at the instance

1. Open **Settings → Data source**.
2. Choose **Self-hosted / custom**.
3. Enter the public URL, for example `https://radar.example.com`.
   Omit the scheme only for loopback/private addresses; public hosts default to
   `https://`.
4. Click **Apply & reconnect**.
5. Confirm:
   - the status pill reaches **Live**;
   - the panel shows the advertised **Effective host**;
   - the **Last catalog** line reports a frame count;
   - the timeline shows frames and playback works.
6. Enable satellite and alerts only if your server provides them.

The effective host in the panel comes from the catalog. It must match the URL
clients can reach. A mismatch is the most common self-hosting bug.

### 6.1 Input rules

- `radar.example.com` → `https://radar.example.com`
- `localhost:8080`, `127.0.0.1:8080`, `10.x`, `192.168.x`, `172.16–31.x` →
  `http://…`
- Query strings, fragments, and trailing slashes are removed.
- Non-HTTP(S) schemes are rejected before any request.
- An empty value is rejected by the setup flow.

---

## 7. Capacity and tuning

Sizing depends on regions, NWP models, satellite frames, and history length.
Upstream publishes detailed tables; the practical rules are:

| Deployment | Rough RAM | Notes |
| --- | --- | --- |
| Radar-only, one region, 6 frames, 1 worker | ~1–2 GB | Good for a small VPS or home server. |
| Full coverage, radar + satellite + alerts, 1–2 workers | ~8–12 GB | Typical personal/small-team instance. |
| Full coverage, full NWP chain, 16+ workers | ~14–18 GB | Busy public instance. |

Levers, in order of impact:

1. `LIBREWXR_ENABLED_REGIONS` — fewer regions means less frame memory.
2. `LIBREWXR_MAX_FRAMES` — shorter history.
3. `LIBREWXR_SATELLITE_ENABLED=false` — removes roughly 360 MB of frames plus
   render buffers.
4. `LIBREWXR_ALERTS_ENABLED=false` — removes CAP ingest and geocode tables.
5. `LIBREWXR_NOWCAST_ENABLED=false` — removes forecast generation.
6. `LIBREWXR_WORKERS` — more workers improve concurrency but each has its own
   interpreter and tile-cache overhead.
7. `LIBREWXR_TILE_CACHE_MB` and `LIBREWXR_COORD_CACHE_SIZE` — per-worker caches.

Bandwidth: tiles dominate. OpenRadar already limits itself to a 3-minute catalog
poll, a 64 MB client cache, at most 32 preloaded tiles per frame, and a maximum
of six concurrent preloads. Many clients behind one NAT still multiply tile
requests; put a caching proxy in front for scale.

---

## 8. Verification

Run these from a machine that resembles your users' network, not only from the
server itself.

```bash
# 1. Catalog is reachable and has frames
curl -fsS https://radar.example.com/public/weather-maps.json \
  | jq '{host, past: (.radar.past|length), nowcast: (.radar.nowcast|length), satellite: (.satellite.infrared|length), schemes: (.radar.colorSchemes|length)}'

# 2. host matches the public URL
curl -fsS https://radar.example.com/public/weather-maps.json | jq -r .host

# 3. A radar tile is a PNG
curl -fsS -o /tmp/tile.png \
  "https://radar.example.com/v2/radar/<timestamp>/256/3/1/2/2/1_0.png"
file /tmp/tile.png          # expect: PNG image data

# 4. Satellite (if enabled)
curl -fsS -o /tmp/sat.png \
  "https://radar.example.com/v2/satellite/<timestamp>/256/2/1/1/0/0_0.png"
file /tmp/sat.png

# 5. Alerts (if enabled; 503 means disabled)
curl -sS -o /tmp/alerts.json -w "%{http_code}\n" \
  "https://radar.example.com/v2/alerts?simplify=1000"
jq '.type, (.features|length)' /tmp/alerts.json

# 6. Health and versions
curl -fsS https://radar.example.com/health | jq .
```

Replace `<timestamp>` with a value from the catalog. A transparent PNG over an
ocean view is normal; an HTML error page is not.

### 8.1 CORS check

From a browser console on the app origin:

```js
await fetch("https://radar.example.com/public/weather-maps.json").then(r => r.status)
```

A CORS failure appears as a blocked request, even if `curl` works. Check the
`Access-Control-Allow-Origin` response header and the `LIBREWXR_CORS_ORIGINS`
value.

### 8.2 Common mismatch symptoms

| Symptom | Likely cause |
| --- | --- |
| Catalog loads, no tiles | `host` points at an unreachable address; CORS blocked; tile path malformed. |
| Works in browser dev, fails in desktop | `tauri://localhost` / `http://tauri.localhost` missing from CORS. |
| Satellite toggle disabled | `satellite.infrared` empty; satellite disabled server-side. |
| Alerts show “disabled on the server” | `/v2/alerts` returned 503; `LIBREWXR_ALERTS_ENABLED=false`. |
| Timeline has no forecast frames | Nowcast disabled or not yet generated. |
| TLS error in desktop only | Self-signed or incomplete certificate chain. |

---

## 9. Operations

### Health and logs

```bash
curl -fsS https://radar.example.com/health | jq
docker compose logs -f --tail=200 pipeline renderer
```

The health payload reports frame counts, cache state, alert/satellite/lightning
status, WebSocket subscribers, and per-component memory. Alert on non-200
health, stalled frame counts, and disk usage.

### Updates

Pin an image tag in `.env` for reproducible deployments:

```bash
LIBREWXR_IMAGE_TAG=latest   # or an exact release tag
```

Then:

```bash
docker compose pull
docker compose up -d
```

The upstream `scripts/update.sh` automates pull + `.env` reconciliation and is a
no-op unless explicitly enabled. Review release notes before upgrading; the
catalog contract is stable, but new features and defaults can change.

### Backups

Back up:

- `.env` (secrets, public URL, region choices);
- any `docker-compose.override.yml`;
- TLS material managed outside the repository.

The cache directory is reproducible and does not need backup, though keeping it
avoids a long re-ingest after a rebuild.

### Cache growth

The cache holds radar/NWP/satellite frames and resolved palettes. Monitor it and
set a disk quota or cleanup policy if the host is small. Deleting the cache while
the service is running can produce transient errors; stop the services first, or
let the upstream tooling manage it.

---

## 10. Public instance etiquette

The public `https://api.librewxr.net` instance is shared, has no SLA, and is
intended for testing and small-scale use. If you operate a public instance:

- publish a status/contact page and an acceptable-use note;
- keep `LIBREWXR_CORS_ORIGINS` broad enough for legitimate clients, or document
  the allowed origins;
- rate-limit at the proxy rather than relying on client goodwill;
- cache tiles at the edge;
- monitor bandwidth and upstream fetch failures;
- pin versions and announce breaking changes;
- do not imply endorsement by NOAA, EUMETNET, WMO, or other data providers;
- keep the attribution guidance in [Data sources](DATA_SOURCES.md).

OpenRadar's built-in behaviour is deliberately conservative, but a fork or a
heavily used deployment can still create load. Self-host if your usage is
sustained.

---

## 11. Security checklist

- [ ] TLS with a trusted certificate for any non-loopback deployment.
- [ ] `LIBREWXR_PUBLIC_URL` uses the public HTTPS URL.
- [ ] `LIBREWXR_CORS_ORIGINS` restricted if the instance is public.
- [ ] Reverse proxy sets `X-Forwarded-Proto` and forwards WebSocket upgrades.
- [ ] Cache and log directories are writable only by the service user.
- [ ] `.env` is not committed and does not contain unrelated secrets.
- [ ] Health and metrics endpoints are monitored but not exposed more widely
      than necessary.
- [ ] Upgrades are pinned and tested against a staging instance.
- [ ] Attribution and the “not for life-safety decisions” warning remain visible
      in any client you distribute.

LibreWXR is AGPL-3.0-or-later. If you modify and network-host it, review the
licence obligations with your legal advisor. OpenRadar itself remains MIT.
