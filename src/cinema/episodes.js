// The three foundational episodes of the film.
//
// These are canon: they open every movie regardless of seed. They carry the
// backstory of the world, introduce the crew, and explain how the game works
// diegetically — trading, docking, autopilot, mining, combat, upgrades — all
// dramatized. After Episode III the Screenwriter (LLM) takes over and
// generates the endless picture from the user's seed plus this canon.
//
// They are written in the exact beat format the LLM is asked to produce,
// so they also serve as the format's reference examples.

// The canonical crew. Seeded into the Cast before Episode I.
export const CANON_CREW = [
    {
        name: 'Odessa Vance', gender: 'f', role: 'captain',
        traits: ['haunted', 'loyal to a fault'],
        want: 'to keep the crew alive, whatever it costs',
        secret: 'left someone to die at Europa',
        voice: 'en-US-AriaNeural', color: '#ffd479',
    },
    {
        name: 'Jax Moreau', gender: 'm', role: 'engineer',
        traits: ['wisecracking', 'superstitious'],
        want: 'one last big score before retiring',
        secret: 'never actually got the pilot certification',
        voice: 'en-US-GuyNeural', color: '#7ab0ff',
    },
    {
        name: 'Halcyon', gender: 'm', role: 'ship AI',
        traits: ['terminally curious', 'fatalistic'],
        want: 'to understand why humans keep doing this to themselves',
        secret: 'is slowly being replaced by their implants',
        voice: 'en-GB-RyanNeural', color: '#7affef',
    },
    {
        name: 'Vela Okonkwo', gender: 'f', role: 'navigator',
        traits: ['fresh out of prison', 'paranoid'],
        want: 'to outrun a debt to the Neptune cartel',
        secret: 'knows the coordinates everyone is looking for',
        voice: 'en-GB-SoniaNeural', color: '#8affc1',
    },
    {
        name: 'Silas Draven', gender: 'm', role: 'cartel fixer',
        traits: ['ruthless', 'romantic'],
        want: 'the ledger, and everyone who has read it',
        secret: 'made a deal with something out past Pluto',
        voice: 'en-US-DavisNeural', color: '#ff9d7a',
    },
];

// Canon summary fed to the LLM as permanent context for every
// generated episode after these three.
export const CANON_SUMMARY = `
CANON (Episodes I–III, already shown):
Setting: late 2200s. Earth's governments collapsed a century ago; the Combine —
a corporate successor-state — owns the inner lanes. Independent traders survive
in the cracks, hauling cargo between thirteen stations from Mercury to Pluto.
The ship: the LONG ODDS, an independent freighter. Crew: Captain Odessa Vance
(haunted, lost a crewmate at Europa), engineer Jax Moreau (jokes to cope,
no pilot cert), ship AI Halcyon (curious, fatalistic), navigator Vela Okonkwo
(ex-convict, owes the Neptune cartel).
Episode I: a food run from Earth Orbital to Mars Colony established the trade —
buy low, sell high, keep the tank full. A distress ping from the Belt ended it.
Episode II: in the Belt they found the ping's source — a gutted mining wreck —
and salvaged an encrypted cartel ledger. Draven's raiders attacked to take it;
the crew fought them off. Vela confessed: she served time for Draven, and the
ledger is his book of debts — hers included.
Episode III: at Neptune Haven they tried to sell the ledger back to Silas
Draven. He betrayed the deal, they escaped his dreadnought, and the ledger
unlocked: hidden inside was a repeating signal from beyond Pluto and
manifests for cargo that was never human. The crew is now hunted by Draven
and pulled toward the signal — "the Wake" — at the edge of known space.
`.trim();

export const EPISODES = [
    // ============================================================
    // EPISODE I — THE LONG HAUL
    // Backstory + the trade loop: credits, cargo, buy/sell, dock, autopilot, fuel
    // ============================================================
    {
        id: 'ep1',
        title: { super: 'EPISODE I', main: 'THE LONG HAUL', sub: 'every fortune out here started as freight' },
        summary: 'The crew of the Long Odds runs food from Earth to Mars and teaches us the trade. A distress ping from the Belt interrupts the quiet.',
        next_hook: 'A distress ping from the Asteroid Belt, on a callsign Vela recognizes.',
        beats: [
            { op: 'shot', type: 'wide', target: 'sun', seconds: 6 },
            { op: 'line', speaker: 'NARRATOR', text: 'The sun never set on the human race. It just stopped being the point.' },
            { op: 'line', speaker: 'NARRATOR', text: 'A hundred years after Earth\'s governments drowned in their own debts, the Combine owns every lane inside of Jupiter. What it doesn\'t own, it taxes. What it can\'t tax, it calls piracy.' },
            { op: 'shot', type: 'planet', target: 'station:earth', seconds: 7 },
            { op: 'lowerthird', title: 'Earth Orbital', sub: 'Humanity\'s home. Central trading hub.' },
            { op: 'line', speaker: 'NARRATOR', text: 'But between the tariffs and the void, there is a living to be made. Thirteen stations, Mercury to Pluto. Buy low. Fly far. Sell high. Don\'t die.' },
            { op: 'shot', type: 'flyby', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'NARRATOR', text: 'This is the Long Odds. Independent freighter, four souls aboard. This is their picture.' },
            { op: 'title', super: '', main: 'THE LONG ODDS', sub: 'an endless picture' },

            { op: 'shot', type: 'closeup', target: 'player', seconds: 5 },
            { op: 'line', speaker: 'Odessa Vance', text: 'Manifest check. Jax, tell me something beautiful.' },
            { op: 'line', speaker: 'Jax Moreau', text: 'Twenty tons of freeze-dried protein, bought at forty credits a crate while Earth was practically giving it away. Mars Colony is paying ninety. That\'s not cargo, Captain, that\'s poetry.' },
            { op: 'line', speaker: 'Halcyon', text: 'Technically it is soy. I have run the margins: after fuel and docking fees, we clear enough to finally fix the water recycler. Or, per Jax\'s proposal, buy a neon sign for the galley.' },
            { op: 'line', speaker: 'Jax Moreau', text: 'The sign says LIVE ODDS. It\'s thematic.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'Recycler first. Vela, plot us for Mars.' },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Course locked. Autopilot will burn us in and brake at the ring — cheaper than me flying it by hand, and it doesn\'t scratch the paint.' },

            { op: 'shot', type: 'chase', target: 'player', seconds: 6 },
            { op: 'travel', to: 'mars' },
            { op: 'lowerthird', title: 'Mars Colony', sub: 'Terraforming in progress. Growing population.' },
            { op: 'shot', type: 'orbit', target: 'station:mars', seconds: 7 },
            { op: 'line', speaker: 'Halcyon', text: 'Docking clamps engaged. Fuel reserves at sixty percent — a full tank at Mars prices costs less than an empty one at Saturn\'s. I recommend topping off. I always recommend topping off.' },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Rule one of the lanes: fuel where it\'s cheap, repair before you need it, and never let the tank decide your route for you.' },

            { op: 'shot', type: 'twoshot', target: 'station:mars', seconds: 6 },
            { op: 'line', speaker: 'Jax Moreau', text: 'Sold! Ninety-two a crate. The colony dome bought the lot before we finished the handshake.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'That\'s the whole game, people. Watch what a station is starving for, and be the one holding it. Food to miners. Ore to factories. Medicine to anywhere the Combine forgot.' },
            { op: 'line', speaker: 'Halcyon', text: 'Captain, ledger updated. For one shining moment, we are not poor.' },
            { op: 'beat', seconds: 1.5 },

            { op: 'fx', type: 'klaxon', seconds: 2 },
            { op: 'shot', type: 'closeup', target: 'player', seconds: 5 },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Captain. Distress ping, long range — out of the Belt. Automated, weak... it\'s cycling a registry callsign.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'Whose?' },
            { op: 'line', speaker: 'Vela Okonkwo', text: '...One I used to fly under. Before prison.' },
            { op: 'shot', type: 'wide', target: 'sun', seconds: 5 },
            { op: 'line', speaker: 'NARRATOR', text: 'Out here, the past doesn\'t stay buried. It just drifts, and waits for traffic.' },
        ],
    },

    // ============================================================
    // EPISODE II — TEETH OF THE BELT
    // Mining + combat: lasers, heat, shields vs hull, weapons, salvage
    // ============================================================
    {
        id: 'ep2',
        title: { super: 'EPISODE II', main: 'TEETH OF THE BELT', sub: 'the Belt gives, and the Belt takes' },
        summary: 'The crew answers the distress ping in the Asteroid Belt, salvages an encrypted cartel ledger from a wreck, and fights off Draven\'s raiders who come to claim it.',
        next_hook: 'The encrypted ledger — Draven\'s book of debts — and coordinates pointing past Neptune.',
        beats: [
            { op: 'shot', type: 'wide', target: 'station:asteroid_belt', seconds: 6 },
            { op: 'travel', to: 'asteroid_belt' },
            { op: 'lowerthird', title: 'The Asteroid Belt', sub: 'Lawless mining zone. Watch for pirates.' },
            { op: 'line', speaker: 'NARRATOR', text: 'The Belt is where the system keeps its teeth. A billion rocks, a thousand claims, and no law but tonnage.' },
            { op: 'shot', type: 'flyby', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'Jax Moreau', text: 'Ping\'s coming from inside the field. Nobody parks inside the field, Captain. Rocks don\'t honk before they hit you.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'Then we go slow. Halcyon, warm up the mining laser — if we\'re threading rock anyway, we may as well get paid for it.' },
            { op: 'line', speaker: 'Halcyon', text: 'Mining laser online. Gentle reminder: she runs hot. Cut, breathe, let her cool. Grip her too long and we drift blind in a rock field while the barrel sulks.' },

            { op: 'shot', type: 'closeup', target: 'player', seconds: 5 },
            { op: 'fx', type: 'laser', seconds: 5 },
            { op: 'line', speaker: 'Jax Moreau', text: 'There — cracked her open. Ice and ore, decent grade. Saturn pays double for ice, the refineries pay for ore. The Belt provides.' },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'The Belt also takes. Contact, Captain. Dead ahead. It\'s... it\'s a wreck. Mining rig, gutted. That\'s the source of the ping.' },
            { op: 'shot', type: 'wide', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'Odessa Vance', text: 'Survivors?' },
            { op: 'line', speaker: 'Halcyon', text: 'No life signs. The ping is a dead man\'s switch. But there is a sealed data core still drawing power. Salvage rights say it\'s ours.' },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Captain — don\'t. I know that hull. That\'s a cartel courier. Whatever\'s in that core, someone paid in blood to keep it moving.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'And someone died asking for help. Jax — bring it in.' },
            { op: 'beat', seconds: 2 },

            { op: 'fx', type: 'klaxon', seconds: 2 },
            { op: 'line', speaker: 'Halcyon', text: 'Three contacts burning in fast. Raider profiles. Weapons hot. They are not here to file a salvage dispute.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'Shields up. Everybody strap in. Shields drink the first hits — when they\'re gone, it\'s hull, and hull is us. Jax, keep the reactor breathing. Vela, guns.' },
            { op: 'line', speaker: 'Jax Moreau', text: 'See, this is why I wanted the sign. LIVE ODDS. Very relevant right now!' },
            { op: 'battle', count: 3, type: 'Raider', outcome: 'win', seconds: 26 },
            { op: 'shot', type: 'orbit', target: 'player', seconds: 5 },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Last one\'s dust. They broadcast one word before they died, Captain. A name. Draven.' },

            { op: 'shot', type: 'twoshot', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'Odessa Vance', text: 'You knew that wreck, you knew these raiders. Talk, Vela. Now.' },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Silas Draven. Neptune cartel. I flew his books for two years — it\'s why I went in and he didn\'t. That core is his ledger. Every debt, every bribe, every body. Mine\'s in there too.' },
            { op: 'line', speaker: 'Halcyon', text: 'Decryption is running. Curious: beneath the accounts there is a second layer. Coordinates. They point... past Neptune. Considerably past.' },
            { op: 'line', speaker: 'NARRATOR', text: 'The most dangerous cargo in the system has always been the same thing. It isn\'t weapons. It\'s ledgers.' },
        ],
    },

    // ============================================================
    // EPISODE III — NEPTUNE'S LEDGER
    // Upgrades/outfitting/shipyard + smuggler economy; betrayal; the hook to infinity
    // ============================================================
    {
        id: 'ep3',
        title: { super: 'EPISODE III', main: 'NEPTUNE\'S LEDGER', sub: 'never sell a man the rope he\'ll hang you with' },
        summary: 'At Neptune Haven the crew refits the ship and tries to sell Draven his ledger back. He betrays the deal; they escape his dreadnought. The ledger unlocks a signal from beyond Pluto — the Wake.',
        next_hook: 'Hunted by Draven, the crew follows the Wake — a repeating signal and inhuman cargo manifests pointing beyond Pluto.',
        beats: [
            { op: 'travel', to: 'neptune' },
            { op: 'shot', type: 'planet', target: 'station:neptune', seconds: 7 },
            { op: 'lowerthird', title: 'Neptune Haven', sub: 'Smuggler\'s paradise. No questions asked.' },
            { op: 'line', speaker: 'NARRATOR', text: 'Past Saturn, the Combine\'s writ runs thin. Neptune Haven asks no questions, because every answer is for sale.' },
            { op: 'shot', type: 'orbit', target: 'station:neptune', seconds: 6 },
            { op: 'line', speaker: 'Jax Moreau', text: 'Outfitter\'s topped off the shield banks and I got the engine tuned past spec. Cost us the Mars money and then some, but Captain — if this goes sideways, we\'ll want the legs.' },
            { op: 'line', speaker: 'Halcyon', text: 'The shipyard also made an offer on the hull itself. A larger freighter, better guns. One builds a fleet the way one builds a fortune: one desperate decision at a time.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'We keep the Odds. You don\'t trade away the only thing that\'s never lied to you.' },

            { op: 'shot', type: 'twoshot', target: 'station:neptune', seconds: 6 },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'He\'s here. Private slip nine. Remember — we hand him the core, he clears my debt, everybody flies away rich and alive.' },
            { op: 'line', speaker: 'Silas Draven', text: 'Vela Okonkwo. Prison thinned you. And you\'ve brought me my book of sins — with, I see, sixty percent of the encryption chewed through. Curiosity is a tax you couldn\'t afford.' },
            { op: 'line', speaker: 'Odessa Vance', text: 'The deal was the core for her debt, Draven. We didn\'t read past the cover.' },
            { op: 'line', speaker: 'Silas Draven', text: 'Captain Vance. Europa\'s own. Here is my counter-offer: I keep the ledger, the debt, and the four of you — because the only vault I trust anymore is a grave.' },
            { op: 'fx', type: 'klaxon', seconds: 2 },
            { op: 'line', speaker: 'Halcyon', text: 'Undocking NOW. His dreadnought is powering weapons. I have taken the liberty of being terrified for all of us.' },

            { op: 'battle', count: 4, type: 'Marauder', outcome: 'win', seconds: 24 },
            { op: 'shot', type: 'chase', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'Jax Moreau', text: 'Dreadnought\'s still coming — shields won\'t eat what that thing throws! New engine, don\'t make me a liar!' },
            { op: 'battle', count: 1, type: 'Dreadnought', outcome: 'flee', seconds: 20 },
            { op: 'line', speaker: 'Odessa Vance', text: 'Full burn. We are leaving.' },

            { op: 'land', at: 'pluto' },
            { op: 'lowerthird', title: 'Pluto — Dark Side', sub: 'Edge of known space' },
            { op: 'shot', type: 'wide', target: 'player', seconds: 7 },
            { op: 'line', speaker: 'NARRATOR', text: 'They ran until the sun was just another star, and set down on ice that had never held a footprint.' },
            { op: 'shot', type: 'twoshot', target: 'player', seconds: 6 },
            { op: 'line', speaker: 'Vela Okonkwo', text: 'Decryption finished while we ran. Captain... the coordinates aren\'t a stash. They\'re a schedule. Something out there is broadcasting on a loop, and Draven\'s been selling it cargo.' },
            { op: 'line', speaker: 'Halcyon', text: 'I have read the manifests four hundred times. The tonnage is wrong, the geometry is wrong, and the destination does not orbit anything. Whatever signs for these deliveries... I do not believe it is human.' },
            { op: 'line', speaker: 'Jax Moreau', text: 'So the cartel king wants us dead, and the thing he answers to lives past the edge of the map. Anybody else miss soy?' },
            { op: 'line', speaker: 'Odessa Vance', text: 'They call it the Wake. Fine. We\'ve got a full tank, a fast ship, and nothing left to lose that we haven\'t already lost. Set course, Vela. Let\'s go see what\'s making waves.' },
            { op: 'takeoff' },
            { op: 'shot', type: 'wide', target: 'sun', seconds: 7 },
            { op: 'line', speaker: 'NARRATOR', text: 'And out past the last station, past the last law, past the last light — the picture goes on. It always goes on.' },
            { op: 'title', super: 'THE FOUNDATION IS LAID', main: 'THE PICTURE CONTINUES', sub: 'generated from here on, every night different' },
        ],
    },
];
