import { addPhrase, canSend, cleanText, comparable, createConversation, escapeHtml as esc, friendlyError, LEVELS, LIMITS, normalizeStore, STARTERS, TOPICS, uid } from './core.js';
import { Platform } from './platform.js';
import { icon } from './icons.js';

const root = document.getElementById('app');
const state = { store: normalizeStore(), fresh: null, platform: new Platform(), loading: true, loadError: '', saveError: '', busy: false, saves: 0, error: '', view: 'chat', modal: '', draft: '', query: '', undo: null };
let toastTimer;
const active = () => state.fresh || state.store.conversations.find(item => item.id === state.store.activeId);
const hasPractice = conversation => conversation?.messages.some(message => message.role === 'user');
const currentDate = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const isSaved = phrase => state.store.phrases.some(item => comparable(item.text) === comparable(phrase?.text));
const disabled = value => value ? 'disabled' : '';
const busyOrLoading = () => state.busy || state.loading || Boolean(state.loadError);

function nav(mobile = false) {
  const conversations = state.store.conversations.filter(hasPractice).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `<div class="nav-body">
    <a class="brand" href="#chat" data-action="chat"><span class="brand-mark" aria-hidden="true">eb<span>.</span></span><span>englishbuddy<span class="brand-sub">A little practice, every day.</span></span></a>
    <button class="button primary new-chat" data-action="new" ${disabled(busyOrLoading())}>${icon('plus')} New conversation</button>
    <nav class="primary-nav" aria-label="Main navigation">
      <button data-action="chat" class="nav-item ${state.view === 'chat' ? 'selected' : ''}" ${state.view === 'chat' ? 'aria-current="page"' : ''}>${icon('chat')} Conversation</button>
      <button data-action="phrases" class="nav-item ${state.view === 'phrases' ? 'selected' : ''}" ${state.view === 'phrases' ? 'aria-current="page"' : ''}>${icon('book')} Phrasebook <span class="count">${state.store.phrases.length}</span></button>
    </nav>
    <div class="history-heading"><span class="eyebrow">Recent conversations</span><span class="history-count">${conversations.length ? `${conversations.length}/${LIMITS.conversations}` : ''}</span></div>
    <div class="history-list">${conversations.length ? conversations.map(item => `<div class="history-row ${item.id === state.store.activeId && state.view === 'chat' ? 'current' : ''}"><button class="history-item" data-action="open-chat" data-id="${item.id}" ${disabled(busyOrLoading())}><span class="history-title">${esc(item.title)}</span><span class="history-date">${currentDate(item.updatedAt)}</span></button></div>`).join('') : `<p class="history-empty">Your conversations will<br>find a home here.</p>`}</div>
    <div class="nav-bottom"><div class="small-note"><span class="note-spark" aria-hidden="true">*</span><p>You don’t need perfect English.<br>Just something to say.</p></div>
    <button class="nav-item settings-button" data-action="settings">${icon('settings')} Preferences</button>
    <div class="sync-status" data-sync><span class="status-dot"></span><span>${syncText()}</span></div></div>
    ${mobile ? `<button class="icon-button drawer-close" data-action="close-modal" aria-label="Close navigation">${icon('close')}</button>` : ''}
  </div>`;
}

function syncText() {
  if (state.loading) return 'Connecting to Anna…';
  if (state.loadError) return 'Connection needs attention';
  if (state.saveError) return 'Changes not saved';
  if (state.saves) return 'Saving your practice…';
  return state.platform.mode === 'anna' ? 'Saved to Anna' : 'Preview · on this device';
}

function toolbar() {
  return `<header class="toolbar"><div class="toolbar-start"><button class="icon-button mobile-only" data-action="history" aria-label="Open navigation">${icon('menu')}</button><div class="page-label">${icon(state.view === 'chat' ? 'chat' : 'book')}<span>${state.view === 'chat' ? 'Conversation' : 'Your phrasebook'}</span></div></div>
    <div class="toolbar-actions">${state.view === 'chat' ? `<span class="level-label">Comfort level</span><label class="sr-only" for="level">English level</label><select id="level" ${disabled(busyOrLoading())}>${Object.entries(LEVELS).map(([value, label]) => `<option value="${value}" ${state.store.settings.level === value ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="icon-button" data-action="chat-options" aria-label="Conversation options" ${disabled(busyOrLoading())}>${icon('more')}</button>` : `<span class="saved-count">${state.store.phrases.length} saved</span><button class="icon-button" data-action="chat" aria-label="Return to conversation">${icon('chat')}</button>`}</div></header>`;
}

function phraseAction(message) {
  if (!message.phrase) return '';
  const saved = isSaved(message.phrase);
  return `<div class="expression-row"><div><span class="expression-label">A useful expression</span><span class="expression-text">${esc(message.phrase.text)}</span></div><button class="save-expression ${saved ? 'is-saved' : ''}" data-action="save-phrase" data-mid="${message.id}" aria-label="${saved ? 'Saved expression' : 'Save expression'}: ${esc(message.phrase.text)}" aria-pressed="${saved}">${icon(saved ? 'check' : 'bookmark')}<span>${saved ? 'Saved' : 'Save'}</span></button></div>`;
}

function messageView(message) {
  const user = message.role === 'user';
  return `<article class="message ${user ? 'user-message' : 'buddy-message'}" data-message="${message.id}" aria-label="${user ? 'You' : 'Buddy'}">
    ${user ? '' : `<span class="buddy-avatar" aria-hidden="true">b<span>.</span></span>`}
    <div class="message-content"><div class="message-meta"><span>${user ? 'You' : 'Buddy'}</span><time datetime="${message.createdAt}">${new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
    <div class="message-text">${esc(message.text)}</div>
    ${!user && message.correction ? `<details class="language-note"><summary>${icon('note')} A small language note <span>+</span></summary><div class="language-note-body"><p class="original">${esc(message.correction.original)}</p><p class="improved">${icon('arrowRight')}${esc(message.correction.better)}</p><p>${esc(message.correction.reason)}</p></div></details>` : ''}
    ${!user ? phraseAction(message) : ''}
    ${user && message.status === 'failed' ? `<div class="reply-error" role="alert"><p>${esc(state.error || 'This reply was interrupted. Your message is saved; try again when you’re ready.')}</p><div><button class="text-button" data-action="retry" ${disabled(state.busy)}>${icon('retry')} Retry reply</button><button class="text-button muted" data-action="edit-failed" ${disabled(state.busy)}>Edit message</button></div></div>` : ''}
    </div></article>`;
}

function chatView() {
  const conversation = active();
  const empty = !hasPractice(conversation);
  const failed = conversation?.messages.at(-1)?.status === 'failed';
  const full = conversation && !canSend(conversation);
  const unavailable = busyOrLoading() || failed || full || state.platform.mode !== 'anna';
  const heading = conversation?.practicePhrase ? 'Let’s try that expression.' : conversation?.topic === 'everyday' ? 'Let’s talk about your day.' : TOPICS[conversation?.topic]?.name || 'Let’s talk.';
  return `<main id="workspace" class="chat-workspace" tabindex="-1"><div class="conversation-intro"><div><p class="eyebrow">A space to find your words</p><h1>${esc(heading)}</h1><p>Real conversation. Gentle feedback. Your own pace.</p></div><span class="conversation-emblem" aria-hidden="true">${icon('chat')}</span></div>
    <div class="chat-log" id="chat-log" role="log" aria-label="Conversation with Buddy" aria-live="polite" aria-relevant="additions text"><div class="message-list">${conversation?.messages.map(messageView).join('') || ''}
    ${state.busy ? `<div class="pending-message" role="status"><span class="buddy-avatar" aria-hidden="true">b<span>.</span></span><div><span>Buddy is thinking</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>` : ''}
    ${empty ? `<div class="situations"><p>Pick a message to send, or write your own</p><div>${Object.entries(STARTERS).map(([key, item]) => `<button data-action="starter" data-starter="${key}" aria-label="Send: ${esc(item.label)}" ${disabled(busyOrLoading() || state.platform.mode !== 'anna')}>${icon(item.icon)} ${item.label}${icon('arrowRight')}</button>`).join('')}</div></div>` : ''}</div></div>
    <div class="composer-wrap">${state.platform.mode !== 'anna' && !state.loading && !state.loadError ? `<p class="preview-notice">You’re viewing a preview. Open EnglishBuddy in Anna to start chatting.</p>` : ''}${full ? `<p class="preview-notice">This conversation is full. Start a new conversation to keep practising; this one stays in your history.</p>` : ''}
    <form id="composer" class="composer"><label for="message" class="sr-only">Your message in English</label><textarea id="message" name="message" rows="1" maxlength="${LIMITS.input}" placeholder="Tell Buddy what’s on your mind…" aria-describedby="composer-help" ${disabled(unavailable)}>${esc(state.draft)}</textarea><button class="send-button" type="submit" aria-label="Send message" ${disabled(unavailable || !state.draft.trim())}>${icon('arrow')}</button></form>
    <div class="composer-footer" id="composer-help"><span>${state.busy ? 'Take a breath. Your reply is on its way.' : 'Mistakes are welcome here.'}</span><span class="keyboard-hint"><kbd>Enter</kbd> to send <span class="char-count" id="char-count">${state.draft.length}/${LIMITS.input}</span></span></div></div></main>`;
}

function notebook() {
  const messages = active()?.messages || [];
  const latestNote = messages.filter(message => message.correction).at(-1)?.correction;
  const latestPhrase = messages.filter(message => message.phrase).at(-1);
  const today = new Date().toDateString();
  const turns = state.store.conversations.flatMap(item => item.messages).filter(message => message.role === 'user' && message.status === 'complete' && new Date(message.createdAt).toDateString() === today).length;
  return `<aside class="notebook" aria-label="Your practice notebook"><div class="notebook-title">${icon('note')}<h2>Your notebook</h2></div><p class="notebook-caption">Little things to take with you.</p>
    <section class="notebook-section"><div class="section-label"><span class="small-dot sage"></span><h3>A little more natural</h3></div>${latestNote ? `<p class="note-original">${esc(latestNote.original)}</p><p class="note-better">${esc(latestNote.better)}</p><p class="note-explanation">${esc(latestNote.reason)}</p>` : `<div class="empty-notebook"><div class="notebook-lines" aria-hidden="true"><span></span><span></span><span></span></div><p>As we chat, a helpful language note will appear here.</p><span>One small improvement at a time.</span></div>`}</section>
    <section class="notebook-section"><div class="section-label">${icon('bookmark')}<h3>Words worth keeping</h3></div>${latestPhrase ? `<p class="notebook-phrase">“${esc(latestPhrase.phrase.text)}”</p><p class="note-explanation">${esc(latestPhrase.phrase.meaning)}</p><button class="button subtle full-width" data-action="save-phrase" data-mid="${latestPhrase.id}" aria-pressed="${isSaved(latestPhrase.phrase)}">${icon(isSaved(latestPhrase.phrase) ? 'check' : 'plus')}${isSaved(latestPhrase.phrase) ? 'Saved to phrasebook' : 'Keep this expression'}</button>` : `<p class="note-explanation">Found a phrase you like?<br>Save it from Buddy’s reply and make it your own.</p><button class="text-button" data-action="phrases">Open phrasebook ${icon('arrowRight')}</button>`}</section>
    <div class="practice-count"><div><span class="practice-number">${String(turns).padStart(2, '0')}</span><span>replies practised today</span></div><p>${turns ? 'You showed up. That’s a good start.' : 'Your next sentence is a good place to start.'}</p></div>
    <p class="notebook-footnote">A conversation partner, powered by Anna.</p></aside>`;
}

function phraseResults() {
  const query = comparable(state.query);
  const phrases = state.store.phrases.filter(item => comparable(`${item.text} ${item.meaning} ${item.example}`).includes(query));
  if (!phrases.length) return `<div class="phrase-empty"><span class="empty-book">${icon('book')}</span><h2>${query ? 'No matching expressions yet.' : 'Good words deserve a second conversation.'}</h2><p>${query ? 'Try another word or clear your search.' : 'Save an expression from Buddy’s reply. Find it here whenever you want to practise it again.'}</p><button class="button primary" data-action="${query ? 'clear-search' : 'chat'}">${query ? 'Clear search' : 'Back to conversation'}${icon('arrowRight')}</button></div>`;
  return `<p class="results-count" role="status">${phrases.length} ${phrases.length === 1 ? 'expression' : 'expressions'}${query ? ' found' : ' to make your own'}</p><div class="phrase-list">${phrases.map(item => `<article class="phrase-item"><div class="phrase-item-top"><span class="phrase-tag">EXPRESSION</span><button class="icon-button" data-action="remove-phrase" data-id="${item.id}" aria-label="Remove expression: ${esc(item.text)}">${icon('close')}</button></div><h2>${esc(item.text)}</h2><p>${esc(item.meaning)}</p>${item.example ? `<blockquote>${esc(item.example)}</blockquote>` : ''}<div class="phrase-item-bottom"><span>Saved ${currentDate(item.createdAt)}</span><button class="text-button" data-action="practice-phrase" data-id="${item.id}" ${disabled(busyOrLoading())}>Practise this ${icon('arrowRight')}</button></div></article>`).join('')}</div>`;
}

function phraseView() {
  return `<main id="workspace" class="phrase-workspace" tabindex="-1"><div class="phrase-heading"><p class="eyebrow">Your growing collection</p><h1>A few words, kept close.</h1><p>Useful expressions from your conversations. Ready for the next one.</p></div><label class="search-field">${icon('search')}<span class="sr-only">Search saved expressions</span><input id="phrase-search" type="search" placeholder="Find an expression…" value="${esc(state.query)}" maxlength="120"></label><div id="phrase-results">${phraseResults()}</div></main>`;
}

function modalView() {
  if (!state.modal) return '';
  if (state.modal === 'history') return `<dialog id="app-dialog" class="history-dialog" aria-label="Navigation and conversation history">${nav(true)}</dialog>`;
  const header = title => `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>`;
  let content;
  if (state.modal === 'settings') content = `${header('Make yourself comfortable.')}<p class="dialog-description">A couple of small choices. Change them anytime.</p><label class="setting-label" for="settings-level">English level</label><select id="settings-level" class="setting-select" ${disabled(busyOrLoading())}>${Object.entries(LEVELS).map(([value, label]) => `<option value="${value}" ${state.store.settings.level === value ? 'selected' : ''}>${label}</option>`).join('')}</select><p class="setting-hint">Beginner keeps it simple. Everyday feels natural. Confident adds a little nuance.</p><label class="toggle-setting"><span><strong>Gentle language notes</strong><small>One useful correction when you need it.</small></span><input id="corrections" type="checkbox" ${state.store.settings.corrections ? 'checked' : ''} ${disabled(busyOrLoading())}></label><div class="settings-export"><p>Your practice belongs to you.</p><button class="button subtle" data-action="export">${icon('download')} Export my practice</button></div><p class="settings-privacy">Chat text is sent to Anna’s AI when you request a reply. Your saved practice uses private Anna Storage. ${state.platform.mode === 'device' ? 'This standalone preview saves only on this device.' : ''}</p>`;
  else if (state.modal === 'delete-chat') content = `${header('Delete this conversation?')}<p class="dialog-description">“${esc(active()?.title)}” will be removed from your history. Expressions you saved will stay in your phrasebook.</p><div class="dialog-actions"><button class="button subtle" data-action="close-modal">Keep conversation</button><button class="button danger" data-action="delete-chat">Delete conversation</button></div>`;
  else content = `${header('This conversation')}<p class="dialog-description">${esc(active()?.title || 'Everyday chat')}</p><button class="menu-action" data-action="new">${icon('plus')} Start a new conversation</button><button class="menu-action" data-action="export">${icon('download')} Export all my practice</button><button class="menu-action danger-text" data-action="confirm-delete" ${disabled(!hasPractice(active()))}>${icon('trash')} Delete this conversation</button>`;
  return `<dialog id="app-dialog" class="app-dialog" aria-labelledby="dialog-title">${content}</dialog>`;
}

function render({ scroll = false, focus = false } = {}) {
  const oldLog = document.getElementById('chat-log');
  const oldTop = oldLog?.scrollTop || 0;
  const nearBottom = !oldLog || oldLog.scrollHeight - oldLog.scrollTop - oldLog.clientHeight < 100;
  root.innerHTML = `<a class="skip-link" href="#workspace">Skip to main content</a><div class="app-shell ${state.view === 'phrases' ? 'phrase-shell' : ''}"><aside class="sidebar" aria-label="Navigation and history">${nav()}</aside><div class="main-column">${toolbar()}<div id="connection-banner" class="connection-banner" ${state.loadError || state.saveError ? '' : 'hidden'} role="alert">${bannerText()}</div>${state.view === 'chat' ? chatView() : phraseView()}</div>${state.view === 'chat' ? notebook() : ''}</div>${modalView()}`;
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = scroll || nearBottom ? log.scrollHeight : oldTop;
  const dialog = document.getElementById('app-dialog');
  if (dialog) dialog.showModal();
  const textarea = document.getElementById('message');
  if (textarea) { resizeComposer(textarea); if (focus && !textarea.disabled) textarea.focus({ preventScroll: true }); }
}

function bannerText() {
  if (state.loadError) return `<span>Your saved practice could not be loaded. ${esc(friendlyError(state.loadError))}</span><button class="text-button" data-action="reconnect">Try again</button>`;
  if (state.saveError) return `<span>${/precondition|conflict/i.test(state.saveError) ? esc(friendlyError(state.saveError)) : 'Your latest changes haven’t saved yet. Keep this window open and try saving again.'}</span><button class="text-button" data-action="save">Retry save</button><button class="text-button" data-action="export">Export</button>`;
  return '';
}

function updateStatus() {
  document.querySelectorAll('[data-sync]').forEach(item => { item.innerHTML = `<span class="status-dot ${state.saveError || state.loadError ? 'warning' : ''}"></span><span>${syncText()}</span>`; });
  const banner = document.getElementById('connection-banner');
  if (banner) { banner.hidden = !(state.loadError || state.saveError); banner.innerHTML = bannerText(); }
}

async function save() {
  if (state.loadError || state.loading) return false;
  state.saves++;
  updateStatus();
  try { await state.platform.save(state.store); state.saveError = ''; return true; }
  catch (error) { state.saveError = String(error?.message || error); return false; }
  finally { state.saves--; updateStatus(); }
}

function toast(message, undo = null) {
  clearTimeout(toastTimer);
  state.undo = undo;
  const host = document.getElementById('toast');
  host.innerHTML = `<span>${esc(message)}</span>${undo ? '<button data-action="undo">Undo</button>' : ''}`;
  host.hidden = false;
  toastTimer = setTimeout(() => { host.hidden = true; state.undo = null; }, undo ? 30000 : 6500);
}

function startConversation(topic = 'everyday', phrase = null) {
  if (busyOrLoading()) return;
  state.fresh = createConversation(topic, phrase);
  state.store.activeId = '';
  state.view = 'chat'; state.modal = ''; state.draft = ''; state.error = '';
  render({ scroll: true, focus: true });
}

async function send(retry = false) {
  if (busyOrLoading() || state.platform.mode !== 'anna') return;
  const conversation = active();
  if (!conversation) return;
  let user;
  if (retry) {
    user = conversation.messages.at(-1);
    if (user?.role !== 'user' || user.status !== 'failed') return;
    user.status = 'pending';
  } else {
    if (conversation.messages.at(-1)?.status === 'failed' || !canSend(conversation)) return;
    const text = cleanText(state.draft, LIMITS.input);
    if (!text) return;
    if (state.fresh) {
      if (state.store.conversations.length >= LIMITS.conversations) { toast('Your history has 24 chats. Open a previous conversation and delete one to make room.'); return; }
      state.store.conversations.unshift(conversation);
      state.store.activeId = conversation.id;
      state.fresh = null;
    }
    if (!hasPractice(conversation) && !conversation.practicePhrase && conversation.topic === 'everyday') conversation.title = text.replace(/\s+/g, ' ').slice(0, 46);
    user = { id: uid(), role: 'user', text, status: 'pending', createdAt: new Date().toISOString() };
    conversation.messages.push(user);
    state.draft = '';
  }
  state.busy = true; state.error = ''; conversation.updatedAt = new Date().toISOString();
  render({ scroll: true });
  await save();
  try {
    const reply = await state.platform.reply(conversation, state.store.settings);
    user.status = 'complete';
    conversation.messages.push({ id: uid(), role: 'assistant', ...reply, source: 'anna', createdAt: new Date().toISOString() });
  } catch (error) { user.status = 'failed'; state.error = friendlyError(error); }
  finally {
    conversation.updatedAt = new Date().toISOString();
    await save();
    state.busy = false;
    render({ scroll: true, focus: matchMedia('(min-width: 700px)').matches });
  }
}

function exportPractice() {
  const payload = JSON.stringify({ app: 'EnglishBuddy', exportedAt: new Date().toISOString(), ...state.store }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `englishbuddy-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your practice export is ready.');
}

function resizeComposer(input) { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 148)}px`; }

document.addEventListener('submit', event => { if (event.target.id === 'composer') { event.preventDefault(); void send(); } });
document.addEventListener('keydown', event => { if (event.target.id === 'message' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); } });
document.addEventListener('input', event => {
  if (event.target.id === 'message') {
    state.draft = event.target.value;
    resizeComposer(event.target);
    document.getElementById('char-count').textContent = `${state.draft.length}/${LIMITS.input}`;
    document.querySelector('.send-button').disabled = !state.draft.trim() || busyOrLoading();
  }
  if (event.target.id === 'phrase-search') { state.query = event.target.value; document.getElementById('phrase-results').innerHTML = phraseResults(); }
});
document.addEventListener('change', event => {
  if (['level', 'settings-level'].includes(event.target.id) && LEVELS[event.target.value] && !busyOrLoading()) { state.store.settings.level = event.target.value; void save(); render(); }
  if (event.target.id === 'corrections' && !busyOrLoading()) { state.store.settings.corrections = event.target.checked; void save(); }
});
document.addEventListener('cancel', event => { if (event.target.id === 'app-dialog') { event.preventDefault(); state.modal = ''; render(); } }, true);
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  event.preventDefault();
  const action = target.dataset.action;
  if (action === 'chat' || action === 'phrases') { state.view = action === 'chat' ? 'chat' : 'phrases'; state.modal = ''; render(); }
  if (action === 'new') startConversation();
  if (action === 'starter' && !busyOrLoading()) {
    const starter = STARTERS[target.dataset.starter];
    if (starter && active() && !hasPractice(active())) { active().topic = starter.topic; if (starter.topic !== 'everyday') active().title = TOPICS[starter.topic].name; state.draft = starter.text; void send(); }
  }
  if (action === 'open-chat' && !busyOrLoading()) { state.fresh = null; state.store.activeId = target.dataset.id; state.view = 'chat'; state.modal = ''; state.draft = ''; state.error = ''; render({ scroll: true, focus: true }); void save(); }
  if (['settings', 'history', 'chat-options'].includes(action)) { state.modal = action; render(); }
  if (action === 'close-modal') { state.modal = ''; render(); }
  if (action === 'confirm-delete') { state.modal = 'delete-chat'; render(); }
  if (action === 'delete-chat' && !busyOrLoading()) {
    state.store.conversations = state.store.conversations.filter(item => item.id !== state.store.activeId);
    state.store.activeId = '';
    state.modal = ''; state.draft = '';
    startConversation(); void save();
    toast('Conversation deleted. Your saved expressions are still here.');
  }
  if (action === 'save-phrase') {
    const message = active()?.messages.find(item => item.id === target.dataset.mid);
    if (!message?.phrase) return;
    try { const result = addPhrase(state.store, message.phrase, active().id, message.id); void save(); render(); toast(result.added ? 'Expression saved to your phrasebook.' : 'This expression is already in your phrasebook.'); }
    catch (error) { toast(error.message); }
  }
  if (action === 'practice-phrase') { const phrase = state.store.phrases.find(item => item.id === target.dataset.id); if (phrase) startConversation('everyday', phrase); }
  if (action === 'remove-phrase') {
    const index = state.store.phrases.findIndex(item => item.id === target.dataset.id);
    if (index < 0) return;
    const [phrase] = state.store.phrases.splice(index, 1);
    void save(); render();
    toast('Expression removed.', { phrase, index });
  }
  if (action === 'undo' && state.undo) {
    const removed = state.undo;
    state.undo = null;
    if (!isSaved(removed.phrase)) state.store.phrases.splice(removed.index, 0, removed.phrase);
    void save(); render(); document.getElementById('toast').hidden = true;
  }
  if (action === 'clear-search') { state.query = ''; render(); document.getElementById('phrase-search')?.focus(); }
  if (action === 'retry') void send(true);
  if (action === 'edit-failed' && !busyOrLoading()) { const last = active()?.messages.at(-1); if (last?.status === 'failed') { state.draft = last.text; active().messages.pop(); state.error = ''; void save(); render({ focus: true }); } }
  if (action === 'save') void save();
  if (action === 'export') exportPractice();
  if (action === 'reconnect') void initialize();
});

async function initialize() {
  state.loading = true; state.loadError = ''; render();
  try {
    state.platform = await new Platform().connect();
    state.store = await state.platform.load();
    state.store.conversations = state.store.conversations.filter(hasPractice);
    state.store.activeId = '';
    state.fresh = createConversation();
    state.view = 'chat'; state.draft = ''; state.modal = '';
  } catch (error) { state.loadError = String(error?.message || error); }
  finally { state.loading = false; render(); }
}

void initialize();
