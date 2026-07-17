// CloudSave — optional cross-device persistence via the deploy server.
//
// localStorage stays the source of truth while playing; if the player sets a
// callsign, their save syncs to /api/save/<callsign> on the server (backed by
// a mounted volume on Railway). On boot, the newer copy wins. On a static
// host with no API these calls fail quietly and the game is unaffected.

const CALLSIGN_KEY = 'sst_callsign';
const STAMP_KEY = 'sst_save_updatedAt';

// Everything that defines a player, synced as one document:
//   sst_save        — credits, ship, location, cargo, hull/shield/fuel,
//                     upgrades, quests, price memory, market state, fleet
//   sst_movie_seed  — their movie premise/genre/conflict form
//   sst_or_model    — preferred model
//   sst_voice_mode  — voice preference
// The OpenRouter API key is deliberately NOT synced — keys stay in the
// browser that entered them (use the server env key for sharing).
const SYNCED_KEYS = ['sst_save', 'sst_movie_seed', 'sst_openrouter_model', 'sst_voice_mode'];

export function getCallsign() {
    return localStorage.getItem(CALLSIGN_KEY) || '';
}

export function setCallsign(name) {
    const clean = (name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (clean) localStorage.setItem(CALLSIGN_KEY, clean);
    else localStorage.removeItem(CALLSIGN_KEY);
    return clean;
}

export function stampLocalSave() {
    localStorage.setItem(STAMP_KEY, String(Date.now()));
}

// Pull before Game.init() reads localStorage. Newer copy wins.
export async function pullCloudSave() {
    const callsign = getCallsign();
    if (!callsign) return false;
    try {
        const res = await fetch(`./api/save/${callsign}`, { cache: 'no-store' });
        if (!res.ok) return false;
        const doc = await res.json();
        if (!doc || typeof doc.data !== 'object') return false;

        const localStamp = Number(localStorage.getItem(STAMP_KEY) || 0);
        if (doc.updatedAt <= localStamp) return false; // local is newer

        for (const key of SYNCED_KEYS) {
            if (typeof doc.data[key] === 'string') localStorage.setItem(key, doc.data[key]);
        }
        localStorage.setItem(STAMP_KEY, String(doc.updatedAt));
        console.log(`Cloud save loaded for "${callsign}"`);
        return true;
    } catch {
        return false; // static host / offline — play on
    }
}

let pushTimer = null;

// Debounced push (saves fire on every dock/purchase).
export function pushCloudSave() {
    const callsign = getCallsign();
    if (!callsign) return;
    stampLocalSave();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
        const data = {};
        for (const key of SYNCED_KEYS) {
            const v = localStorage.getItem(key);
            if (v !== null) data[key] = v;
        }
        try {
            await fetch(`./api/save/${callsign}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
        } catch { /* offline — next save retries */ }
    }, 1200);
}
