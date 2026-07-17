# Deploying to Railway

The repo ships a production server (`server.mjs`) that serves the built game
and adds three services: the Edge TTS websocket proxy (real neural voices in
production), an OpenRouter proxy with a shared server-side key, and a tiny
cloud-save API backed by a volume.

## One-time setup

1. **Point the service at the right branch.** Railway deploys the repo's
   default branch out of the box. Either merge to `main`, or in
   *Service → Settings → Source* set the branch to the one carrying the
   cinema system. (`railway.json` in the repo handles build & start commands
   automatically: build `BASE_PATH=/ npm run build` — Nixpacks runs `npm ci`
   in its own install phase — start `node server.mjs`, healthcheck
   `/api/health`.)

2. **Add a volume** for cloud saves: *Service → right-click / Command palette →
   Add volume*, mount path **`/data`**.

3. **Set variables** (*Service → Variables*):

   | Variable | Value | Purpose |
   |----------|-------|---------|
   | `OPENROUTER_API_KEY` | `sk-or-...` | Shared "house key" — players need no key of their own |
   | `OPENROUTER_MODEL` | `anthropic/claude-haiku-4.5` | Default model for the house key (any OpenRouter id) |
   | `DATA_DIR` | `/data` | Save storage → the mounted volume |

   `PORT` is injected by Railway automatically. `BASE_PATH` is already baked
   into the build command.

   Or with the Railway CLI from the project directory:

   ```sh
   railway link                 # pick the project/service once
   railway volume add -m /data
   railway variables --set "OPENROUTER_API_KEY=sk-or-YOUR-KEY" \
                     --set "OPENROUTER_MODEL=anthropic/claude-haiku-4.5" \
                     --set "DATA_DIR=/data"
   railway up                   # or push to the tracked branch
   ```

4. **Generate a domain**: *Service → Settings → Networking → Generate Domain*
   (the screenshot's "Unexposed service" banner means this hasn't been done).

## How the pieces behave in production

- **Voices**: the game tries Edge TTS directly, then falls back to
  `wss://<your-domain>/edge-tts/...` which `server.mjs` proxies with the
  headers the service expects. Players can still pick browser TTS or
  subtitles-only in the Projection Booth.
- **AI**: players with their own OpenRouter key (Projection Booth) call
  OpenRouter directly from the browser; everyone else rides the server's
  house key via `/api/chat`. The model picker covers common models plus a
  custom id field. No key anywhere → built-in offline script generator.
- **Saves**: everything is in each browser's localStorage regardless. If a
  player enters a **callsign** on the title screen, their state also syncs
  to `/api/save/<callsign>` (newer copy wins at boot):
  game save (credits, ship, location, cargo, hull/shield/fuel, upgrades,
  quests, price memory, market state, fleet), movie seed, model choice and
  voice preference. API keys are **never** synced.
- Same callsign on two devices = same pilot. It's honor-system (no auth) —
  fine for a crew of two; add real auth before inviting the internet.

## Local production run

```sh
BASE_PATH=/ npm run build
OPENROUTER_API_KEY=sk-or-... DATA_DIR=./saves node server.mjs
# → http://localhost:3000
```
