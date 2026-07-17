# ADR 0002: Three-part game/movie cinema system

## Status

Accepted

## Context

The game should be playable three ways: pure gameplay (unchanged), a guided
"game/movie" hybrid where the crew narrates the player through real objectives,
and a pure movie that generates itself forever — dialogue, space battles,
planet landings, character drama — with no gameplay.

## Decision

- New `src/cinema/` package layered over the game with four minimal hooks
  (`externalController`, `cameraLocked`, `inputLocked`, `onGameEvent`) rather
  than forking the game loop. Part I stays byte-identical in behavior.
- Dialogue is generated live by an LLM via **OpenRouter** (user-supplied key,
  browser-side), seeded from a required user "premise" form plus canon.
  A template-based fallback generator keeps every mode functional offline.
- **Three authored canon episodes** open every film: world backstory and the
  game's mechanics taught diegetically. They are written in the same beat
  format the LLM must produce and double as its reference examples.
- Voices via **Edge TTS** neural websocket (per-character voices), falling
  back to browser `speechSynthesis`, then subtitles-only.
- The movie's "AI pilot" drives the real `Ship` physics and the real
  `CombatManager` — the film is the game playing itself, not a video.

## Consequences

- The LLM writes screenplays as validated JSON beats (`shot`, `line`,
  `travel`, `battle`, `land`, `kill`, `introduce`, …); malformed output is
  sanitized or replaced by the fallback, so the picture never halts.
- Planet landings use disposable "soundstage" sets far below the ecliptic.
- `three` is now an npm dependency (Vite resolves it); the CDN import map
  remains in `index.html` for the legacy no-bundler path.
- Playwright config honors `CHROMIUM_PATH` for sandboxed/CI runs.
