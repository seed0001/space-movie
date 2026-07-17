// Screenwriter — generates the film.
//
// Primary path: OpenRouter LLM. Every episode after the three canon ones is
// written live from (user seed + canon + running episode summaries + cast),
// so every film diverges and never repeats.
//
// Fallback path: a procedural template generator, so the picture never
// stops even with no API key or no network.
//
// Output contract (both paths): a "scene" object
//   { title:{super,main,sub}, summary, next_hook, beats:[...] }
// whose beats the MovieDirector executes. See episodes.js for examples.

import { CANON_SUMMARY } from './episodes.js';

const VALID_OPS = new Set(['title', 'lowerthird', 'shot', 'line', 'travel', 'land',
    'takeoff', 'battle', 'kill', 'introduce', 'beat', 'fx']);
const VALID_SHOTS = new Set(['wide', 'orbit', 'flyby', 'chase', 'closeup', 'twoshot', 'pov', 'planet']);
const VALID_FX = new Set(['klaxon', 'laser', 'explosion', 'shake']);
const VALID_ENEMIES = new Set(['Raider', 'Marauder', 'Dreadnought']);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class Screenwriter {
    constructor(client, cast, locationsData) {
        this.client = client;
        this.cast = cast;
        this.locations = locationsData.locations;
        this.seed = null;           // set from the seed form before the film starts
        this.summaries = [];        // rolling episode summaries for continuity
        this.nextHook = '';
        this.episodeNumber = 0;
        this.usedFallbacks = [];
    }

    setSeed(seed) {
        this.seed = seed;
    }

    recordEpisode(summary, nextHook) {
        if (summary) this.summaries.push(summary);
        if (this.summaries.length > 8) this.summaries.shift();
        if (nextHook) this.nextHook = nextHook;
    }

    // ---------------- Movie scenes ----------------

    async generateScene(episodeNumber) {
        this.episodeNumber = episodeNumber;
        if (this.client.isConfigured()) {
            const scene = await this.client.chatJSON([
                { role: 'system', content: this.systemPrompt() },
                { role: 'user', content: this.scenePrompt(episodeNumber) },
            ], { temperature: 1.0, maxTokens: 4500 });

            const clean = scene && this.sanitizeScene(scene, episodeNumber);
            if (clean) return clean;
        }
        return this.fallbackScene(episodeNumber);
    }

    systemPrompt() {
        const locList = this.locations.map(l =>
            `${l.id} (${l.name} — ${l.type}, danger ${l.dangerLevel}: ${l.description})`).join('\n');

        return `You are the screenwriter for an endless, procedurally generated space film rendered
inside a real-time 3D game engine. You write ONE episode at a time as strict JSON.

WORLD LOCATIONS (use these ids exactly):
${locList}

OUTPUT: a single JSON object, no prose, no markdown fences:
{
  "title": {"super": "EPISODE <ROMAN NUMERAL>", "main": "<TITLE>", "sub": "<a wry epigraph>"},
  "summary": "<2-3 sentences: what happened, for continuity>",
  "next_hook": "<1 sentence: the open thread the next episode picks up>",
  "beats": [ ... 14 to 26 beats ... ]
}

BEAT OPERATIONS (the engine executes these in order):
- {"op":"title","super":"...","main":"...","sub":"..."}  — big title card (use sparingly)
- {"op":"lowerthird","title":"...","sub":"..."}          — location caption
- {"op":"shot","type":"wide|orbit|flyby|chase|closeup|twoshot|pov|planet","target":"player|sun|enemies|station:<locId>|planet:<locId>","seconds":4-9}
- {"op":"line","speaker":"<exact cast name or NARRATOR>","text":"<the line>"}
- {"op":"travel","to":"<locId>"}                          — hard cut to another location
- {"op":"land","at":"<locId>"}                            — set down on the planet surface
- {"op":"takeoff"}                                        — return to space (required after land)
- {"op":"battle","count":1-5,"type":"Raider|Marauder|Dreadnought","outcome":"win|flee","seconds":15-30}
- {"op":"kill","character":"<cast name>"}                 — a crew death. Rare, earned, devastating.
- {"op":"introduce","name":"...","role":"...","gender":"m|f"} — new character (do this BEFORE they speak)
- {"op":"fx","type":"klaxon|laser|explosion|shake","seconds":1-5}
- {"op":"beat","seconds":1-3}                             — a held silence

CRAFT RULES:
- Dialogue is the film. Most beats should be "line". Lines are spoken aloud by TTS: keep each under 40 words, character-voiced, no stage directions.
- Only living cast members and NARRATOR may speak. Introduce new characters before their first line.
- Vary the shape: not every episode needs a battle. Quiet drama, negotiations, landings, heists, mysteries, comedy — all welcome. Escalate the season arc.
- Put a shot or fx beat between dialogue stretches so the camera keeps moving.
- If you use "land", you must "takeoff" before the episode ends.
- Honor continuity: past summaries, the hook, character wants/secrets/relationships. Consequences persist.
- Never resolve the whole series. Every episode ends with a hook.`;
    }

    scenePrompt(episodeNumber) {
        const s = this.seed || {};
        const seedBlock = [
            s.description ? `PREMISE (the audience's request — honor it): ${s.description}` : '',
            s.title ? `FILM TITLE: ${s.title}` : '',
            s.genre ? `TONE / GENRE: ${s.genre}` : '',
            s.protagonist ? `PROTAGONIST FOCUS: ${s.protagonist}` : '',
            s.conflict ? `CENTRAL CONFLICT: ${s.conflict}` : '',
            s.themes ? `THEMES: ${s.themes}` : '',
        ].filter(Boolean).join('\n');

        return `${CANON_SUMMARY}

AUDIENCE SEED:
${seedBlock || '(none given — surprise us, stay true to canon)'}

LIVING CAST:
${this.cast.describeForPrompt()}

PREVIOUS EPISODE SUMMARIES (oldest first):
${this.summaries.length ? this.summaries.map((x, i) => `${i + 1}. ${x}`).join('\n') : '(none yet — this follows Episode III directly)'}

OPEN HOOK TO PICK UP: ${this.nextHook || 'The crew follows the Wake signal beyond Pluto while Draven hunts them.'}

Write EPISODE ${episodeNumber} now. JSON only.`;
    }

    // Validate and repair whatever the model returned.
    sanitizeScene(scene, episodeNumber) {
        if (!Array.isArray(scene.beats) || scene.beats.length < 4) return null;

        const locIds = new Set(this.locations.map(l => l.id));
        const beats = [];
        let landed = false;

        for (const raw of scene.beats) {
            if (!raw || !VALID_OPS.has(raw.op)) continue;
            const b = { ...raw };

            switch (b.op) {
                case 'shot':
                    if (!VALID_SHOTS.has(b.type)) b.type = 'orbit';
                    if (typeof b.target !== 'string') b.target = 'player';
                    b.seconds = clamp(b.seconds, 3, 10, 6);
                    break;
                case 'line':
                    if (typeof b.text !== 'string' || !b.text.trim()) continue;
                    b.text = b.text.trim().slice(0, 400);
                    if (typeof b.speaker !== 'string') b.speaker = 'NARRATOR';
                    break;
                case 'travel':
                    if (!locIds.has(b.to)) continue;
                    break;
                case 'land':
                    if (!locIds.has(b.at)) continue;
                    landed = true;
                    break;
                case 'takeoff':
                    landed = false;
                    break;
                case 'battle':
                    b.count = clamp(b.count, 1, 5, 2);
                    if (!VALID_ENEMIES.has(b.type)) b.type = 'Raider';
                    if (b.outcome !== 'flee') b.outcome = 'win';
                    b.seconds = clamp(b.seconds, 10, 35, 20);
                    break;
                case 'kill':
                    if (typeof b.character !== 'string') continue;
                    break;
                case 'introduce':
                    if (typeof b.name !== 'string' || !b.name.trim()) continue;
                    break;
                case 'fx':
                    if (!VALID_FX.has(b.type)) b.type = 'shake';
                    b.seconds = clamp(b.seconds, 1, 6, 2);
                    break;
                case 'beat':
                    b.seconds = clamp(b.seconds, 0.5, 4, 1.5);
                    break;
            }
            beats.push(b);
        }

        if (landed) beats.push({ op: 'takeoff' });
        if (!beats.some(b => b.op === 'line')) return null;

        return {
            title: {
                super: scene.title?.super || `EPISODE ${toRoman(episodeNumber)}`,
                main: scene.title?.main || 'INTO THE WAKE',
                sub: scene.title?.sub || '',
            },
            summary: typeof scene.summary === 'string' ? scene.summary : 'Another episode passed.',
            next_hook: typeof scene.next_hook === 'string' ? scene.next_hook : this.nextHook,
            beats,
        };
    }

    // ---------------- Offline fallback generator ----------------

    fallbackScene(episodeNumber) {
        const crew = this.cast.alive().filter(c => c.role !== 'cartel fixer');
        const a = pick(crew), b = pick(crew.filter(c => c !== a) || [a]);
        const loc = pick(this.locations);
        const shapes = ['ambush', 'landing', 'rival', 'quiet', 'run'];
        // Avoid repeating the last shape
        let shape = pick(shapes);
        if (this.usedFallbacks[this.usedFallbacks.length - 1] === shape) shape = pick(shapes);
        this.usedFallbacks.push(shape);

        const t = (super_, main, sub) => ({ super: `EPISODE ${toRoman(episodeNumber)}`, main, sub });
        const L = (s, x) => ({ op: 'line', speaker: s.name || s, text: x });
        const beats = [];
        let title, summary, hook;

        if (shape === 'ambush') {
            title = t('', 'DEBTS IN TRANSIT', 'nothing travels faster than what you owe');
            beats.push(
                { op: 'travel', to: loc.id },
                { op: 'lowerthird', title: loc.name, sub: loc.description },
                { op: 'shot', type: 'flyby', target: 'player', seconds: 6 },
                L('NARRATOR', `They came to ${loc.name} because the hook demanded it: ${this.nextHook || 'the Wake was still out there, still calling.'}`),
                L(a, `Scanner's too quiet, Captain. ${loc.name} traffic doesn't just stop. Somebody paid it to stop.`),
                { op: 'fx', type: 'klaxon', seconds: 2 },
                L(b, `Contacts! Draven's colors — they found us. Shields up, guns hot!`),
                { op: 'battle', count: 3, type: pick(['Raider', 'Marauder']), outcome: 'win', seconds: 24 },
                { op: 'shot', type: 'orbit', target: 'player', seconds: 5 },
                L(a, `That's the third ambush this month. He's not chasing us anymore. He's herding us.`),
                L(b, `Herding us where?`),
                L('NARRATOR', 'The answer, as always, was further out.'),
            );
            summary = `Draven's ships ambushed the crew at ${loc.name}; they fought free, realizing the ambushes are herding them somewhere.`;
            hook = 'Draven is herding the crew — toward what?';
        } else if (shape === 'landing') {
            title = t('', 'GROUNDFALL', 'some places remember being visited');
            beats.push(
                { op: 'travel', to: loc.id },
                { op: 'lowerthird', title: loc.name, sub: loc.description },
                { op: 'land', at: loc.id },
                { op: 'shot', type: 'wide', target: 'player', seconds: 7 },
                L('NARRATOR', `They set down near ${loc.name}, where the signal ran strongest.`),
                { op: 'shot', type: 'twoshot', target: 'player', seconds: 6 },
                L(a, `Readings are off the chart and then off the next chart. ${b.firstName}, tell me you see this.`),
                L(b, `I see it. Same geometry as the manifests. The Wake was here — and it left something behind.`),
                { op: 'beat', seconds: 2 },
                L(a, `${a.want.charAt(0).toUpperCase() + a.want.slice(1)}. That's all I ever asked. Instead I get haunted real estate.`),
                L(b, `We take a sample, we lift off, and we never tell anyone the coordinates. Agreed?`),
                { op: 'takeoff' },
                { op: 'shot', type: 'chase', target: 'player', seconds: 6 },
                L('NARRATOR', 'They agreed. The sample, sealed in the hold, did not.'),
            );
            summary = `The crew landed near ${loc.name} and recovered a sample of something the Wake left behind. It is now in the hold.`;
            hook = 'The sample in the cargo hold is not inert.';
        } else if (shape === 'rival') {
            title = t('', 'THE PRICE OF PASSAGE', 'everyone at the table is holding the same card');
            beats.push(
                { op: 'travel', to: loc.id },
                { op: 'lowerthird', title: loc.name, sub: loc.description },
                { op: 'shot', type: 'orbit', target: `station:${loc.id}`, seconds: 6 },
                L('NARRATOR', `Word travels. At ${loc.name}, someone was already waiting with an offer.`),
                L('Silas Draven', `No guns this time, Captain. Just arithmetic. Give me the ledger's second layer and I make every bounty on you evaporate.`),
                L(a, `And the part where you already tried to bury us?`),
                L('Silas Draven', `Business. This is also business. The thing past Pluto doesn't renegotiate, and my deliveries are late.`),
                L(b, `Captain — he's scared. Look at him. The cartel king is scared of his own client.`),
                { op: 'beat', seconds: 2 },
                L(a, `No deal, Draven. I think we'd rather meet your client.`),
                { op: 'fx', type: 'klaxon', seconds: 2 },
                { op: 'battle', count: 2, type: 'Marauder', outcome: 'flee', seconds: 18 },
                L('NARRATOR', 'They left him at the table, holding arithmetic that no longer added up.'),
            );
            summary = `Draven offered amnesty for the ledger's second layer at ${loc.name}; the crew refused, seeing he fears his own client, and escaped his escorts.`;
            hook = 'Draven fears whatever is past Pluto — his deliveries are late.';
        } else if (shape === 'quiet') {
            title = t('', 'RUNNING LIGHTS', 'the void is honest at three in the morning');
            beats.push(
                { op: 'shot', type: 'wide', target: 'sun', seconds: 7 },
                L('NARRATOR', 'Between stations there is nothing to fight and nowhere to spend. Just the hum, and each other.'),
                { op: 'shot', type: 'closeup', target: 'player', seconds: 6 },
                L(a, `Can't sleep either?`),
                L(b, `Haven't slept since the Belt. Every time I close my eyes I hear that dead man's ping. You ever think we should have just... kept hauling soy?`),
                L(a, `Every day. But ${a.want}. Can't do that from a life spent hiding.`),
                { op: 'beat', seconds: 2.5 },
                L(b, `There's something I never told you. ${b.secret.charAt(0).toUpperCase() + b.secret.slice(1)}.`),
                { op: 'beat', seconds: 2 },
                L(a, `...I know. I've always known. Get some sleep, ${b.firstName}.`),
                { op: 'shot', type: 'flyby', target: 'player', seconds: 7 },
                L('NARRATOR', 'Some confessions land like meteors. Others just orbit, waiting.'),
            );
            summary = `A quiet night in transit: ${b.name} confessed a secret to ${a.name} — who already knew.`;
            hook = `${b.name}'s confession now hangs between them.`;
        } else {
            const loc2 = pick(this.locations.filter(l => l.id !== loc.id));
            title = t('', 'HOT CARGO', 'the best margins are on the things nobody should carry');
            beats.push(
                { op: 'travel', to: loc.id },
                { op: 'lowerthird', title: loc.name, sub: loc.description },
                { op: 'shot', type: 'orbit', target: `station:${loc.id}`, seconds: 6 },
                L(a, `Manifest says medical crates for ${loc2.name}. Scale says the crates weigh triple. Anyone want to open one?`),
                L(b, `Absolutely not. Rule of the lanes: paid ignorance is the only cargo with no storage fee.`),
                { op: 'shot', type: 'chase', target: 'player', seconds: 6 },
                { op: 'travel', to: loc2.id },
                { op: 'lowerthird', title: loc2.name, sub: loc2.description },
                { op: 'fx', type: 'klaxon', seconds: 2 },
                L(b, `Our buyer just got arrested on the dock. Which makes us the only people in the system holding... whatever this is.`),
                { op: 'battle', count: 2, type: 'Raider', outcome: 'win', seconds: 20 },
                L(a, `Everyone wants these crates and nobody will say why. That's it — Jax, get me a crowbar.`),
                L('NARRATOR', 'Inside was ice. Ordinary ice. Which is exactly what the Wake\'s manifests said it would be — and why the crew finally understood nothing out here is ordinary.'),
            );
            summary = `A smuggling run from ${loc.name} to ${loc2.name} went sour; the mystery crates held Wake-manifest cargo disguised as ice.`;
            hook = 'The Wake\'s cargo moves disguised as ordinary goods — how much of the system\'s freight is already Its?';
        }

        return { title, summary, next_hook: hook, beats };
    }

    // ---------------- Story mode chapters ----------------

    async generateChapter(chapterNumber, gameContext) {
        if (this.client.isConfigured()) {
            const ch = await this.client.chatJSON([
                { role: 'system', content: this.chapterSystemPrompt() },
                { role: 'user', content: this.chapterPrompt(chapterNumber, gameContext) },
            ], { temperature: 0.9, maxTokens: 3000 });
            const clean = ch && this.sanitizeChapter(ch);
            if (clean) return clean;
        }
        return this.fallbackChapter(chapterNumber, gameContext);
    }

    chapterSystemPrompt() {
        const locList = this.locations.map(l => `${l.id} (${l.name})`).join(', ');
        return `You write chapters for the guided "story mode" of a space trading game. The PLAYER flies
the ship; your characters talk them through real gameplay objectives, movie-style.

Locations: ${locList}
Commodity ids: food, water, ore, fuel, electronics, medicine, luxury_goods, machinery, chemicals, ice, rare_metals

Output a single JSON object, no fences:
{
  "title": "<chapter title>",
  "intro": [{"speaker":"<cast name or NARRATOR>","text":"..."}],
  "steps": [
    {"goal":"travel","to":"<locId>","objective":"Fly to <name> — use [,] [.] to target, [P] for autopilot","lines":[{"speaker":"...","text":"..."}]},
    {"goal":"dock","at":"<locId>","objective":"Dock at <name> — press [F] when close","lines":[...]},
    {"goal":"buy","item":"<commodityId>","count":1,"objective":"...","lines":[...]},
    {"goal":"sell","item":"<commodityId>","count":1,"objective":"...","lines":[...]},
    {"goal":"undock","objective":"...","lines":[...]},
    {"goal":"kill","count":2,"objective":"...","lines":[...]},
    {"goal":"earn","credits":1500,"objective":"...","lines":[...]}
  ],
  "outro": [{"speaker":"...","text":"..."}],
  "reactions": {"on_kill":["..."],"on_damage":["..."],"on_dock":["..."]}
}

Rules: 3-6 steps per chapter. "lines" play when the step begins (keep to 1-3 lines).
Reactions are single spoken lines (no speaker prefix) used randomly during play.
Steps must chain sensibly (travel before dock; dock before buy/sell). Teach and dramatize.`;
    }

    chapterPrompt(n, ctx) {
        return `${CANON_SUMMARY}

CAST:
${this.cast.describeForPrompt()}

PLAYER STATE: at ${ctx.location}, ${ctx.credits} credits, ${ctx.cargo} cargo units aboard.
PREVIOUS CHAPTERS: ${this.summaries.length ? this.summaries.join(' | ') : '(none)'}

Write CHAPTER ${n}. Vary the verbs (trade, combat, travel). JSON only.`;
    }

    sanitizeChapter(ch) {
        if (!Array.isArray(ch.steps) || !ch.steps.length) return null;
        const locIds = new Set(this.locations.map(l => l.id));
        const steps = ch.steps.filter(s => {
            if (!s || typeof s.objective !== 'string') return false;
            if (s.goal === 'travel' || s.goal === 'dock') return locIds.has(s.to || s.at);
            return ['buy', 'sell', 'undock', 'kill', 'earn'].includes(s.goal);
        });
        if (!steps.length) return null;
        return {
            title: typeof ch.title === 'string' ? ch.title : 'THE NEXT RUN',
            intro: Array.isArray(ch.intro) ? ch.intro : [],
            steps,
            outro: Array.isArray(ch.outro) ? ch.outro : [],
            reactions: {
                on_kill: ch.reactions?.on_kill || [],
                on_damage: ch.reactions?.on_damage || [],
                on_dock: ch.reactions?.on_dock || [],
            },
        };
    }

    fallbackChapter(n, ctx) {
        const runs = [
            { from: 'earth', to: 'mars', item: 'food' },
            { from: 'mars', to: 'asteroid_belt', item: 'food' },
            { from: 'asteroid_belt', to: 'earth', item: 'ore' },
            { from: 'venus', to: 'jupiter', item: 'fuel' },
            { from: 'luna', to: 'saturn', item: 'electronics' },
        ];
        const run = runs[(n - 1) % runs.length];
        const to = this.locations.find(l => l.id === run.to);
        const from = this.locations.find(l => l.id === run.from);
        const danger = (to?.dangerLevel || 0) >= 2;

        const steps = [
            {
                goal: 'travel', to: run.from,
                objective: `Fly to ${from.name} — cycle targets with [,] [.] then hit [P] for autopilot`,
                lines: [{ speaker: 'Vela Okonkwo', text: `Course plotted for ${from.name}. Target it and let the autopilot burn — watch the fuel gauge while she flies.` }],
            },
            {
                goal: 'dock', at: run.from,
                objective: `Dock at ${from.name} — press [F] inside 200km`,
                lines: [{ speaker: 'Halcyon', text: 'Kill your speed on approach, Captain. Stations frown on freighters arriving as debris.' }],
            },
            {
                goal: 'buy', item: run.item, count: 3,
                objective: `Buy 3 units of ${run.item} at the market`,
                lines: [{ speaker: 'Jax Moreau', text: `${from.name} is drowning in ${run.item} — that means it's cheap. Load up. This is the whole business, right here.` }],
            },
            {
                goal: 'dock', at: run.to,
                objective: `Haul the cargo to ${to.name} and dock — [F]`,
                lines: [{ speaker: 'Vela Okonkwo', text: danger ? `Heads up — ${to.name} is pirate water. Shields drink hits first, hull is what kills you. Spacebar fires.` : `Straight run to ${to.name}. Enjoy the quiet. It never lasts.` }],
            },
            {
                goal: 'sell', item: run.item, count: 3,
                objective: `Sell the ${run.item} at ${to.name} — buy low, sell high`,
                lines: [{ speaker: 'Jax Moreau', text: 'And now the beautiful part. Sell it all and watch the number go up.' }],
            },
        ];
        if (danger) {
            steps.splice(3, 0, {
                goal: 'kill', count: 2,
                objective: 'Fight off the pirates — [Space] to fire',
                lines: [{ speaker: 'Odessa Vance', text: 'Contacts! Guns free — lead your shots and keep moving. Nobody dies today.' }],
            });
        }

        return {
            title: ['THE MILK RUN', 'DANGER PAY', 'THE LONG WAY HOME', 'FULL TANKS', 'WORKING THE LANES'][(n - 1) % 5],
            intro: [
                { speaker: 'NARRATOR', text: `Chapter ${n}. The lanes don't care what happened yesterday. There is always another run.` },
                { speaker: 'Odessa Vance', text: 'You have the stick. We\'ll talk you through it. Fly like you mean to get old.' },
            ],
            steps,
            outro: [
                { speaker: 'Odessa Vance', text: 'Clean run. Log it and line up the next one.' },
                { speaker: 'NARRATOR', text: 'Credit by credit, the Long Odds earned its name.' },
            ],
            reactions: {
                on_kill: ['Splash one! Nice shooting.', 'That\'s scrap. Anyone else?', 'He\'s dust — stay sharp, they hunt in packs.'],
                on_damage: ['Shields are eating it — for now.', 'Hull stress! Don\'t trade paint with these people.', 'Taking fire! Move, Captain!'],
                on_dock: ['Clamps on. Good approach.', 'Docked and drawing station power. Stretch your legs.'],
            },
        };
    }
}

function clamp(v, min, max, dflt) {
    const n = Number(v);
    if (!isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, n));
}

function toRoman(n) {
    const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
    return out || 'I';
}
