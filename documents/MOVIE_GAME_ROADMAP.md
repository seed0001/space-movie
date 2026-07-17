# Movie-Game Experience — Roadmap

**Project:** Solar System Trader → Interactive Procedural Movie
**Branch:** `interactive-movie`
**Repo:** https://github.com/seed0001/space-movie

## Vision

Convert Solar System Trader into a **procedurally generated movie that plays the real game**. The movie is not a cutscene reel and it does not cheat: the ship actually flies, docks, trades, and fights using the game's own systems. A Director system decides what gameplay happens next, films it with cinematic cameras, and narrates it with characters and story. The viewer interacts at key beats — making choices that steer the playthrough, or taking the stick and flying a sequence themselves.

Every run is a different film, because every run is a different simulation.

## Core principles

1. **Groundwork first, scenery later.** Build the full pipeline — shots, script, characters, narration, choices — against today's simple visuals. When the scenery improves later (textured planets, skyboxes, landings), the movie system films the new world with zero rework.
2. **The movie plays the game for real.** Beats issue genuine gameplay commands (autopilot, enemy spawns, docking). No faked positions, no scripted outcomes — the story reacts to what the simulation actually does.
3. **The player is in the loop.** This walks you through the gameplay in movie style: choices at story beats, and "take the stick" moments where control hands over to the player until an objective is met, then the film resumes.
4. **Procedural everything.** Seeded RNG drives story structure, character names, ship names, dialogue variants, and shot selection — a seed is a movie.

## Architecture (all new code in `src/movie/`)

| Module | Responsibility |
|--------|---------------|
| `MovieDirector.js` | Orchestrator. Runs the beat queue: starts gameplay actions, watches for completion conditions, cuts cameras, triggers narration, handles branching. |
| `CinematicCamera.js` | Shot library: orbit, chase, flyby, push-in, wide establishing, dogfight cam. Smooth transitions. Overrides the gameplay camera while a beat is filming. |
| `ScriptGenerator.js` | Seeded procedural story: acts and beats, recurring characters (captain, rival pirate, station voices), ship names, narration line templates. |
| `Narrator.js` | Delivers lines: subtitle rendering plus browser speech synthesis, distinct voice parameters per character. |
| `MovieUI.js` | Letterbox bars, subtitles, title cards, choice overlay, "take the stick" prompt. HUD hidden during filming, shown during player-control beats. |

### Integration points in the existing game (verified)

- **Autopilot flight:** set `game.selectedTargetId` + `game.autopilotEnabled = true` — flies to a station with a braking curve and auto-docks on arrival (`Game.js updateAutopilot`, `tryDocking`).
- **Combat:** `combatManager.spawnEnemy()` spawns AI pirates (Raider / Marauder / Dreadnought) that genuinely hunt the player; lasers via `spawnProjectile`. Movie combat beats add an "ace pilot" auto-fly/auto-fire so the player ship fights for real when the viewer isn't flying.
- **Docking / undocking:** `tryDocking()` / `undock()` with real station UI state.
- **World:** 13 stations from `data/locations.json` with danger levels 0–5 (earth/luna safe → neptune deadly) — danger level informs where the story stages ambushes.
- **Hook:** `Game.update` delegates to `MovieDirector.update` when movie mode is active; `updateCamera` is skipped while a cinematic shot owns the camera.

## Phases

### Phase 1 — Foundation (movie mode shell)
- [ ] Movie mode toggle (button + `M` key), enter/exit cleanly back to normal play
- [ ] MovieUI: letterbox, subtitle bar, title cards, fade in/out
- [ ] Camera ownership handoff (director ⇄ gameplay camera)
- **Milestone:** entering movie mode letterboxes the screen, shows a title card, and a static cinematic shot frames the player ship.

### Phase 2 — Cinematic camera system
- [ ] Shot library: orbit, chase, flyby, push-in, establishing wide, two-ship framing for combat
- [ ] Shot transitions (cut and smooth blend), per-shot duration
- **Milestone:** a shot reel — camera cycles through all shot types around live gameplay.

### Phase 3 — Director + beat engine (the movie plays the game)
- [ ] Beat model: `{ action, until-condition, timeout, shots, narration, next }`
- [ ] Gameplay actions: fly-to-station (autopilot), spawn ambush, fight (ace-pilot auto-combat), flee, dock, undock
- [ ] Outcome-reactive branching: the story continues differently if the fight goes badly (hull damage, fled vs. won)
- **Milestone:** a hands-free sequence: undock → cruise to Mars → pirate ambush → dogfight → victory → dock, fully filmed.

### Phase 4 — Script generator (procedural story)
- [ ] Seeded RNG (a seed reproduces the same movie)
- [ ] Character roster: protagonist captain, rival pirate lord, station controllers — names, traits, recurrence across acts
- [ ] Act structure: setup → complication → climax → resolution, mapped onto gameplay beats
- [ ] Narration line templates with variable slots (ship names, stations, outcomes)
- **Milestone:** two different seeds produce two visibly different stories in the same session.

### Phase 5 — Narration + voices
- [ ] Subtitles synced to beat timing
- [ ] Speech synthesis with per-character voice (pitch/rate/voice selection)
- [ ] Narrator vs. character dialogue distinction in UI
- **Milestone:** the Phase 3 sequence is fully narrated with at least 3 distinct voices.

### Phase 6 — Interactivity
- [ ] Choice overlays at decision beats ("Warn the freighter / Stay hidden") that change the next gameplay beats
- [ ] "Take the stick" beats: control hands to the player with an on-screen objective; film resumes when met
- [ ] Escape hatch: exit movie back to free play at any time, keeping game state
- **Milestone:** one playthrough with at least 2 choices and 1 player-flown sequence, start to finish.

### Phase 7 — Full episode, start to finish
- [ ] 10–15 minute complete episode: title sequence → 3 acts → epilogue with outcome recap
- [ ] Pacing pass: shot lengths, narration density, quiet moments
- [ ] Replay/new-seed flow at the end
- **Milestone:** "Episode 1" plays end-to-end, every run unique. **This is the v1 target.**

### Phase 8 — Later: the galaxy grows (post-v1, scenery era)
- Textured planets, skyboxes, station detail — the camera work stays, the scenery upgrades
- Planet landings and surface exploration episodes
- Multi-episode arcs with persistent characters and consequences
- Long-term: full-galaxy episode generator — "entire episodes" of landing, exploring, trading, fighting

## Current status

- [x] Graphics groundwork: bloom, ACES tone mapping, antialiasing, lighting rebalance (replaces the pixelation aesthetic)
- [x] Repo migrated to `seed0001/space-movie`, `interactive-movie` branch created
- [x] Gameplay API recon complete (autopilot, combat, docking hooks verified)
- [ ] Phase 1 begins
