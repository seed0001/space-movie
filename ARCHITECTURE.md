# Solar System Trader — Architecture (full scope)

3D open-space trading sim — Elite-inspired, solar-system bound. **v0.9.6.0**.
Playable three ways from the mode-select screen: **I. The Game** (pure gameplay),
**II. The Story** (narrated, guided playthrough), **III. The Movie** (endless
procedurally generated film — no gameplay).

## Stack

Three.js 0.160 (npm dep, resolved by Vite; legacy jsDelivr import map remains in
index.html), ES modules. Dev: `npm run dev` → Vite `:5173`. Bloom + ACES filmic
tone mapping via EffectComposer.

## Entry split

| File | Role |
|------|------|
| `src/main.js` | WebGL renderer, `EffectComposer`, starfield, outer `animate()` |
| `src/Game.js` | Simulation orchestrator |

## Runtime (`Game.js`)

```
Game
 ├── Ship.js              (flight, fuel, hull, weapons)
 ├── Station.js           (docking, market UI)
 ├── TradeManager.js      (commodity prices, ticks, events)
 ├── QuestManager.js      (delivery missions)
 ├── MiningManager.js     (laser, heat/overheat)
 ├── CombatManager.js     (pirates)
 ├── FleetManager.js      (escorts / automation)
 ├── ShipyardPreview.js   (3D ship preview)
 ├── AudioManager.js
 └── EnemyShip.js, AsteroidField.js
```

## Game loop

`Main.animate()` → `game.update(delta)` → composer render → optional `game.postRender()`. Pointer lock flight (OrbitControls disabled). Large world scale (camera far 500k).

## Data (`data/`)

| JSON | Content |
|------|---------|
| `locations.json` | Station positions in solar system |
| `commodities.json` | Trade goods |
| `ships.json` | Hull definitions |
| `upgrades.json` | Ship upgrades |

Fetched at init; `TradeManager` simulates per-location prices with periodic ticks.

## Persistence

`localStorage` key `sst_save` — credits, cargo, ship, location, hull/shield/fuel, upgrades. Auto-save on dock and key actions.

## UI

Heavy HTML/CSS in `index.html`: docking, trade tables, shipyard, mining HUD, quest list. DOM updated from `Game.js`.

## Cinema system (`src/cinema/`)

The three-part game/movie experience. `CinemaManager` owns the mode-select
screen, the movie seed form, and AI/voice settings.

| Module | Role |
|--------|------|
| `CinemaManager.js` | Mode select, seed form (premise/title/genre/conflict/…), settings, orchestration |
| `episodes.js` | Three authored canon episodes (world backstory + mechanics taught diegetically) + canon crew |
| `Screenwriter.js` | Scene/chapter generation: OpenRouter LLM from user seed + canon + running summaries; template fallback offline |
| `OpenRouterClient.js` | Browser client for OpenRouter chat completions (key/model in localStorage) |
| `Cast.js` | Procedural ensemble: names, roles, traits, secrets, relationships, per-character TTS voice |
| `VoiceEngine.js` | Edge TTS neural voices over websocket → browser speechSynthesis → silence |
| `CameraDirector.js` | Cinematic shots (wide/orbit/flyby/chase/closeup/twoshot/pov/planet) + shake; overrides game camera |
| `MovieDirector.js` | Part III: beat executor (lines, travel cuts, battles, planet landing sets, kills), AI pilot flying the player ship |
| `StoryDirector.js` | Part II: chapters of real objectives (travel/dock/buy/sell/kill/earn), reactive narration, cinematic cutaways |
| `CinemaUI.js` | Letterbox, typewriter subtitles, title cards, lower-thirds, fades, objective banner, credits |

Game hooks (kept minimal): `Game.externalController` (cinema pilot),
`Game.cameraLocked`, `Game.inputLocked`, `Game.onGameEvent`
(dock/undock/enemyKilled/playerHit), `CombatManager.suppressSpawns`.

## Docs

`itch_io_metadata.md`, `docs/adr/`.
