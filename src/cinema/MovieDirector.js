import * as THREE from 'three';
import { EnemyShip } from '../EnemyShip.js';
import { EPISODES, CANON_CREW } from './episodes.js';
import { NARRATOR_VOICE } from './Cast.js';

// MovieDirector — Part III. Runs the endless film.
//
// Owns the update loop while mode === 'movie': an AI pilot flies the player
// ship (by driving the same physics the player would), the CameraDirector
// owns the camera, and scenes stream in from the Screenwriter — the three
// canon episodes first, then LLM-generated episodes forever.

const NARRATOR_COLOR = '#d8e2f8';

// Surface palette per station type for landing sets
const SURFACE_COLORS = {
    mining: { ground: 0x8a6a4a, sky: 0x1a0f08, light: 0xffcc99 },
    refinery: { ground: 0xa08858, sky: 0x201408, light: 0xffddaa },
    hub: { ground: 0x4a6a8a, sky: 0x0a1420, light: 0xaaccff },
    industrial: { ground: 0x6a6a72, sky: 0x101018, light: 0xccccdd },
    settlement: { ground: 0xa05838, sky: 0x180a06, light: 0xffbb88 },
    research: { ground: 0x9ab5c5, sky: 0x0a1a24, light: 0xcceeff },
    gas_harvest: { ground: 0xb09060, sky: 0x241a08, light: 0xffddaa },
    smuggler: { ground: 0x40284a, sky: 0x120818, light: 0xcc88ff },
    remote: { ground: 0x788898, sky: 0x0c1218, light: 0xbbddff },
    edge: { ground: 0xcdd8e8, sky: 0x06080e, light: 0xdde8ff },
};

export class MovieDirector {
    constructor(game, ui, cameraDirector, screenwriter, cast, voice) {
        this.game = game;
        this.ui = ui;
        this.cam = cameraDirector;
        this.writer = screenwriter;
        this.cast = cast;
        this.voice = voice;

        this.running = false;
        this.skipScene = false;
        this.pilotMode = 'cruise';      // cruise | dogfight | parked
        this.landedSet = null;
        this.preLandingState = null;
        this.shotClock = 0;
        this.battleActive = false;

        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();

        this.onKey = (e) => {
            if (e.code === 'KeyN' && this.running) this.skipScene = true;
        };
    }

    // ---------------- Lifecycle ----------------

    async start() {
        this.running = true;
        this.skipScene = false;

        const g = this.game;
        g.externalController = (delta) => this.pilot(delta);
        g.suppressPointerLock = true;
        if (g.combatManager) g.combatManager.suppressSpawns = true;
        if (g.autopilotEnabled) g.autopilotEnabled = false;
        window.addEventListener('keyup', this.onKey);

        this.ui.hideGameHud(true);
        this.ui.letterbox(true);
        this.ui.vignetteOn(true);
        this.ui.showHint('[N] NEXT SCENE   [ESC] MENU');

        this.cast.reset();
        for (const c of CANON_CREW) this.cast.addCharacter(c);

        // Opening card: the audience's title if they gave one
        this.ui.setFadeInstant(true);
        await this.ui.wait(400);
        const seedTitle = this.writer.seed?.title;
        await this.ui.titleCard('A PROCEDURALLY GENERATED PICTURE', seedTitle || 'THE LONG ODDS', 'no two screenings alike', 3600);

        let epNum = 1;

        // The three foundational episodes — canon, always first.
        for (const ep of EPISODES) {
            if (!this.running) return;
            this.writer.recordEpisode(ep.summary, ep.next_hook);
            await this.playScene(ep);
            epNum++;
        }

        // The endless picture. Generate ahead while the current scene plays.
        let pending = this.writer.generateScene(epNum);
        while (this.running) {
            const scene = await pending;
            if (!this.running) return;
            this.writer.recordEpisode(scene.summary, scene.next_hook);
            pending = this.writer.generateScene(epNum + 1);
            await this.playScene(scene);
            epNum++;
        }
    }

    stop() {
        this.running = false;
        this.skipScene = true;
        window.removeEventListener('keyup', this.onKey);
        this.voice.stop();
        this.clearEnemies();
        if (this.landedSet) this.teardownLandingSet(false);

        const g = this.game;
        g.externalController = null;
        g.suppressPointerLock = false;
        if (g.combatManager) g.combatManager.suppressSpawns = false;
        this.cam.release();
        this.ui.reset();
    }

    // Per-frame update from the main loop
    update(delta) {
        if (!this.running) return;
        this.cam.update(delta);

        // The film decides who dies — the physics may not kill the leads.
        const ship = this.game.playerShip;
        if (ship) {
            ship.hull = ship.maxHull;
            ship.fuel = ship.maxFuel;
            ship.isDead = false;
        }

        // During battles, keep cutting between action angles
        if (this.battleActive) {
            this.shotClock -= delta;
            if (this.shotClock <= 0) {
                this.shotClock = 3 + Math.random() * 2.5;
                const angles = [
                    { type: 'chase', target: 'player' },
                    { type: 'orbit', target: 'player' },
                    { type: 'closeup', target: 'enemies' },
                    { type: 'flyby', target: 'player' },
                    { type: 'pov', target: 'enemies' },
                ];
                this.setShot(angles[Math.floor(Math.random() * angles.length)]);
                this.cam.addShake(0.4);
            }
        }
    }

    // ---------------- Scene execution ----------------

    async playScene(scene) {
        this.skipScene = false;
        await this.ui.fade(true);
        this.setShot({ type: 'wide', target: 'player', seconds: 8 });
        this.ui.hideSubtitles();

        if (scene.title?.main) {
            this.ui.fade(false);
            await this.ui.titleCard(scene.title.super, scene.title.main, scene.title.sub);
        } else {
            await this.ui.fade(false);
        }

        for (const beat of scene.beats) {
            if (!this.running || this.skipScene) break;
            try {
                await this.execBeat(beat);
            } catch (e) {
                console.warn('Beat failed, continuing film:', beat.op, e);
            }
        }

        // Scene cleanup: no battles or landings leak into the next episode
        this.clearEnemies();
        if (this.landedSet) await this.execTakeoff();
        this.ui.hideSubtitles();
        this.voice.stop();
    }

    async execBeat(beat) {
        switch (beat.op) {
            case 'title':
                return this.ui.titleCard(beat.super || '', beat.main || '', beat.sub || '', beat.hold || 3200);

            case 'lowerthird':
                this.ui.showLowerThird(beat.title, beat.sub);
                return;

            case 'shot':
                this.setShot(beat);
                return this.waitSkippable((beat.seconds || 6) * 1000);

            case 'line':
                return this.execLine(beat);

            case 'travel':
                return this.execTravel(beat.to);

            case 'land':
                return this.execLand(beat.at);

            case 'takeoff':
                return this.execTakeoff();

            case 'battle':
                return this.execBattle(beat);

            case 'kill':
                return this.execKill(beat.character);

            case 'introduce':
                this.cast.addCharacter({
                    name: beat.name, role: beat.role, gender: beat.gender,
                    traits: beat.traits, want: beat.want, secret: beat.secret,
                });
                return;

            case 'fx':
                return this.execFx(beat);

            case 'beat':
                return this.waitSkippable((beat.seconds || 1.5) * 1000);
        }
    }

    async execLine(beat) {
        const isNarrator = beat.speaker === 'NARRATOR';
        const char = isNarrator ? null : this.cast.find(beat.speaker);
        const name = isNarrator ? 'NARRATOR' : (char ? char.name : beat.speaker);
        const color = char ? char.color : NARRATOR_COLOR;
        const voiceName = isNarrator ? NARRATOR_VOICE : (char ? char.voice : NARRATOR_VOICE);

        // Subtitles and TTS run together; the line holds until both finish.
        // With a live voice the subtitle hold shortens (voice sets the pace).
        const spoken = this.voice.speak(beat.text, voiceName);
        const shown = this.ui.say(name, beat.text, color, isNarrator, this.voice.mode === 'off' ? 1.0 : 0.35);
        await Promise.race([
            Promise.all([spoken, shown]),
            this.skipWatcher(),
        ]);
        if (this.skipScene) this.voice.stop();
    }

    async execTravel(locId) {
        const loc = this.game.locationsData.locations.find(l => l.id === locId);
        if (!loc) return;
        await this.ui.fade(true);

        const ship = this.game.playerShip;
        ship.mesh.position.set(loc.position.x + 350, loc.position.y + 60, loc.position.z + 350);
        ship.velocity.set(0, 0, 0);
        // Face the station for composition
        const m = new THREE.Matrix4().lookAt(
            new THREE.Vector3(loc.position.x, loc.position.y, loc.position.z),
            ship.mesh.position, new THREE.Vector3(0, 1, 0));
        ship.targetQuaternion.setFromRotationMatrix(m);
        ship.mesh.quaternion.copy(ship.targetQuaternion);
        this.game.currentLocation = locId;

        this.setShot({ type: 'orbit', target: `station:${locId}`, seconds: 6 });
        await this.ui.fade(false);
    }

    async execLand(locId) {
        const loc = this.game.locationsData.locations.find(l => l.id === locId);
        if (!loc || this.landedSet) return;
        await this.ui.fade(true);

        const ship = this.game.playerShip;
        this.preLandingState = {
            position: ship.mesh.position.clone(),
            quaternion: ship.mesh.quaternion.clone(),
            location: this.game.currentLocation,
        };

        this.landedSet = this.buildLandingSet(loc);
        const pad = this.landedSet.padPosition;
        ship.mesh.position.set(pad.x, pad.y + 10, pad.z);
        ship.velocity.set(0, 0, 0);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        ship.targetQuaternion.copy(q);
        ship.mesh.quaternion.copy(q);
        this.pilotMode = 'parked';

        this.setShot({ type: 'wide', target: 'player', seconds: 8 });
        await this.ui.fade(false);
    }

    async execTakeoff() {
        if (!this.landedSet) return;
        await this.ui.fade(true);
        this.teardownLandingSet(true);
        this.pilotMode = 'cruise';
        this.setShot({ type: 'chase', target: 'player', seconds: 6 });
        await this.ui.fade(false);
    }

    async execBattle(beat) {
        const g = this.game;
        const ship = g.playerShip;
        const count = beat.count || 2;

        for (let i = 0; i < count; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 1200,
                (Math.random() - 0.5) * 300,
                (Math.random() - 0.5) * 1200
            );
            if (offset.length() < 400) offset.setLength(400 + Math.random() * 300);
            const enemy = new EnemyShip(g.scene, ship.mesh.position.clone().add(offset), beat.type || 'Raider');
            g.combatManager.enemies.push(enemy);
        }

        this.battleActive = true;
        this.pilotMode = 'dogfight';
        this.shotClock = 0;
        this.cam.addShake(0.5);

        const seconds = beat.seconds || 20;
        const deadline = performance.now() + seconds * 1000;
        while (this.running && !this.skipScene) {
            if (beat.outcome === 'win' && g.combatManager.enemies.length === 0) break;
            if (performance.now() > deadline) break;
            await this.ui.wait(150);
        }

        if (beat.outcome === 'flee') {
            // Hard burn away from the fight, then lose them in the cut
            this.pilotMode = 'cruise';
            ship.boosting = true;
            this.setShot({ type: 'chase', target: 'player', seconds: 4 });
            await this.waitSkippable(3200);
            ship.boosting = false;
            this.clearEnemies(false);
        } else {
            // Whatever survived the clock dies on screen
            for (const e of [...this.game.combatManager.enemies]) {
                e.takeDamage(99999);
                this.game.audioManager.playExplosion();
                await this.ui.wait(180);
            }
            this.game.combatManager.enemies = this.game.combatManager.enemies.filter(e => !e.isDead);
        }

        this.battleActive = false;
        this.pilotMode = this.landedSet ? 'parked' : 'cruise';
        this.game.keys['Space'] = false;
    }

    async execKill(characterName) {
        const victim = this.cast.kill(characterName);
        this.game.audioManager.playExplosion();
        this.cam.addShake(1.0);
        // White-out flash
        this.ui.setFadeInstant(true);
        await this.ui.wait(120);
        this.ui.setFadeInstant(false);
        if (victim) this.ui.showLowerThird(`${victim.name}`, `${victim.role} — end of the line`, 3500);
        await this.waitSkippable(1500);
    }

    async execFx(beat) {
        const g = this.game;
        const secs = beat.seconds || 2;
        switch (beat.type) {
            case 'klaxon':
                g.audioManager.playError();
                this.cam.addShake(0.3);
                await this.waitSkippable(400);
                g.audioManager.playError();
                return this.waitSkippable(secs * 1000 - 400);
            case 'laser': {
                // A few visible bursts from the ship's guns
                const end = performance.now() + secs * 1000;
                while (performance.now() < end && this.running && !this.skipScene) {
                    g.keys['Space'] = true;
                    await this.ui.wait(120);
                    g.keys['Space'] = false;
                    await this.ui.wait(160);
                }
                g.keys['Space'] = false;
                return;
            }
            case 'explosion':
                g.audioManager.playExplosion();
                this.cam.addShake(0.9);
                return this.waitSkippable(secs * 1000);
            case 'shake':
                this.cam.addShake(0.8);
                return this.waitSkippable(secs * 1000);
        }
    }

    // ---------------- AI pilot ----------------
    // Registered as game.externalController: flies the ship through the
    // same physics interface the player uses.

    pilot(delta) {
        const g = this.game;
        const ship = g.playerShip;
        if (!ship) return;

        if (this.pilotMode === 'parked') {
            ship.velocity.multiplyScalar(Math.pow(0.05, delta));
            g.audioManager.updateEngine(0);
            return;
        }

        if (this.pilotMode === 'dogfight') {
            const enemies = g.combatManager.enemies;
            if (enemies.length) {
                const target = enemies[0];
                const toTarget = this._v1.copy(target.mesh.position).sub(ship.mesh.position);
                const dist = toTarget.length();
                toTarget.normalize();

                // Turn toward the target
                const m = new THREE.Matrix4().lookAt(target.mesh.position, ship.mesh.position, this._v2.set(0, 1, 0));
                const desired = new THREE.Quaternion().setFromRotationMatrix(m);
                ship.targetQuaternion.slerp(desired, Math.min(1, 2.5 * delta));

                // Manage range: close if far, jink if close
                const fwd = this._v2.set(0, 0, 1).applyQuaternion(ship.mesh.quaternion);
                const aligned = fwd.dot(toTarget);
                if (dist > 500) ship.thrust(1, delta);
                else if (dist < 180) ship.thrust(-0.4, delta);
                else ship.thrust(0.3, delta);
                if (Math.random() < 0.02) ship.strafe(Math.random() < 0.5 ? 1 : -1, delta * 8);

                // Guns when on target
                g.keys['Space'] = aligned > 0.94;
                g.audioManager.updateEngine(0.7);
            } else {
                g.keys['Space'] = false;
                ship.velocity.multiplyScalar(Math.pow(0.4, delta));
                g.audioManager.updateEngine(0.2);
            }
            return;
        }

        // cruise: gentle forward drift so shots always have motion
        ship.thrust(0.12, delta);
        g.audioManager.updateEngine(0.15);
    }

    // ---------------- Landing sets ----------------

    buildLandingSet(loc) {
        const palette = SURFACE_COLORS[loc.type] || SURFACE_COLORS.remote;
        const group = new THREE.Group();
        // A soundstage far below the ecliptic so nothing else is in frame
        const base = new THREE.Vector3(loc.position.x, -2000000, loc.position.z);
        group.position.copy(base);

        // Ground
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(6000, 48),
            new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 1.0, metalness: 0.0, flatShading: true })
        );
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // Terrain rubble
        for (let i = 0; i < 60; i++) {
            const r = 15 + Math.random() * 120;
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(r, 0),
                new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 1.0, flatShading: true })
            );
            const ang = Math.random() * Math.PI * 2;
            const d = 300 + Math.random() * 5000;
            rock.position.set(Math.cos(ang) * d, r * 0.3, Math.sin(ang) * d);
            rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            group.add(rock);
        }

        // Landing pad
        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(60, 66, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.6, metalness: 0.4 })
        );
        pad.position.set(0, 2, 0);
        group.add(pad);
        for (let i = 0; i < 6; i++) {
            const beacon = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0xff8800 })
            );
            const a = (i / 6) * Math.PI * 2;
            beacon.position.set(Math.cos(a) * 58, 5, Math.sin(a) * 58);
            group.add(beacon);
        }

        // Sky dome — hides the starfield, tints the world
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(9000, 24, 16),
            new THREE.MeshBasicMaterial({ color: palette.sky, side: THREE.BackSide, fog: false })
        );
        group.add(sky);

        // Local light rig
        const sun = new THREE.DirectionalLight(palette.light, 2.2);
        sun.position.set(3000, 4000, 1500);
        group.add(sun);
        const fill = new THREE.HemisphereLight(palette.light, palette.ground, 0.5);
        group.add(fill);

        this.game.scene.add(group);
        return { group, padPosition: base.clone().add(new THREE.Vector3(0, 4, 0)) };
    }

    teardownLandingSet(restoreShip) {
        if (!this.landedSet) return;
        this.game.scene.remove(this.landedSet.group);
        this.landedSet.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) o.material.dispose?.();
        });
        this.landedSet = null;

        if (restoreShip && this.preLandingState) {
            const ship = this.game.playerShip;
            ship.mesh.position.copy(this.preLandingState.position);
            ship.mesh.quaternion.copy(this.preLandingState.quaternion);
            ship.targetQuaternion.copy(this.preLandingState.quaternion);
            ship.velocity.set(0, 0, 0);
            this.game.currentLocation = this.preLandingState.location;
        }
        this.preLandingState = null;
    }

    // ---------------- Camera target resolution ----------------

    setShot(spec) {
        this.cam.setShot(spec, (target) => this.resolveTarget(target));
    }

    resolveTarget(target) {
        const g = this.game;
        const [kind, id] = String(target).split(':');

        if (kind === 'sun' && !this.landedSet) {
            return { getPosition: v => v.set(0, 0, 0), size: 4500 };
        }
        if (kind === 'enemies') {
            const e = g.combatManager.enemies[0];
            if (e) return {
                getPosition: v => v.copy(e.mesh.position),
                getQuaternion: () => e.mesh.quaternion,
                size: 30,
            };
        }
        if ((kind === 'station' || kind === 'planet') && id && !this.landedSet) {
            const station = g.stations.get(id);
            if (station) {
                if (kind === 'planet') {
                    // The big landmark sphere is a child of the station group
                    let planet = null;
                    station.mesh.traverse(o => {
                        if (!planet && o.geometry?.type === 'SphereGeometry' &&
                            o.geometry.parameters.radius > 500) planet = o;
                    });
                    if (planet) {
                        const radius = planet.geometry.parameters.radius;
                        return {
                            getPosition: v => planet.getWorldPosition(v),
                            size: radius,
                        };
                    }
                }
                return {
                    getPosition: v => v.copy(station.mesh.position),
                    size: 150,
                };
            }
        }

        // Default: the ship (also covers targets that vanished mid-scene)
        const ship = g.playerShip;
        return {
            getPosition: v => v.copy(ship.mesh.position),
            getQuaternion: () => ship.mesh.quaternion,
            size: 45,
        };
    }

    // ---------------- Helpers ----------------

    clearEnemies(explode = true) {
        const cm = this.game.combatManager;
        for (const e of cm.enemies) {
            this.game.scene.remove(e.mesh);
            e.isDead = true;
        }
        cm.enemies.length = 0;
        for (let i = cm.projectiles.length - 1; i >= 0; i--) cm.removeProjectile(i);
        this.game.keys['Space'] = false;
        this.battleActive = false;
    }

    waitSkippable(ms) {
        return new Promise(res => {
            const start = performance.now();
            const tick = () => {
                if (!this.running || this.skipScene || performance.now() - start >= ms) return res();
                setTimeout(tick, 100);
            };
            tick();
        });
    }

    skipWatcher() {
        return new Promise(res => {
            const tick = () => {
                if (!this.running || this.skipScene) return res();
                setTimeout(tick, 120);
            };
            tick();
        });
    }
}
