import { CANON_CREW } from './episodes.js';
import { NARRATOR_VOICE } from './Cast.js';

// StoryDirector — Part II. The game/movie hybrid.
//
// The PLAYER flies; the crew talks them through chapters of real gameplay
// objectives, movie-style: narrated intros with cinematic cutaways, an
// objective banner, spoken reactions to what actually happens (kills,
// damage, docking), and a cinematic beat when each chapter wraps.

const NARRATOR_COLOR = '#d8e2f8';

export class StoryDirector {
    constructor(game, ui, cameraDirector, screenwriter, cast, voice) {
        this.game = game;
        this.ui = ui;
        this.cam = cameraDirector;
        this.writer = screenwriter;
        this.cast = cast;
        this.voice = voice;

        this.running = false;
        this.chapterNumber = 0;
        this.chapter = null;
        this.stepIndex = -1;
        this.stepBaseline = null;   // state snapshot when the step began
        this.reactionCooldown = 0;
        this.inCutaway = false;
        this.speaking = Promise.resolve();
    }

    // ---------------- Lifecycle ----------------

    async start() {
        this.running = true;

        this.cast.reset();
        for (const c of CANON_CREW) this.cast.addCharacter(c);

        // Wire game events for reactive narration
        this.game.onGameEvent = (type, data) => this.onGameEvent(type, data);

        this.ui.showHint('[ESC] MENU');
        await this.nextChapter();
    }

    stop() {
        this.running = false;
        this.voice.stop();
        this.game.onGameEvent = null;
        this.cam.release();
        this.ui.reset();
    }

    // ---------------- Chapters ----------------

    async nextChapter() {
        if (!this.running) return;
        this.chapterNumber++;

        const ctx = {
            location: this.game.currentLocation,
            credits: Math.floor(this.game.credits),
            cargo: this.game.cargo.length,
        };
        const chapter = await this.writer.generateChapter(this.chapterNumber, ctx);
        if (!this.running) return;
        this.chapter = chapter;
        this.stepIndex = -1;

        // Cinematic chapter opening: letterbox in, orbit the ship, narrate
        await this.cutawayStart();
        await this.ui.titleCard(`CHAPTER ${this.chapterNumber}`, chapter.title, '');
        for (const line of chapter.intro) {
            if (!this.running) return;
            await this.sayLine(line);
        }
        await this.cutawayEnd();

        this.advanceStep();
    }

    advanceStep() {
        if (!this.running || !this.chapter) return;
        this.stepIndex++;

        if (this.stepIndex >= this.chapter.steps.length) {
            this.finishChapter();
            return;
        }

        const step = this.chapter.steps[this.stepIndex];
        this.ui.setObjective(step.objective);
        this.stepBaseline = this.snapshotForStep(step);

        // Step intro lines play over gameplay (no camera takeover)
        (async () => {
            for (const line of step.lines || []) {
                if (!this.running || this.chapter?.steps[this.stepIndex] !== step) break;
                await this.sayLine(line, true);
            }
            this.ui.hideSubtitles();
        })();
    }

    async finishChapter() {
        const chapter = this.chapter;
        this.chapter = null;
        this.ui.setObjective(null);

        this.writer.recordEpisode(`Chapter ${this.chapterNumber} "${chapter.title}" completed by the player.`);

        await this.cutawayStart();
        for (const line of chapter.outro || []) {
            if (!this.running) return;
            await this.sayLine(line);
        }
        await this.cutawayEnd();

        this.nextChapter();
    }

    // ---------------- Step completion checks (polled) ----------------

    snapshotForStep(step) {
        const g = this.game;
        return {
            kills: 0,
            cargoCount: step.item ? g.cargo.filter(c => c === step.item).length : g.cargo.length,
            credits: g.credits,
        };
    }

    countItem(item) {
        return this.game.cargo.filter(c => c === item).length;
    }

    isStepComplete(step) {
        const g = this.game;
        const base = this.stepBaseline;
        switch (step.goal) {
            case 'travel': {
                const loc = g.locationsData.locations.find(l => l.id === step.to);
                if (!loc) return true;
                const d = g.playerShip.mesh.position.distanceTo(
                    { x: loc.position.x, y: loc.position.y, z: loc.position.z });
                return d < 500 || g.currentLocation === step.to;
            }
            case 'dock':
                return g.dockedAt && (!step.at || g.dockedAt.data.id === step.at);
            case 'undock':
                return !g.dockedAt;
            case 'buy':
                return this.countItem(step.item) >= base.cargoCount + (step.count || 1);
            case 'sell':
                return this.countItem(step.item) <= Math.max(0, base.cargoCount - (step.count || 1));
            case 'earn':
                return g.credits >= (step.credits || 0);
            case 'kill':
                return base.kills >= (step.count || 1);
            default:
                return true;
        }
    }

    // ---------------- Per-frame update ----------------

    update(delta) {
        if (!this.running) return;
        this.cam.update(delta);
        if (this.reactionCooldown > 0) this.reactionCooldown -= delta;

        if (!this.chapter || this.stepIndex < 0 || this.inCutaway) return;
        const step = this.chapter.steps[this.stepIndex];
        if (step && this.isStepComplete(step)) {
            this.game.audioManager.playUIBeep();
            this.advanceStep();
        }
    }

    // ---------------- Reactive narration ----------------

    onGameEvent(type, data) {
        if (!this.running || this.inCutaway) return;

        // Kill tracking for combat steps
        if (type === 'enemyKilled' && this.stepBaseline) this.stepBaseline.kills++;

        if (this.reactionCooldown > 0) return;
        const r = this.chapter?.reactions;
        if (!r) return;

        const pool = { enemyKilled: r.on_kill, playerHit: r.on_damage, dock: r.on_dock }[type];
        if (!pool || !pool.length) return;

        this.reactionCooldown = 6;
        const text = pool[Math.floor(Math.random() * pool.length)];
        const crew = this.cast.alive().filter(c => c.role !== 'cartel fixer');
        const speaker = crew[Math.floor(Math.random() * crew.length)];
        this.sayLine({ speaker: speaker?.name || 'NARRATOR', text }, true).then(() => {
            if (this.running) this.ui.hideSubtitles();
        });
    }

    // ---------------- Cutaways ----------------
    // Brief cinematic interludes where the film takes the stick.

    async cutawayStart() {
        this.inCutaway = true;
        this.ui.letterbox(true);
        this.ui.cutawayMode(true);
        this.ui.setObjective(null);

        // Freeze the ship and orbit it
        this.savedVelocity = this.game.playerShip?.velocity.clone();
        this.game.externalController = () => {
            const ship = this.game.playerShip;
            if (ship) ship.velocity.multiplyScalar(0.9);
            this.game.audioManager.updateEngine(0.1);
        };
        if (document.pointerLockElement === document.body) document.exitPointerLock();
        this.game.suppressPointerLock = true;

        this.cam.setShot({ type: 'orbit', target: 'player', seconds: 30 }, () => ({
            getPosition: v => v.copy(this.game.playerShip.mesh.position),
            getQuaternion: () => this.game.playerShip.mesh.quaternion,
            size: 45,
        }));
    }

    async cutawayEnd() {
        this.ui.hideSubtitles();
        this.ui.letterbox(false);
        this.ui.cutawayMode(false);
        this.game.externalController = null;
        this.game.suppressPointerLock = false;
        this.cam.release();
        this.inCutaway = false;

        // Restore the current objective banner
        const step = this.chapter?.steps?.[this.stepIndex];
        if (step) this.ui.setObjective(step.objective);
    }

    // ---------------- Speech ----------------

    async sayLine(line, quick = false) {
        const isNarrator = line.speaker === 'NARRATOR';
        const char = isNarrator ? null : this.cast.find(line.speaker);
        const name = isNarrator ? 'NARRATOR' : (char ? char.name : line.speaker);
        const color = char ? char.color : NARRATOR_COLOR;
        const voiceName = isNarrator ? NARRATOR_VOICE : (char ? char.voice : NARRATOR_VOICE);

        const spoken = this.voice.speak(line.text, voiceName);
        const shown = this.ui.say(name, line.text, color, isNarrator,
            this.voice.mode === 'off' ? (quick ? 0.7 : 1.0) : 0.3);
        await Promise.all([spoken, shown]);
    }
}
