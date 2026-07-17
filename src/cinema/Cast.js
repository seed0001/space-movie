// Cast — the procedurally generated ensemble of the film.
// Characters have names, roles, traits, secrets, relationships and an
// assigned TTS voice. The Screenwriter (LLM) writes for whoever is alive,
// and can introduce or kill characters via scene directives.

const FIRST_NAMES = {
    m: ['Cassius', 'Dex', 'Orin', 'Jax', 'Silas', 'Marcus', 'Ezra', 'Roan', 'Viktor', 'Halden',
        'Ito', 'Bram', 'Cole', 'Darius', 'Flynn', 'Gideon', 'Knox', 'Lazlo', 'Niko', 'Soren'],
    f: ['Vela', 'Yara', 'Ione', 'Sable', 'Kessa', 'Mira', 'Odessa', 'Rhea', 'Tamsin', 'Zephyrine',
        'Anka', 'Briar', 'Calla', 'Dune', 'Esther', 'Freya', 'Juno', 'Lyra', 'Noor', 'Vesper'],
};

const LAST_NAMES = ['Vance', 'Okonkwo', 'Reyes', 'Castellan', 'Moreau', 'Tanaka', 'Volkov', 'Adeyemi',
    'Strand', 'Halloran', 'Qureshi', 'Delacroix', 'Ashford', 'Novik', 'Sørensen', 'Mbeki',
    'Caldera', 'Ferro', 'Lindqvist', 'Oyelaran', 'Draven', 'Kowalczyk'];

const ROLES = [
    'captain', 'first mate', 'engineer', 'navigator', 'smuggler', 'bounty hunter',
    'ship AI', 'medic', 'stowaway', 'arms dealer', 'union rep', 'salvage diver',
    'company enforcer', 'preacher', 'xenobiologist', 'deserter', 'cartel fixer', 'mechanic'
];

const TRAITS = [
    'paranoid', 'sentimental', 'ruthless', 'superstitious', 'wisecracking', 'haunted',
    'idealistic', 'greedy', 'loyal to a fault', 'terminally curious', 'cowardly', 'fatalistic',
    'romantic', 'vengeful', 'devout', 'compulsive liar', 'homesick', 'glory-seeking',
    'quietly dying', 'secretly rich', 'fresh out of prison', 'too old for this'
];

const WANTS = [
    'to buy back the family farm on Mars', 'to find the ship that left them behind',
    'one last big score before retiring', 'to outrun a debt to the Neptune cartel',
    'revenge on the company that spaced their crew', 'to see Earth one more time',
    'to prove the artifacts from Pluto are real', 'to keep the crew alive, whatever it costs',
    'to be remembered for something', 'to disappear completely',
    'to get the captain to finally say it', 'forgiveness for what happened at Europa'
];

const SECRETS = [
    'is working for the company', 'has a bounty on their head under another name',
    'is smuggling something in the cargo hold nobody knows about', 'left someone to die at Titan',
    'is slowly being replaced by their implants', 'has been skimming the take for years',
    'knows the coordinates everyone is looking for', 'is the sibling of someone the captain killed',
    'never actually got the pilot certification', 'is in love with a crewmate',
    'made a deal with the pirates a year ago', 'is dying and telling no one'
];

const RELATIONSHIP_TYPES = [
    'old war buddies', 'bitter rivals', 'estranged siblings', 'former lovers',
    'owes them money', 'blames them for a death', 'secretly admires them',
    'raised them like family', 'doesn\'t trust them', 'served time together'
];

// Edge TTS neural voices, split so each character sounds distinct.
const VOICES = {
    m: ['en-US-GuyNeural', 'en-US-DavisNeural', 'en-US-TonyNeural', 'en-US-JasonNeural',
        'en-GB-RyanNeural', 'en-AU-WilliamNeural', 'en-US-EricNeural', 'en-IE-ConnorNeural'],
    f: ['en-US-JennyNeural', 'en-US-AriaNeural', 'en-US-MichelleNeural', 'en-US-SaraNeural',
        'en-GB-SoniaNeural', 'en-AU-NatashaNeural', 'en-GB-LibbyNeural', 'en-IE-EmilyNeural'],
};

export const NARRATOR_VOICE = 'en-US-ChristopherNeural';

const SPEAKER_COLORS = ['#7ab0ff', '#ffd479', '#ff9d7a', '#8affc1', '#e59aff', '#7affef', '#ffa8c5', '#c8ff7a'];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export class Cast {
    constructor() {
        this.characters = [];
        this.usedVoices = new Set();
        this.usedNames = new Set();
        this.colorIndex = 0;
    }

    // Create a character. Fields may be overridden (e.g. by an LLM
    // 'introduce' directive that supplies name/role).
    addCharacter(overrides = {}) {
        const gender = overrides.gender === 'm' || overrides.gender === 'f'
            ? overrides.gender : (Math.random() < 0.5 ? 'm' : 'f');

        let name = overrides.name;
        if (!name) {
            do {
                name = `${pick(FIRST_NAMES[gender])} ${pick(LAST_NAMES)}`;
            } while (this.usedNames.has(name));
        }
        this.usedNames.add(name);

        // Prefer an unused voice so the ensemble sounds distinct
        const pool = VOICES[gender];
        const fresh = pool.filter(v => !this.usedVoices.has(v));
        const voice = (fresh.length ? pick(fresh) : pick(pool));
        this.usedVoices.add(voice);

        const character = {
            id: name.toLowerCase().replace(/[^a-z]+/g, '_'),
            name,
            firstName: name.split(' ')[0],
            gender,
            role: overrides.role || pick(ROLES),
            traits: overrides.traits || [pick(TRAITS), pick(TRAITS)],
            want: overrides.want || pick(WANTS),
            secret: overrides.secret || pick(SECRETS),
            voice,
            color: SPEAKER_COLORS[this.colorIndex++ % SPEAKER_COLORS.length],
            alive: true,
            relationships: {},
        };

        // Wire a relationship to one existing living character
        const others = this.alive().filter(c => c !== character);
        if (others.length) {
            const other = pick(others);
            const rel = pick(RELATIONSHIP_TYPES);
            character.relationships[other.name] = rel;
            other.relationships[character.name] = rel;
        }

        this.characters.push(character);
        return character;
    }

    ensureCrew(n = 4) {
        while (this.alive().length < n) this.addCharacter();
    }

    alive() {
        return this.characters.filter(c => c.alive);
    }

    find(nameish) {
        if (!nameish) return null;
        const q = nameish.toLowerCase().trim();
        return this.characters.find(c =>
            c.alive && (
                c.name.toLowerCase() === q ||
                c.firstName.toLowerCase() === q ||
                c.name.toLowerCase().includes(q)
            )
        ) || null;
    }

    kill(nameish) {
        const c = this.find(nameish);
        if (c) c.alive = false;
        return c;
    }

    // Compact cast sheet the Screenwriter feeds to the LLM.
    describeForPrompt() {
        return this.alive().map(c => {
            const rels = Object.entries(c.relationships)
                .filter(([name]) => { const o = this.find(name); return o && o.alive; })
                .map(([name, rel]) => `${rel} with ${name}`).join('; ');
            return `- ${c.name} (${c.role}) — ${c.traits.join(', ')}. Wants ${c.want}. Secret: ${c.secret}.` +
                (rels ? ` Relationships: ${rels}.` : '');
        }).join('\n');
    }

    reset() {
        this.characters = [];
        this.usedVoices.clear();
        this.usedNames.clear();
        this.colorIndex = 0;
    }
}
