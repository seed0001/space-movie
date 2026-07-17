import { CinemaUI } from './CinemaUI.js';
import { Cast } from './Cast.js';
import { OpenRouterClient } from './OpenRouterClient.js';
import { VoiceEngine } from './VoiceEngine.js';
import { Screenwriter } from './Screenwriter.js';
import { CameraDirector } from './CameraDirector.js';
import { MovieDirector } from './MovieDirector.js';
import { StoryDirector } from './StoryDirector.js';

// CinemaManager — front door of the three-part experience.
// Owns the mode-select screen, the movie seed form, the AI/voice settings,
// and whichever director is currently running.

const SEED_STORAGE = 'sst_movie_seed';

const RANDOM_SEEDS = [
    {
        title: 'THE ICE ROAD', genre: 'noir thriller',
        description: 'A dying smuggler hires the crew to deliver one final crate to Pluto without ever opening it. Everyone they meet on the way has already been paid to take it from them.',
        protagonist: 'Captain Vance, tempted for once to open the box',
        conflict: 'The crate whispers. The Wake wants it back.',
        themes: 'trust, the price of curiosity',
    },
    {
        title: 'COMBINE AND CONQUER', genre: 'corporate space opera',
        description: 'The Combine announces it is "acquiring" the outer system. Free stations must pay tribute or go dark. The crew runs guns, medicine and hope to the holdouts.',
        protagonist: 'The whole crew, radicalized one invoice at a time',
        conflict: 'Independence versus survival; Draven is selling out the holdouts',
        themes: 'freedom, solidarity, what a flag is worth',
    },
    {
        title: 'THE GHOST FREIGHT', genre: 'horror mystery',
        description: 'Ships along the Neptune lane are arriving on schedule with no crews aboard and cargo nobody shipped. The Long Odds is hired to ride along on the next one.',
        protagonist: 'Halcyon, who alone can hear the empty ships answering each other',
        conflict: 'The Wake is learning to imitate freight — and crews',
        themes: 'identity, what makes a ship a home',
    },
    {
        title: 'ODESSA\'S WAR', genre: 'revenge drama',
        description: 'Proof surfaces that the Europa incident was no accident — someone sold the coordinates of Vance\'s old ship. The trail runs through every station from Venus to Titan.',
        protagonist: 'Captain Odessa Vance, finally facing Europa',
        conflict: 'Revenge or the crew — she cannot keep both',
        themes: 'grief, forgiveness, the cost of the truth',
    },
    {
        title: 'FOOL\'S GOLD', genre: 'heist comedy',
        description: 'Jax wins a treasure map in a card game at Neptune Haven. The treasure is real, it is enormous, and it is currently the centerpiece of Draven\'s private vault.',
        protagonist: 'Jax Moreau, promoted by hubris to mastermind',
        conflict: 'The perfect heist versus the crew\'s complete inability to follow a plan',
        themes: 'luck, loyalty, knowing when to fold',
    },
];

export class CinemaManager {
    constructor(game, camera) {
        this.game = game;
        this.mode = null;

        this.ui = new CinemaUI();
        this.cast = new Cast();
        this.client = new OpenRouterClient();
        this.voice = new VoiceEngine();
        this.writer = new Screenwriter(this.client, this.cast, game.locationsData);
        this.cameraDirector = new CameraDirector(camera, game);
        this.movie = new MovieDirector(game, this.ui, this.cameraDirector, this.writer, this.cast, this.voice);
        this.story = new StoryDirector(game, this.ui, this.cameraDirector, this.writer, this.cast, this.voice);

        this.modeSelectEl = document.getElementById('mode-select');
        this.buildSeedPanel();
        this.bindUI();

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.mode && this.mode !== 'play') {
                // One clean way back: full reload returns to the menu with
                // pristine game state (saves are untouched).
                location.reload();
            }
        });
    }

    // ---------------- Menu ----------------

    showModeSelect() {
        this.game.inputLocked = true;
        this.modeSelectEl.classList.remove('hidden', 'fading');
    }

    bindUI() {
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                if (mode === 'play') this.startPlay();
                if (mode === 'story') this.startStory();
                if (mode === 'movie') this.showSeedPanel();
            });
        });
    }

    async dismissMenu() {
        this.modeSelectEl.classList.add('fading');
        await this.ui.wait(800);
        this.modeSelectEl.classList.add('hidden');
    }

    // ---------------- Part I: pure game ----------------

    async startPlay() {
        this.mode = 'play';
        this.game.inputLocked = false;
        await this.dismissMenu();
        // And that's it. The game, untouched.
    }

    // ---------------- Part II: story ----------------

    async startStory() {
        this.mode = 'story';
        this.game.inputLocked = false;
        await this.dismissMenu();
        this.story.start();
    }

    // ---------------- Part III: movie ----------------

    showSeedPanel() {
        document.querySelector('.mode-cards').style.display = 'none';
        document.querySelector('#mode-select .tagline').style.display = 'none';
        document.getElementById('seed-panel').classList.remove('hidden');
        this.loadSeedForm();
        this.refreshAiStatus();
    }

    hideSeedPanel() {
        document.querySelector('.mode-cards').style.display = '';
        document.querySelector('#mode-select .tagline').style.display = '';
        document.getElementById('seed-panel').classList.add('hidden');
    }

    buildSeedPanel() {
        const panel = document.createElement('div');
        panel.id = 'seed-panel';
        panel.className = 'hidden';
        panel.innerHTML = `
            <div class="seed-columns">
                <div class="seed-col">
                    <h2>SEED YOUR PICTURE</h2>
                    <p class="seed-help">Three foundational episodes open every film — the world, the crew,
                    the rules of the lanes. From Episode IV on, the picture is generated live from what you write here.</p>

                    <label>PREMISE — what is this movie about? <span class="req">required</span></label>
                    <textarea id="seed-description" rows="4"
                        placeholder="e.g. The crew discovers the Wake is offering to buy Earth — and somebody at Earth Orbital is selling..."></textarea>

                    <label>TITLE <span class="opt">optional — we'll name it otherwise</span></label>
                    <input id="seed-title" type="text" placeholder="e.g. THE ICE ROAD">

                    <label>TONE / GENRE</label>
                    <input id="seed-genre" type="text" placeholder="e.g. noir thriller, heist comedy, horror mystery, space opera">

                    <label>CENTRAL CONFLICT / STAKES</label>
                    <input id="seed-conflict" type="text" placeholder="e.g. Draven knows where the crew sleeps; the signal is getting closer">

                    <label>PROTAGONIST FOCUS <span class="opt">optional</span></label>
                    <input id="seed-protagonist" type="text" placeholder="e.g. Vela, forced to choose between the crew and her old cartel">

                    <label>THEMES <span class="opt">optional</span></label>
                    <input id="seed-themes" type="text" placeholder="e.g. trust, grief, what home means in the void">
                </div>

                <div class="seed-col seed-settings">
                    <h2>PROJECTION BOOTH</h2>

                    <label>OPENROUTER API KEY <span class="opt">powers live generation</span></label>
                    <input id="setting-or-key" type="password" placeholder="sk-or-...">

                    <label>MODEL</label>
                    <input id="setting-or-model" type="text" list="model-suggestions">
                    <datalist id="model-suggestions">
                        <option value="anthropic/claude-haiku-4.5"></option>
                        <option value="anthropic/claude-sonnet-4.5"></option>
                        <option value="openai/gpt-4o-mini"></option>
                        <option value="meta-llama/llama-3.3-70b-instruct"></option>
                    </datalist>

                    <label>VOICES</label>
                    <select id="setting-voice-mode">
                        <option value="edge">Edge TTS (neural, per-character)</option>
                        <option value="browser">Browser speech synthesis</option>
                        <option value="off">Off (subtitles only)</option>
                    </select>

                    <div id="ai-status" class="ai-status"></div>

                    <div class="seed-buttons">
                        <button id="seed-randomize" class="btn seed-btn">🎲 RANDOMIZE</button>
                        <button id="seed-start" class="btn seed-btn primary">▶ START THE FILM</button>
                        <button id="seed-back" class="btn seed-btn">← BACK</button>
                    </div>
                    <div id="seed-error" class="seed-error"></div>
                </div>
            </div>
        `;
        this.modeSelectEl.appendChild(panel);

        panel.querySelector('#seed-back').addEventListener('click', () => this.hideSeedPanel());
        panel.querySelector('#seed-randomize').addEventListener('click', () => {
            const s = RANDOM_SEEDS[Math.floor(Math.random() * RANDOM_SEEDS.length)];
            this.fillSeedForm(s);
        });
        panel.querySelector('#seed-start').addEventListener('click', () => this.startMovieFromForm());

        panel.querySelector('#setting-or-key').addEventListener('change', (e) => {
            this.client.setKey(e.target.value);
            this.refreshAiStatus();
        });
        panel.querySelector('#setting-or-model').addEventListener('change', (e) => {
            this.client.setModel(e.target.value);
            this.refreshAiStatus();
        });
        panel.querySelector('#setting-voice-mode').addEventListener('change', (e) => {
            this.voice.setMode(e.target.value);
        });
    }

    fillSeedForm(s) {
        document.getElementById('seed-description').value = s.description || '';
        document.getElementById('seed-title').value = s.title || '';
        document.getElementById('seed-genre').value = s.genre || '';
        document.getElementById('seed-conflict').value = s.conflict || '';
        document.getElementById('seed-protagonist').value = s.protagonist || '';
        document.getElementById('seed-themes').value = s.themes || '';
    }

    loadSeedForm() {
        try {
            const saved = JSON.parse(localStorage.getItem(SEED_STORAGE) || 'null');
            if (saved) this.fillSeedForm(saved);
        } catch (e) { /* fresh form */ }
        document.getElementById('setting-or-key').value = this.client.apiKey;
        document.getElementById('setting-or-model').value = this.client.model;
        document.getElementById('setting-voice-mode').value = this.voice.mode;
    }

    readSeedForm() {
        return {
            description: document.getElementById('seed-description').value.trim(),
            title: document.getElementById('seed-title').value.trim(),
            genre: document.getElementById('seed-genre').value.trim(),
            conflict: document.getElementById('seed-conflict').value.trim(),
            protagonist: document.getElementById('seed-protagonist').value.trim(),
            themes: document.getElementById('seed-themes').value.trim(),
        };
    }

    refreshAiStatus() {
        const el = document.getElementById('ai-status');
        if (this.client.isConfigured()) {
            el.textContent = `◉ AI LIVE — ${this.client.model}. Episodes IV+ generated fresh every screening.`;
            el.className = 'ai-status live';
        } else {
            el.textContent = '◌ NO API KEY — the three canon episodes play in full; later episodes use the built-in script generator. Add an OpenRouter key for a truly endless, never-repeating picture.';
            el.className = 'ai-status offline';
        }
    }

    async startMovieFromForm() {
        const seed = this.readSeedForm();
        const errEl = document.getElementById('seed-error');

        if (!seed.description) {
            errEl.textContent = 'The premise is required — every picture needs one. (Or hit RANDOMIZE.)';
            return;
        }
        errEl.textContent = '';
        localStorage.setItem(SEED_STORAGE, JSON.stringify(seed));

        this.mode = 'movie';
        this.writer.setSeed(seed);
        this.game.inputLocked = true;
        await this.dismissMenu();
        this.movie.start();
    }

    // ---------------- Per-frame ----------------

    update(delta) {
        if (this.mode === 'movie') this.movie.update(delta);
        else if (this.mode === 'story') this.story.update(delta);
    }
}
