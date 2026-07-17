// VoiceEngine — text-to-speech for the film.
//
// Primary: Microsoft Edge neural TTS over its public websocket endpoint
// (the same service the edge-tts tooling uses). Each utterance opens a
// short-lived socket, streams back MP3 chunks, and plays them.
//
// Fallbacks, in order:
//   1. Direct wss:// connection to the Edge endpoint
//   2. Vite dev-server proxy at /edge-tts (helps when the browser's
//      Origin header gets the direct connection refused)
//   3. Browser speechSynthesis (always available, robotic but reliable)
//   4. Silence (subtitles still carry the film)

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_HOST = 'speech.platform.bing.com';
const EDGE_PATH = '/consumer/speech/synthesize/readaloud/edge/v1';
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const VOICE_PREF_STORAGE = 'sst_voice_mode'; // 'edge' | 'browser' | 'off'

function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    ).replace(/-/g, '');
}

// Edge requires a Sec-MS-GEC token: SHA-256 of (windows-file-time ticks
// rounded down to a 5 minute window + trusted client token), upper hex.
async function generateSecMsGec() {
    const WIN_EPOCH = 11644473600; // seconds between 1601-01-01 and 1970-01-01
    let s = Math.floor(Date.now() / 1000) + WIN_EPOCH;
    s -= s % 300;
    const ticks = BigInt(s) * 10000000n;
    const input = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export class VoiceEngine {
    constructor() {
        this.mode = localStorage.getItem(VOICE_PREF_STORAGE) || 'edge';
        this.edgeBroken = false; // set true after a hard failure; we stop retrying
        this.currentAudio = null;
        this.currentUtterance = null;
        this.muted = false;
    }

    setMode(mode) {
        this.mode = mode;
        localStorage.setItem(VOICE_PREF_STORAGE, mode);
        if (mode === 'edge') this.edgeBroken = false;
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        if (this.currentUtterance) {
            speechSynthesis.cancel();
            this.currentUtterance = null;
        }
    }

    // Speak `text` in `voice` (an Edge neural voice name). Resolves when
    // playback finishes. Never rejects — a silent failure returns quickly
    // so subtitles keep pacing the film.
    async speak(text, voice, { rate = '+0%', pitch = '+0Hz' } = {}) {
        if (this.mode === 'off' || this.muted || !text) return;

        if (this.mode === 'edge' && !this.edgeBroken) {
            const played = await this.speakEdge(text, voice, rate, pitch);
            if (played) return;
            // Hard fallback for the rest of the session
            this.edgeBroken = true;
            console.warn('Edge TTS unavailable — falling back to browser speechSynthesis');
        }

        await this.speakBrowser(text, voice);
    }

    // ---------- Edge TTS ----------
    async speakEdge(text, voice, rate, pitch) {
        const urls = await this.candidateUrls();
        for (const url of urls) {
            try {
                const mp3 = await this.fetchEdgeAudio(url, text, voice, rate, pitch);
                if (mp3 && mp3.size > 0) {
                    await this.playBlob(mp3);
                    return true;
                }
            } catch (e) {
                // try next candidate
            }
        }
        return false;
    }

    async candidateUrls() {
        const gec = await generateSecMsGec();
        const params = `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
            `&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${uuid()}`;
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return [
            `wss://${EDGE_HOST}${EDGE_PATH}${params}`,
            // Vite dev proxy fallback (see vite.config.js)
            `${proto}://${location.host}/edge-tts${EDGE_PATH}${params}`,
        ];
    }

    fetchEdgeAudio(url, text, voice, rate, pitch) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            const chunks = [];
            const timeout = setTimeout(() => { ws.close(); reject(new Error('TTS timeout')); }, 12000);

            ws.onopen = () => {
                const ts = new Date().toString();
                ws.send(
                    `X-Timestamp:${ts}\r\n` +
                    `Content-Type:application/json; charset=utf-8\r\n` +
                    `Path:speech.config\r\n\r\n` +
                    JSON.stringify({
                        context: {
                            synthesis: {
                                audio: {
                                    metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                                    outputFormat: OUTPUT_FORMAT,
                                },
                            },
                        },
                    })
                );

                const ssml =
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
                    `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>` +
                    escapeXml(text) +
                    `</prosody></voice></speak>`;

                ws.send(
                    `X-RequestId:${uuid()}\r\n` +
                    `Content-Type:application/ssml+xml\r\n` +
                    `X-Timestamp:${ts}\r\n` +
                    `Path:ssml\r\n\r\n` +
                    ssml
                );
            };

            ws.onmessage = (ev) => {
                if (typeof ev.data === 'string') {
                    if (ev.data.includes('Path:turn.end')) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve(new Blob(chunks, { type: 'audio/mpeg' }));
                    }
                } else {
                    // Binary frame: 2-byte big-endian header length, header, payload
                    const view = new DataView(ev.data);
                    const headerLen = view.getUint16(0);
                    const header = new TextDecoder().decode(ev.data.slice(2, 2 + headerLen));
                    if (header.includes('Path:audio')) {
                        chunks.push(ev.data.slice(2 + headerLen));
                    }
                }
            };

            ws.onerror = () => { clearTimeout(timeout); reject(new Error('TTS socket error')); };
            ws.onclose = () => { clearTimeout(timeout); };
        });
    }

    playBlob(blob) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            this.currentAudio = audio;
            audio.volume = 0.9;
            const done = () => {
                URL.revokeObjectURL(url);
                if (this.currentAudio === audio) this.currentAudio = null;
                resolve();
            };
            audio.onended = done;
            audio.onerror = done;
            audio.play().catch(done);
        });
    }

    // ---------- Browser speechSynthesis fallback ----------
    speakBrowser(text, edgeVoiceName) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) return resolve();

            const utter = new SpeechSynthesisUtterance(text);
            const voices = speechSynthesis.getVoices();
            if (voices.length) {
                // Deterministic per-character voice from the edge voice name
                let hash = 0;
                for (const ch of edgeVoiceName || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
                const english = voices.filter(v => v.lang.startsWith('en'));
                const pool = english.length ? english : voices;
                utter.voice = pool[hash % pool.length];
                utter.pitch = 0.8 + (hash % 5) * 0.1;
                utter.rate = 0.95 + (hash % 3) * 0.05;
            }
            utter.onend = () => { this.currentUtterance = null; resolve(); };
            utter.onerror = () => { this.currentUtterance = null; resolve(); };
            this.currentUtterance = utter;
            speechSynthesis.speak(utter);

            // Safety: some browsers never fire onend
            setTimeout(resolve, 1000 + text.length * 90);
        });
    }
}
