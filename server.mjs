// Production server for Railway (or any Node host).
//
// Serves the built game plus three small services the browser can't do alone:
//   1. /edge-tts/*   — websocket proxy to Microsoft's Edge TTS endpoint
//                      (browsers get refused on the Origin header; we strip it)
//   2. /api/chat     — OpenRouter proxy using a server-side key (env var), so
//                      players without their own key still get live generation
//   3. /api/save/*   — tiny JSON save store for cross-device cloud saves;
//                      point DATA_DIR at a mounted volume to persist it
//
// Env:
//   PORT               (Railway sets this)
//   OPENROUTER_API_KEY optional shared key for /api/chat
//   OPENROUTER_MODEL   optional default model (default: anthropic/claude-haiku-4.5)
//   DATA_DIR           save directory, default ./saves — mount your volume here

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'saves');
const OR_KEY = process.env.OPENROUTER_API_KEY || '';
const OR_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- Static: built app + runtime-fetched folders ----------
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- AI status + proxy ----------
app.get('/api/ai-status', (req, res) => {
    res.json({ serverKey: Boolean(OR_KEY), model: OR_MODEL });
});

app.post('/api/chat', async (req, res) => {
    if (!OR_KEY) return res.status(503).json({ error: 'No server-side OpenRouter key configured' });

    // Forward only the fields the game legitimately uses
    const { messages, temperature, max_tokens, model } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OR_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/seed0001/space-movie',
                'X-Title': 'Solar System Trader — Movie Mode',
            },
            body: JSON.stringify({
                model: typeof model === 'string' && model ? model : OR_MODEL,
                messages,
                temperature: typeof temperature === 'number' ? temperature : 1.0,
                max_tokens: typeof max_tokens === 'number' ? max_tokens : 4000,
            }),
        });
        const body = await upstream.text();
        res.status(upstream.status).type('application/json').send(body);
    } catch (e) {
        res.status(502).json({ error: `Upstream failure: ${e.message}` });
    }
});

// ---------- Cloud saves ----------
// One JSON document per slot ("callsign"). Last write wins.
function slotPath(slot) {
    const clean = String(slot).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (!clean) return null;
    return path.join(DATA_DIR, `${clean}.json`);
}

app.get('/api/save/:slot', async (req, res) => {
    const file = slotPath(req.params.slot);
    if (!file) return res.status(400).json({ error: 'bad slot' });
    try {
        const raw = await fs.readFile(file, 'utf8');
        res.type('application/json').send(raw);
    } catch {
        res.status(404).json({ error: 'no save' });
    }
});

app.put('/api/save/:slot', async (req, res) => {
    const file = slotPath(req.params.slot);
    if (!file) return res.status(400).json({ error: 'bad slot' });
    const data = req.body?.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data object required' });
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const doc = { updatedAt: Date.now(), data };
        await fs.writeFile(file, JSON.stringify(doc));
        res.json({ ok: true, updatedAt: doc.updatedAt });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- SPA fallback ----------
app.get(/^\/(?!api\/|edge-tts\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ---------- Edge TTS websocket proxy ----------
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/edge-tts/')) {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, (client) => {
        const upstreamUrl = 'wss://speech.platform.bing.com' + req.url.slice('/edge-tts'.length);
        const upstream = new WebSocket(upstreamUrl, {
            headers: {
                // The service accepts the Edge extension origin; browser origins get 403
                'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
            },
        });

        const pending = [];
        upstream.on('open', () => {
            for (const [msg, isBinary] of pending) upstream.send(msg, { binary: isBinary });
            pending.length = 0;
        });
        client.on('message', (msg, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) upstream.send(msg, { binary: isBinary });
            else if (upstream.readyState === WebSocket.CONNECTING) pending.push([msg, isBinary]);
        });
        upstream.on('message', (msg, isBinary) => {
            if (client.readyState === WebSocket.OPEN) client.send(msg, { binary: isBinary });
        });

        const closeBoth = () => { try { client.close(); } catch { } try { upstream.close(); } catch { } };
        client.on('close', closeBoth);
        client.on('error', closeBoth);
        upstream.on('close', closeBoth);
        upstream.on('error', closeBoth);
    });
});

server.listen(PORT, () => {
    console.log(`Solar System Trader serving on :${PORT}`);
    console.log(`  saves:      ${DATA_DIR}`);
    console.log(`  server key: ${OR_KEY ? 'configured (' + OR_MODEL + ')' : 'none — players supply their own'}`);
});
