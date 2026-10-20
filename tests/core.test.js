import test from 'node:test';
import assert from 'node:assert/strict';
import { addPhrase, buildRequest, bytes, canSend, createConversation, escapeHtml, LIMITS, normalizeStore, parseReply } from '../src/core.js';
import { Platform, INDEX_KEY, PHRASES_KEY, chatKey, unwrap } from '../src/platform.js';

const settings = { level: 'everyday', corrections: true };
const answer = { reply: 'A walk can be a breath of fresh air. What did you enjoy?', correction: { original: 'Yesterday I go', better: 'Yesterday I went', reason: 'Use the past tense for yesterday.' }, phrase: { text: 'a breath of fresh air', meaning: 'A refreshing change.', example: 'A walk is a breath of fresh air.' } };
const learner = 'Yesterday I go to the park.';

test('corrections must quote the latest learner message, and can be turned off', () => {
  assert.equal(parseReply(JSON.stringify(answer), learner, settings).correction.better, 'Yesterday I went');
  assert.equal(parseReply(JSON.stringify(answer), 'I went to the park.', settings).correction, null);
  assert.equal(parseReply(JSON.stringify(answer), learner, { ...settings, corrections: false }).correction, null);
  assert.equal(parseReply(JSON.stringify({ ...answer, correction: { ...answer.correction, better: 'Yesterday I go' } }), learner, settings).correction, null);
});

test('malformed or absent replies fail explicitly, while fenced complete JSON is accepted', () => {
  for (const value of ['', 'hello', '[]', '{"reply":', '{"reply":{}}', '{"reply":""}']) assert.throws(() => parseReply(value, learner, settings), /reply_format/);
  assert.equal(parseReply('```json\n' + JSON.stringify(answer) + '\n```', learner, settings).text, answer.reply);
  assert.equal(parseReply(JSON.stringify({ ...answer, phrase: { ...answer.phrase, text: 'made up phrase' } }), learner, settings).phrase, null);
});

test('practice requests include recent conversational context and selected learner preferences', () => {
  const conversation = createConversation('cafe');
  conversation.messages.push({ id: crypto.randomUUID(), role: 'user', text: 'Can I have an iced coffee?', status: 'pending', createdAt: new Date().toISOString() });
  const request = buildRequest(conversation, { level: 'beginner', corrections: false });
  assert.match(request.systemPrompt, /A1–A2/);
  assert.match(request.systemPrompt, /barista/);
  assert.match(request.systemPrompt, /Always set correction to null/);
  assert.equal(request.messages.at(-1).content.text, 'Can I have an iced coffee?');
  assert.equal(request.messages[0].role, 'assistant');
  assert.ok(buildRequest(conversation, settings, true).maxTokens > request.maxTokens);
});

test('saved phrases deduplicate regardless of case and survive conversation deletion', () => {
  const store = normalizeStore();
  assert.equal(addPhrase(store, answer.phrase, 'source-chat', 'source-message').added, true);
  assert.equal(addPhrase(store, { ...answer.phrase, text: 'A BREATH OF FRESH AIR' }).added, false);
  assert.equal(store.phrases.length, 1);
  const restored = normalizeStore(store);
  assert.equal(restored.phrases[0].text, answer.phrase.text);
  assert.equal(restored.phrases[0].conversationId, 'source-chat');
});

test('interrupted requests become retryable after reload, while a pending save stays pending', () => {
  const conversation = createConversation();
  conversation.messages.push({ id: crypto.randomUUID(), role: 'user', text: learner, status: 'pending', createdAt: new Date().toISOString() });
  const raw = { settings, activeId: conversation.id, conversations: [conversation] };
  assert.equal(normalizeStore(raw).conversations[0].messages.at(-1).status, 'pending');
  assert.equal(normalizeStore(raw, { recoverInterrupted: true }).conversations[0].messages.at(-1).status, 'failed');
});

test('unsafe model text is escaped and invalid path identifiers never reach storage', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(normalizeStore({ conversations: [{ id: '../other-app', messages: [] }] }).conversations.length, 0);
});

test('conversation bounds prevent silent history truncation', () => {
  const conversation = createConversation();
  conversation.messages = Array.from({ length: LIMITS.messages - 1 }, (_, i) => ({ id: crypto.randomUUID(), role: 'user', text: `Message ${i}`, createdAt: new Date().toISOString() }));
  assert.equal(canSend(conversation), false);
  assert.equal(normalizeStore({ conversations: [conversation] }).conversations[0].messages.length, LIMITS.messages - 1);
});

function fakeAnna() {
  const records = new Map(), writes = [];
  let serial = 0;
  return {
    records, writes,
    storage: {
      async get({ key }) { const record = records.get(key); return record ? { exists: true, value: structuredClone(record.value), etag: record.etag } : { exists: false, value: null }; },
      async set({ key, value, if_match }) {
        if (if_match && records.get(key)?.etag !== if_match) throw new Error('precondition_failed');
        assert.ok(bytes(value) < 262144, `${key} exceeds storage limit`);
        await new Promise(resolve => setTimeout(resolve, 1));
        const etag = `etag-${++serial}`;
        records.set(key, { value: structuredClone(value), etag }); writes.push({ key, value: structuredClone(value) });
        return { etag };
      },
      async delete({ key }) { records.delete(key); return { deleted: true }; }
    }
  };
}

test('overlapping saves serialize and restore the newest conversation and phrasebook', async () => {
  const anna = fakeAnna(), platform = new Platform(anna), store = normalizeStore();
  const conversation = createConversation(); store.conversations = [conversation]; store.activeId = conversation.id;
  const first = platform.save(store);
  conversation.title = 'The latest title';
  addPhrase(store, answer.phrase, conversation.id, conversation.messages[0].id);
  const second = platform.save(store);
  await Promise.all([first, second]);
  const restored = await new Platform(anna).load();
  assert.equal(restored.conversations[0].title, 'The latest title');
  assert.equal(restored.phrases.length, 1);
  assert.equal(restored.activeId, conversation.id);
  const writeCount = anna.writes.length;
  await platform.save(store);
  assert.equal(anna.writes.length, writeCount, 'unchanged saves do not write again');
  store.conversations = []; store.activeId = '';
  await platform.save(store);
  assert.equal(anna.records.has(chatKey(conversation.id)), false);
  assert.equal(anna.records.get(PHRASES_KEY).value.length, 1);
});

test('conversations are sharded and each near-maximum Unicode record stays bounded', async () => {
  const anna = fakeAnna(), platform = new Platform(anna), store = normalizeStore();
  for (let i = 0; i < LIMITS.conversations; i++) {
    const conversation = createConversation();
    for (let j = 0; j < 25; j++) conversation.messages.push({ id: crypto.randomUUID(), role: 'user', text: '学'.repeat(1100), status: 'complete', createdAt: new Date().toISOString() });
    store.conversations.push(conversation);
  }
  store.activeId = store.conversations[0].id;
  await platform.save(store);
  assert.equal(anna.records.size, LIMITS.conversations + 2);
  assert.ok(bytes(anna.records.get(INDEX_KEY).value) < 10000);
  assert.equal((await new Platform(anna).load()).conversations.length, LIMITS.conversations);
});

test('a stale window cannot silently overwrite newer practice', async () => {
  const anna = fakeAnna(), first = new Platform(anna), store = normalizeStore();
  store.conversations = [createConversation()]; store.activeId = store.conversations[0].id;
  await first.save(store);
  const second = new Platform(anna), stale = await second.load();
  store.conversations[0].title = 'Updated in first window'; await first.save(store);
  stale.conversations[0].title = 'Stale overwrite';
  await assert.rejects(second.save(stale), /precondition_failed/);
  assert.equal((await new Platform(anna).load()).conversations[0].title, 'Updated in first window');
});

test('empty AI responses get one repair, and failed permissions are never retried blindly', async () => {
  let calls = 0;
  const platform = new Platform({ llm: { async complete() { calls++; return calls === 1 ? { content: { text: '' } } : { content: { text: JSON.stringify(answer) } }; } } });
  const conversation = createConversation(); conversation.messages.push({ role: 'user', text: learner });
  assert.equal((await platform.reply(conversation, settings)).text, answer.reply);
  assert.equal(calls, 2);
  calls = 0;
  const denied = new Platform({ llm: { async complete() { calls++; throw new Error('APP_NOT_GRANTED'); } } });
  await assert.rejects(denied.reply(conversation, settings), /APP_NOT_GRANTED/);
  assert.equal(calls, 1);
});

test('Host RPC envelopes preserve missing values and surface explicit failures', () => {
  assert.equal(unwrap({ ok: true, result: { exists: false, value: null } }).exists, false);
  assert.throws(() => unwrap({ ok: false, error: { code: 'not_granted', message: 'Permission missing' } }), /Permission missing/);
});
