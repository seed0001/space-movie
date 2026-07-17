// OpenRouterClient — thin browser client for the OpenRouter chat API.
// The key and model are configured on the mode-select screen and kept
// in localStorage. When no key is present, callers fall back to the
// built-in procedural script generator.

const KEY_STORAGE = 'sst_openrouter_key';
const MODEL_STORAGE = 'sst_openrouter_model';
const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

export class OpenRouterClient {
    constructor() {
        this.apiKey = localStorage.getItem(KEY_STORAGE) || '';
        this.model = localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
        this.lastError = null;
    }

    setKey(key) {
        this.apiKey = (key || '').trim();
        localStorage.setItem(KEY_STORAGE, this.apiKey);
    }

    setModel(model) {
        this.model = (model || '').trim() || DEFAULT_MODEL;
        localStorage.setItem(MODEL_STORAGE, this.model);
    }

    isConfigured() {
        return this.apiKey.length > 0;
    }

    // messages: [{role, content}]. Returns the assistant text, or null on failure.
    async chat(messages, { temperature = 1.0, maxTokens = 4000, retries = 1 } = {}) {
        if (!this.isConfigured()) return null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/seed0001/space-movie',
                        'X-Title': 'Solar System Trader — Movie Mode',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages,
                        temperature,
                        max_tokens: maxTokens,
                    }),
                });

                if (!res.ok) {
                    this.lastError = `OpenRouter HTTP ${res.status}`;
                    // 401/403 won't improve on retry
                    if (res.status === 401 || res.status === 403) return null;
                    continue;
                }

                const data = await res.json();
                const text = data?.choices?.[0]?.message?.content;
                if (text) {
                    this.lastError = null;
                    return text;
                }
                this.lastError = 'Empty completion';
            } catch (e) {
                this.lastError = e.message;
            }
        }
        console.warn('OpenRouter request failed:', this.lastError);
        return null;
    }

    // Ask for JSON and parse it defensively (models love code fences).
    async chatJSON(messages, opts = {}) {
        const text = await this.chat(messages, opts);
        if (!text) return null;
        return parseLooseJSON(text);
    }
}

export function parseLooseJSON(text) {
    // Strip markdown fences if present
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();

    // Fall back to outermost braces
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first === -1 || last === -1) return null;
    t = t.slice(first, last + 1);

    try {
        return JSON.parse(t);
    } catch (e) {
        // Common LLM slip: trailing commas
        try {
            return JSON.parse(t.replace(/,\s*([}\]])/g, '$1'));
        } catch (e2) {
            console.warn('Failed to parse scene JSON:', e2.message);
            return null;
        }
    }
}
