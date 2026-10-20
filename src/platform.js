import { bytes, buildRequest, LIMITS, normalizeStore, parseReply } from './core.js';

export const PREFIX = 'englishbuddy/v1';
export const INDEX_KEY = `${PREFIX}/index`;
export const PHRASES_KEY = `${PREFIX}/phrases`;
export const chatKey = id => `${PREFIX}/chats/${id}`;
const LOCAL_KEY = 'englishbuddy:standalone:v1';

export function unwrap(response) {
  let value = response;
  for (let depth = 0; depth < 3; depth++) {
    if (value?.ok === false || value?.success === false) {
      const error = new Error(value.error?.message || value.error || 'Anna request failed');
      error.code = value.error?.code;
      throw error;
    }
    if (value && typeof value === 'object' && 'result' in value) value = value.result;
    else return value;
  }
  return value;
}

export class Platform {
  constructor(anna = null) {
    this.anna = anna;
    this.mode = anna ? 'anna' : 'device';
    this.etags = new Map();
    this.fingerprints = new Map();
    this.persistedIds = new Set();
    this.queue = Promise.resolve();
  }

  async connect() {
    const hosted = window.parent !== window || new URLSearchParams(location.search).has('wid');
    if (!hosted) return this;
    const { AnnaAppRuntime } = await import('/static/anna-apps/_sdk/latest/index.js');
    let timer;
    try {
      this.anna = await Promise.race([AnnaAppRuntime.connect(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Anna connection timed out')), 12000); })]);
    } finally { clearTimeout(timer); }
    this.mode = 'anna';
    await this.anna.window.set_title({ title: 'EnglishBuddy' });
    await this.anna.window.ready({});
    return this;
  }

  async read(key) {
    const result = unwrap(await this.anna.storage.get({ key }, { timeoutMs: 12000 }));
    if (result?.etag) this.etags.set(key, result.etag);
    const value = result?.exists === false ? null : result?.value ?? null;
    if (value !== null) this.fingerprints.set(key, JSON.stringify(value));
    return value;
  }

  async load() {
    if (!this.anna) {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      return normalizeStore(raw, { recoverInterrupted: true });
    }
    const index = await this.read(INDEX_KEY);
    if (!index) return normalizeStore();
    if (index.version !== 1 || !Array.isArray(index.conversationIds) || index.conversationIds.length > LIMITS.conversations) throw new Error('Saved practice format is not supported.');
    if (!index.conversationIds.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error('Saved chat references are invalid.');
    const conversations = [];
    for (let offset = 0; offset < index.conversationIds.length; offset += 4) {
      const batch = await Promise.all(index.conversationIds.slice(offset, offset + 4).map(id => this.read(chatKey(id))));
      if (batch.some(item => !item)) throw new Error('A saved conversation could not be loaded. Retry before making changes.');
      conversations.push(...batch);
    }
    const phrases = await this.read(PHRASES_KEY) || [];
    this.persistedIds = new Set(index.conversationIds);
    return normalizeStore({ ...index, conversations, phrases }, { recoverInterrupted: true });
  }

  save(store) {
    const snapshot = normalizeStore(structuredClone(store));
    const operation = this.queue.catch(() => {}).then(() => this.saveSnapshot(snapshot));
    this.queue = operation;
    return operation;
  }

  async write(key, value) {
    const serialized = JSON.stringify(value);
    if (this.fingerprints.get(key) === serialized) return;
    if (bytes(value) > LIMITS.recordBytes) throw new Error('This conversation is full. Export it and start a new chat.');
    const etag = this.etags.get(key);
    const result = unwrap(await this.anna.storage.set({ key, value, ...(etag ? { if_match: etag } : {}) }, { timeoutMs: 12000 }));
    if (result?.etag) this.etags.set(key, result.etag);
    this.fingerprints.set(key, serialized);
  }

  async saveSnapshot(store) {
    if (store.conversations.length > LIMITS.conversations) throw new Error('Your chat history is full. Remove a chat before starting another.');
    if (!this.anna) { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); return; }
    for (const conversation of store.conversations) await this.write(chatKey(conversation.id), conversation);
    await this.write(PHRASES_KEY, store.phrases);
    const ids = new Set(store.conversations.map(item => item.id));
    await this.write(INDEX_KEY, { version: 1, settings: store.settings, activeId: store.activeId, conversationIds: [...ids] });
    for (const id of this.persistedIds) {
      if (ids.has(id)) continue;
      const key = chatKey(id);
      unwrap(await this.anna.storage.delete({ key, ...(this.etags.has(key) ? { if_match: this.etags.get(key) } : {}) }, { timeoutMs: 12000 }));
      this.etags.delete(key);
      this.fingerprints.delete(key);
    }
    this.persistedIds = ids;
  }

  async reply(conversation, settings) {
    if (!this.anna?.llm?.complete) throw new Error('standalone');
    const latest = conversation.messages.filter(message => message.role === 'user').at(-1)?.text || '';
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = unwrap(await this.anna.llm.complete(buildRequest(conversation, settings, attempt === 1), { timeoutMs: 65000 }));
        const text = typeof result?.content?.text === 'string' ? result.content.text : typeof result?.text === 'string' ? result.text : '';
        if (!text.trim()) throw new Error('empty_reply');
        return parseReply(text, latest, settings);
      } catch (error) {
        lastError = error;
        if (!/reply_format|empty_reply/.test(error?.message || '')) break;
      }
    }
    throw lastError;
  }
}
