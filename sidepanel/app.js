/* AutoFlow By Faizul Islam Rifat - side panel */
'use strict';

const FLOW_URL = 'https://flow.google.com/';
const SETTINGS_KEY = 'aws_settings';
const FORM_KEY = 'aws_form';
const CHARS_KEY = 'aws_scanned_characters';
const SELECTORS_KEY = 'aws_custom_selectors';
const VOICES_KEY = 'aws_scanned_voices';
const TEMPLATES_KEY = 'aws_saved_templates';
const HISTORY_KEY = 'aws_prompt_history';
const CHUNK = 1024 * 1024;

const DEFAULTS = {
  mode: 'textToVideo',
  agentType: 'agentAutomationToImage',
  aspectRatio: '16:9',
  outputCount: 2,
  agentOutputCount: 2,
  concurrentPrompts: 1,
  promptDelaySecondsMin: 0,
  promptDelaySecondsMax: 20,
  model: 'Veo 3.1 - Lite',
  imageModel: 'Nano Banana 2.1',
  defaultVideoOption: '8s',
  defaultImageOption: 'new-image',
  imageToVideoMaxImagesPerPrompt: 1,
  componentsToVideoMaxImagesPerPrompt: 3,
  imageToImageMaxImagesPerPrompt: 3,
  agentMaxImagesPerPrompt: 3,
  maxRetries: 1,
  autoDownloadVideoQuality: '720',
  autoDownloadImageQuality: '1k',
  autoAddCharacterImages: false,
  autoAddVoiceBySpeaker: false,
  defaultSpeaker: 'none',
  enableCharacterControl: false,
  defaultCharacters: [],
  autoChangeFileName: true,
  fileNamingSystem: 'prompt_tag',
  folderName: 'faizul-flow',
  zoomOutWhileRunning: true,
  enableDesktopNotification: true,
  enableAudioAlert: true,
  enableTelegram: false,
  telegramBotToken: '',
  telegramChatId: '',
  aiProvider: 'groq',
  groqApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  enableDiscord: false,
  discordWebhookUrl: '',
  autoHealRetry: true,
  retryDelaySeconds: 15,
  maxRetries: 2
};

let batchStartTime = null;
let batchTimer = null;

function formatDuration(sec) {
  if (sec == null || isNaN(sec) || sec < 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function updateLiveTimer() {
  if (!batchStartTime) return;
  const elapsedSec = Math.floor((Date.now() - batchStartTime) / 1000);
  const el = $('#queueTimeElapsed');
  if (el) el.textContent = `⏱️ Elapsed: ${formatDuration(elapsedSec)}`;
}

const IMAGE_MODELS = ['Nano Banana Pro', 'Nano Banana 2.1', 'Nano Banana 2.1 Light'];
const VIDEO_MODELS = ['Veo 3.1 - Lite', 'Veo 3.1 - Fast', 'Veo 3.1 - Quality', 'Omni 1.1 Flash'];

/* Built-in voice library: the 30 Gemini preset voices that Flow's voice picker is built on
 * ([name, gender, style]). Use "Sync voices from Flow" to replace / extend this list with
 * exactly what your Flow account shows (including custom voices you created). */
const BUILTIN_VOICES = [
  ['Achernar', 'Female', 'Soft'], ['Achird', 'Male', 'Friendly'], ['Algenib', 'Male', 'Gravelly'], ['Algieba', 'Male', 'Smooth'],
  ['Alnilam', 'Male', 'Firm'], ['Aoede', 'Female', 'Breezy'], ['Autonoe', 'Female', 'Bright'], ['Callirrhoe', 'Female', 'Easy-going'],
  ['Charon', 'Male', 'Informative'], ['Despina', 'Female', 'Smooth'], ['Enceladus', 'Male', 'Breathy'], ['Erinome', 'Female', 'Clear'],
  ['Fenrir', 'Male', 'Excitable'], ['Gacrux', 'Female', 'Mature'], ['Iapetus', 'Male', 'Clear'], ['Kore', 'Female', 'Firm'],
  ['Laomedeia', 'Female', 'Upbeat'], ['Leda', 'Female', 'Youthful'], ['Orus', 'Male', 'Firm'], ['Puck', 'Male', 'Upbeat'],
  ['Pulcherrima', 'Female', 'Forward'], ['Rasalgethi', 'Male', 'Informative'], ['Sadachbia', 'Male', 'Lively'], ['Sadaltager', 'Male', 'Knowledgeable'],
  ['Schedar', 'Male', 'Even'], ['Sulafat', 'Female', 'Warm'], ['Umbriel', 'Male', 'Easy-going'], ['Vindemiatrix', 'Female', 'Gentle'],
  ['Zephyr', 'Female', 'Bright'], ['Zubenelgenubi', 'Male', 'Casual']
];
let VOICES = BUILTIN_VOICES.slice();
let scannedVoices = [];
function mergeVoices() {
  const map = new Map(BUILTIN_VOICES.map((v) => [v[0].toLowerCase(), v]));
  scannedVoices.forEach((n) => { if (!map.has(n.toLowerCase())) map.set(n.toLowerCase(), [n, 'Flow', 'from your Flow']); });
  VOICES = Array.from(map.values()).sort((a, b) => a[0].localeCompare(b[0]));
}
const escRe = (s) => String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
// whole-word, case-insensitive (so "Kore" never matches "Korean", "Ali" never matches "Alice")
const hasWord = (text, word) => new RegExp(`(^|[^\\w])@?${escRe(word)}(?![\\w])`, 'i').test(text);

const MODE_INFO = {
  textToVideo: { video: true, images: false, voice: true, chars: true, hint: 'Write a description, Flow makes the full video.' },
  imageToVideo: { video: true, images: true, maxKey: 'imageToVideoMaxImagesPerPrompt', maxOpts: 2, voice: false, chars: true, hint: 'Each prompt animates its own start frame (1st image = prompt 1, 2nd = prompt 2...).' },
  componentsToVideo: { video: true, images: true, maxKey: 'componentsToVideoMaxImagesPerPrompt', maxOpts: 10, voice: true, chars: true, hint: 'Use images as ingredients (characters, objects, places) inside the video.' },
  textToImage: { video: false, images: false, voice: false, chars: true, hint: 'Generate images from text.' },
  imageToImage: { video: false, images: true, maxKey: 'imageToImageMaxImagesPerPrompt', maxOpts: 10, voice: false, chars: true, hint: 'Edit / transform your images with a prompt.' },
  agentAutomation: { video: null, images: true, maxKey: 'agentMaxImagesPerPrompt', maxOpts: 10, voice: true, chars: true, optionalImages: true, hint: 'Flow agent creates the images / videos for each prompt.' }
};

/* ---------------- state ---------------- */
let settings = { ...DEFAULTS };
let images = [];          // {id, name, base64, type}
let scannedChars = [];
let logs = [];
let unseenLogs = 0;
let activeGroupId = null;
let lastStatus = null;
let flowTabId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), isErr ? 6000 : 2600);
}

let savedTemplates = [];
let promptHistory = [];

function saveTemplates() { chrome.storage.local.set({ [TEMPLATES_KEY]: savedTemplates }); }
function saveHistory() { chrome.storage.local.set({ [HISTORY_KEY]: promptHistory }); }

/* ---------------- storage ---------------- */
async function loadAll() {
  const st = await chrome.storage.local.get([SETTINGS_KEY, FORM_KEY, CHARS_KEY, SELECTORS_KEY, VOICES_KEY, TEMPLATES_KEY, HISTORY_KEY]);
  settings = { ...DEFAULTS, ...(st[SETTINGS_KEY] || {}) };
  savedTemplates = Array.isArray(st[TEMPLATES_KEY]) ? st[TEMPLATES_KEY] : [];
  promptHistory = Array.isArray(st[HISTORY_KEY]) ? st[HISTORY_KEY] : [];
  if (!Array.isArray(settings.defaultCharacters)) settings.defaultCharacters = [];
  // migrate old image model values (v1.0.x) to the current Flow labels
  const IMG_MODEL_MIGRATE = {
    '🍌 Nano Banana Pro': 'Nano Banana Pro', '🍌 Nano Banana 2.1': 'Nano Banana 2.1', '🍌 Nano Banana 2': 'Nano Banana 2.1',
    '🍌 Nano Banana 2 Light': 'Nano Banana 2.1 Light', '🍌 Nano Banana 2 Lite': 'Nano Banana 2.1 Light', 'Nano Banana 2 Light': 'Nano Banana 2.1 Light'
  };
  if (IMG_MODEL_MIGRATE[settings.imageModel]) settings.imageModel = IMG_MODEL_MIGRATE[settings.imageModel];
  if (!IMAGE_MODELS.includes(settings.imageModel)) settings.imageModel = DEFAULTS.imageModel;
  const VID_MODEL_MIGRATE = { 'Veo 3.1 - Lite [Lower Priority]': 'Veo 3.1 - Lite', 'Omni Flash': 'Omni 1.1 Flash' };
  if (VID_MODEL_MIGRATE[settings.model]) settings.model = VID_MODEL_MIGRATE[settings.model];
  if (!VIDEO_MODELS.includes(settings.model)) settings.model = DEFAULTS.model;
  scannedChars = (Array.isArray(st[CHARS_KEY]) ? st[CHARS_KEY] : []).map((c) => String(c).replace(/^@+/, '').trim()).filter(Boolean);
  scannedVoices = Array.isArray(st[VOICES_KEY]) ? st[VOICES_KEY] : [];
  mergeVoices();
  const form = st[FORM_KEY] || {};
  $('#prompts').value = form.prompts || '';
  $('#customSelectors').value = st[SELECTORS_KEY] || '';
}
let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ [SETTINGS_KEY]: settings }), 150);
}
function saveForm() { chrome.storage.local.set({ [FORM_KEY]: { prompts: $('#prompts').value } }); }

/* ---------------- settings <-> form ---------------- */
function numeric(key) { return typeof DEFAULTS[key] === 'number'; }
function bindSettings() {
  $$('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    const v = settings[key];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : String(v);
    if (el.tagName === 'SELECT' && el.value !== String(v) && el.options.length) {
      // value no longer in list -> fall back to default
      el.value = String(DEFAULTS[key]);
      settings[key] = numeric(key) ? Number(el.value) : el.value;
    }
    if (el._bound) return;
    el._bound = true;
    el.addEventListener('change', () => {
      const key = el.dataset.setting;
      let val = el.type === 'checkbox' ? el.checked : el.value;
      if (numeric(key)) val = Number(val) || 0;
      settings[key] = val;
      if (key === 'promptDelaySecondsMax' && settings.promptDelaySecondsMax < settings.promptDelaySecondsMin) settings.promptDelaySecondsMin = settings.promptDelaySecondsMax;
      saveSettings();
      refreshUI();
    });
  });
}

/* ---------------- mode UI ---------------- */
function currentInfo() { return MODE_INFO[settings.mode] || MODE_INFO.textToVideo; }
function isVideoMode() {
  const info = currentInfo();
  if (settings.mode === 'agentAutomation') return settings.agentType === 'agentAutomationToVideo';
  return !!info.video;
}

function refreshUI() {
  const info = currentInfo();
  $$('#modes .chip').forEach((c) => c.classList.toggle('active', c.dataset.mode === settings.mode));
  $('#modeHint').textContent = info.hint;
  $('#agentTypeRow').classList.toggle('hidden', settings.mode !== 'agentAutomation');
  $$('#agentTypeRow .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.agent === settings.agentType));
  const video = isVideoMode();
  $$('.video-only').forEach((e) => e.classList.toggle('hidden', !video));
  $$('.image-only').forEach((e) => e.classList.toggle('hidden', video));
  $('#chainHint').classList.toggle('hidden', !(String(video ? settings.defaultVideoOption : settings.defaultImageOption).includes('concat')));
  $('#imagesCard').classList.toggle('hidden', !info.images);
  $('#voiceCard').classList.toggle('hidden', !(info.voice && (settings.mode !== 'agentAutomation' || video)));
  $('#charCard').classList.toggle('hidden', !info.chars);

  // output count selector shows agent count in agent mode
  const oc = $('#q_outputCount');
  oc.dataset.setting = settings.mode === 'agentAutomation' ? 'agentOutputCount' : 'outputCount';
  oc.value = String(settings[oc.dataset.setting]);

  // max images per prompt
  if (info.images) {
    const sel = $('#maxImagesPerPrompt');
    const cur = settings[info.maxKey] || 1;
    sel.innerHTML = '';
    for (let i = 1; i <= info.maxOpts; i++) sel.add(new Option(String(i), String(i)));
    sel.value = String(Math.min(cur, info.maxOpts));
    const omni = String(settings.model).toLowerCase().includes('omni');
    $('#imageInput').accept = (settings.mode === 'componentsToVideo' || settings.mode === 'agentAutomation') && omni ? 'image/*,video/*' : 'image/*';
  }
  $('#autoAddVoiceBySpeaker').checked = !!settings.autoAddVoiceBySpeaker;
  $('#defaultSpeaker').disabled = !!settings.autoAddVoiceBySpeaker;
  renderChars();
  renderThumbs();
  renderPrompts();
}

/* ---------------- prompts logic ---------------- */
const parsePrompts = (t) => (t ? t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) : []);
function promptOption(i, total) {
  const def = isVideoMode() ? settings.defaultVideoOption : settings.defaultImageOption;
  if (total > 0 && i === total - 1 && def.includes('-concat')) return def.split('-concat')[0];
  return def;
}
const isConcat = (i, total) => promptOption(i, total).includes('concat');
const isAfterConcat = (i, total) => i > 0 && isConcat(i - 1, total);
const stem = (n) => String(n || '').replace(/\.[^/.]+$/, '');

function imagesPerPrompt(prompts) {
  const info = currentInfo();
  if (!info.images || !images.length) return prompts.map(() => []);
  const max = Number(settings[info.maxKey] || 1);
  const out = [];
  let ptr = 0;
  for (let i = 0; i < prompts.length; i++) {
    if (isAfterConcat(i, prompts.length)) { out.push([]); continue; }
    const p = prompts[i].toLowerCase();
    let picked = [];
    if (settings.autoAddCharacterImages) {
      picked = images.filter((im) => { const s = stem(im.name).toLowerCase(); return s && p.includes(s); }).slice(0, max);
    } else if (settings.mode === 'imageToVideo') {
      // each prompt gets its own frame(s), in order
      picked = images.slice(ptr, ptr + max); ptr += max;
    } else {
      const n = Math.min(max, images.length);
      const seen = new Set();
      for (let k = 0; k < n; k++) { const im = images[ptr % images.length]; ptr++; if (!seen.has(im.id)) { seen.add(im.id); picked.push(im); } }
    }
    out.push(picked);
  }
  return out;
}
function speakerFor(prompt) {
  if (settings.autoAddVoiceBySpeaker) {
    // longest name first, whole word only
    const v = VOICES.slice().sort((a, b) => b[0].length - a[0].length).find(([n]) => hasWord(prompt, n));
    if (v) return v[0];
  }
  return settings.defaultSpeaker && settings.defaultSpeaker !== 'none' ? settings.defaultSpeaker : null;
}
/* Characters for a prompt:
 * - "@Name" of a scanned character is ALWAYS picked (with or without auto mode)
 * - auto mode ON: plain "Name" (no @) is picked too, and unknown "@Word" is tried as a character
 * - characters clicked in the panel are always added */
function charactersFor(prompt) {
  const found = [];
  const add = (c) => { if (c && !found.some((x) => x.toLowerCase() === c.toLowerCase())) found.push(c); };
  const byLen = scannedChars.slice().sort((a, b) => b.length - a.length);
  // longest names first; a matched name is blanked out so "@Ali Khan" does not also add "Ali"
  let work = prompt;
  byLen.forEach((c) => {
    const re = new RegExp(`@${escRe(c)}(?![\\w])`, 'gi');
    if (re.test(work)) { add(c); work = work.replace(re, ' '); }
  });
  if (settings.enableCharacterControl) {
    byLen.forEach((c) => {
      const re = new RegExp(`(^|[^\\w@])${escRe(c)}(?![\\w])`, 'gi');
      if (re.test(work)) { add(c); work = work.replace(re, '$1 '); }
    });
    const isVoice = (w) => VOICES.some(([n]) => n.toLowerCase() === w.toLowerCase());
    (prompt.match(/(^|\s)@([A-Za-z0-9_][\w-]{0,39})/g) || []).forEach((m) => { const w = m.trim().slice(1); if (!isVoice(w) && !found.some((x) => w.toLowerCase().startsWith(x.toLowerCase()))) add(w); });
  }
  settings.defaultCharacters.forEach(add);
  return found.length ? found : null;
}

function renderPrompts() {
  const prompts = parsePrompts($('#prompts').value);
  $('#promptCount').textContent = `${prompts.length}`;
  const from = $('#rangeFrom'), to = $('#rangeTo');
  from.max = to.max = Math.max(1, prompts.length);
  if (Number(to.value) > prompts.length || Number(to.value) < 1 || to._auto !== false) to.value = Math.max(1, prompts.length);
  if (Number(from.value) > prompts.length) from.value = 1;
  const info = currentInfo();
  const per = imagesPerPrompt(prompts);
  const list = $('#promptList');
  list.innerHTML = '';
  prompts.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'p-row';
    row.dataset.idx = String(i + 1);
    const tags = [];
    if (info.images && per[i] && per[i].length) tags.push(`<span class="tag img">${per[i].length} img: ${per[i].map((x) => escapeHtml(stem(x.name))).join(', ')}</span>`);
    if (info.images && !info.optionalImages && !isAfterConcat(i, prompts.length) && (!per[i] || !per[i].length)) tags.push('<span class="tag err">no image</span>');
    if (isAfterConcat(i, prompts.length)) tags.push('<span class="tag chain">uses previous result</span>');
    if (info.voice && (settings.mode !== 'agentAutomation' || isVideoMode())) { const sp = speakerFor(p); if (sp) tags.push(`<span class="tag voice">voice: ${sp}</span>`); }
    const ch = charactersFor(p); if (ch) tags.push(`<span class="tag char">@${ch.map(escapeHtml).join(', @')}</span>`);
    row.innerHTML = `<div class="p-num">${i + 1}</div><div class="p-body"><div class="p-text" title="${escapeHtml(p)}">${escapeHtml(p)}</div><div class="p-meta">${tags.join('')}</div></div>`;
    list.appendChild(row);
  });
  if (lastStatus) applyStatusToRows(lastStatus);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- images ---------------- */
function readFile(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
async function addFiles(files) {
  for (const f of files) {
    if (!/^image\/|^video\//.test(f.type)) continue;
    const base64 = await readFile(f);
    images.push({ id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, base64, type: f.type });
  }
  refreshUI();
}
function renderThumbs() {
  const box = $('#thumbs');
  box.innerHTML = '';
  $('#imgCount').textContent = images.length ? `(${images.length})` : '';
  images.forEach((im) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.innerHTML = (im.type.startsWith('video/') ? `<video src="${im.base64}" muted></video>` : `<img src="${im.base64}" alt="">`) +
      `<span class="nm" title="${escapeHtml(im.name)}">${escapeHtml(im.name)}</span><button class="x" title="Remove">&times;</button>`;
    d.querySelector('.x').addEventListener('click', () => { images = images.filter((x) => x.id !== im.id); refreshUI(); });
    box.appendChild(d);
  });
}

/* ---------------- characters ---------------- */
function renderChars() {
  const box = $('#charList');
  box.innerHTML = '';
  if (!scannedChars.length) { box.innerHTML = '<span class="muted small">No characters scanned yet. Open a Flow project and press Scan.</span>'; return; }
  scannedChars.forEach((c) => {
    const b = document.createElement('span');
    b.className = 'char' + (settings.defaultCharacters.includes(c) ? ' active' : '');
    b.textContent = '@' + c;
    b.title = settings.enableCharacterControl ? 'Auto mode: added when its name is in the prompt' : 'Click to always add this character';
    b.addEventListener('click', () => {
      if (settings.enableCharacterControl) return;
      const i = settings.defaultCharacters.indexOf(c);
      if (i >= 0) settings.defaultCharacters.splice(i, 1); else settings.defaultCharacters.push(c);
      saveSettings(); refreshUI();
    });
    box.appendChild(b);
  });
}

/* ---------------- Flow tab connection ---------------- */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0];
}
const isFlowUrl = (u) => !!u && (u.includes('flow.google.com') || u.includes('labs.google/fx'));
function sendToTab(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      const le = chrome.runtime.lastError;
      if (le) reject(new Error(/Receiving end|establish connection/i.test(le.message || '') ? 'Flow page is not connected. Reload the Google Flow tab (F5) and try again.' : le.message));
      else resolve(res);
    });
  });
}
async function checkPage() {
  const tab = await getActiveTab();
  const box = $('#pageStatus'), txt = $('#pageStatusText'), btn = $('#openFlowBtn');
  if (tab && isFlowUrl(tab.url)) {
    flowTabId = tab.id;
    try {
      await sendToTab(tab.id, { type: 'PING' });
      box.classList.add('on'); box.classList.remove('off');
      txt.textContent = 'Connected to Google Flow';
      btn.classList.add('hidden');
      sendToTab(tab.id, { type: 'GET_QUEUE_STATE' }).catch(() => {});
    } catch (e) {
      box.classList.remove('on'); box.classList.add('off');
      txt.textContent = 'Flow tab found but not connected';
      btn.textContent = 'Reload Flow tab'; btn.dataset.act = 'reload'; btn.classList.remove('hidden');
    }
  } else {
    flowTabId = null;
    box.classList.remove('on'); box.classList.add('off');
    txt.textContent = 'Open Google Flow in this tab to start';
    btn.textContent = 'Open Google Flow'; btn.dataset.act = 'open'; btn.classList.remove('hidden');
  }
}

/* ---------------- start / stop ---------------- */
async function sendImages(tabId, list) {
  for (const im of list) {
    const data = { base64: im.base64, name: im.name };
    const json = JSON.stringify(data);
    const total = Math.ceil(json.length / CHUNK);
    if (total <= 1) await sendToTab(tabId, { type: 'PREPARE_IMAGE', id: im.id, data });
    else for (let k = 0; k < total; k++) await sendToTab(tabId, { type: 'PREPARE_IMAGE_CHUNK', id: im.id, chunk: json.slice(k * CHUNK, (k + 1) * CHUNK), chunkIndex: k, totalChunks: total });
  }
}

async function start() {
  const prompts = parsePrompts($('#prompts').value);
  if (!prompts.length) return toast('Add at least one prompt first.', true);
  const tab = await getActiveTab();
  if (!tab || !isFlowUrl(tab.url)) return toast('Open Google Flow (flow.google.com) in the current tab first.', true);

  const info = currentInfo();
  const total = prompts.length;
  const anyConcat = prompts.some((_, i) => isConcat(i, total));
  const per = imagesPerPrompt(prompts);
  const mode = settings.mode === 'agentAutomation' ? settings.agentType : settings.mode;
  const video = isVideoMode();

  if (info.images && !info.optionalImages) {
    const missing = prompts.map((_, i) => (!isAfterConcat(i, total) && (!per[i] || !per[i].length) ? i + 1 : null)).filter(Boolean);
    const allowNoImg = settings.mode === 'componentsToVideo' && (settings.enableCharacterControl || settings.defaultCharacters.length);
    if (missing.length && !allowNoImg) return toast(`These prompts have no image: ${missing.join(', ')}. Add images (or name them like words in the prompt).`, true);
  }

  const outputCount = anyConcat ? 1 : Number(settings.mode === 'agentAutomation' ? settings.agentOutputCount : settings.outputCount);
  const concurrent = anyConcat || settings.mode === 'agentAutomation' ? 1 : Number(settings.concurrentPrompts);
  const payloads = prompts.map((p, i) => ({
    prompt: p,
    mode,
    images: info.images ? per[i] : [],
    speaker: info.voice && (settings.mode !== 'agentAutomation' || video) ? speakerFor(p) : null,
    characters: charactersFor(p),
    aspectRatio: settings.aspectRatio,
    outputCount,
    model: video ? settings.model : settings.imageModel,
    videoOption: video ? promptOption(i, total) : undefined,
    promptIndex: i + 1,
    autoDownloadResourceQuality: video ? settings.autoDownloadVideoQuality : settings.autoDownloadImageQuality,
    isConcat: isConcat(i, total),
    maxRetries: Number(settings.maxRetries || 2),
    autoHealRetry: settings.autoHealRetry !== false,
    retryDelaySeconds: Number(settings.retryDelaySeconds || 15),
    autoChangeFileName: !!settings.autoChangeFileName,
    fileNamingSystem: settings.fileNamingSystem || 'prompt_tag',
    folderName: settings.folderName
  }));

  const from = Math.max(1, Number($('#rangeFrom').value) || 1);
  const to = Math.min(total, Number($('#rangeTo').value) || total);
  if (from > to) return toast('Range is wrong: "Run from" must be smaller than "to".', true);
  const slice = payloads.slice(from - 1, to);

  // send images once, refer to them by id
  const used = new Map();
  const finalPayloads = slice.map((p) => {
    const ids = (p.images || []).map((im) => { used.set(im.id, im); return im.id; });
    const { images: _drop, ...rest } = p;
    return ids.length ? { ...rest, imageIds: ids } : rest;
  });

  $('#startBtn').disabled = true;
  try {
    await sendImages(tab.id, Array.from(used.values()));
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await sendToTab(tab.id, {
      type: 'AUTO_FILL_FLOW', payloads: finalPayloads, groupId,
      concurrentPrompts: concurrent, promptDelaySecondsMin: Number(settings.promptDelaySecondsMin), promptDelaySecondsMax: Number(settings.promptDelaySecondsMax)
    });
    if (!res || !res.success) throw new Error((res && res.error) || 'Could not start');
    activeGroupId = res.groupId || groupId;
    lastStatus = null;
    batchStartTime = Date.now();
    if (batchTimer) clearInterval(batchTimer);
    batchTimer = setInterval(updateLiveTimer, 1000);
    $('#batchAnalyticsCard')?.classList.add('hidden');
    if ($('#queueTimeElapsed')) $('#queueTimeElapsed').textContent = '⏱️ Elapsed: 00:00';
    if ($('#queueEta')) $('#queueEta').textContent = '⏳ ETA: Calculating...';
    $$('.p-row').forEach((r) => r.classList.remove('done', 'fail', 'running'));
    addPromptToHistory($('#prompts').value);
    toast(`Started ${finalPayloads.length} prompt(s). Keep the Flow tab open.`);
    $('#stopBtn').classList.remove('hidden');
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    $('#startBtn').disabled = false;
  }
}

async function stop() {
  if (!activeGroupId) return;
  const tab = await getActiveTab();
  const tabId = (tab && isFlowUrl(tab.url)) ? tab.id : flowTabId;
  if (!tabId) return toast('Flow tab not found', true);
  try { await sendToTab(tabId, { type: 'CANCEL_PROMPT_GROUP', groupId: activeGroupId }); toast('Stopping after the current step...'); }
  catch (e) { toast(e.message, true); }
}

/* ---------------- status from the Flow tab ---------------- */
function applyStatusToRows(d) {
  const map = {};
  (d.results || []).forEach((r) => { map[r.promptIndex] = r; });
  const running = d.currentPromptIndex != null && d.promptIndices ? d.promptIndices[d.currentPromptIndex] : null;
  $$('.p-row').forEach((row) => {
    const n = Number(row.dataset.idx);
    if (!d.promptIndices || !d.promptIndices.includes(n)) return;
    row.classList.remove('done', 'fail', 'running');
    const r = map[n];
    if (r) { if (r.success && r.downloadComplete) row.classList.add('done'); else if (!r.success) row.classList.add('fail'); else row.classList.add('running'); }
    if (running === n) row.classList.add('running');
  });
}
function playAudioChime() {
  if (settings.enableAudioAlert === false) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const playTone = (freq, time, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    };
    playTone(523.25, now, 0.25);
    playTone(659.25, now + 0.12, 0.25);
    playTone(783.99, now + 0.24, 0.45);
  } catch (e) {}
}

function onGroupStatus(d) {
  if (!d) return;
  if (activeGroupId && d.id !== activeGroupId && d.status !== 'running') return;
  activeGroupId = d.id;
  lastStatus = d;
  $('#queueEmpty').classList.add('hidden');
  $('#queueBox').classList.remove('hidden');
  const done = (d.results || []).filter((r) => r.downloadComplete || !r.success).length;
  const pct = d.totalCount ? Math.round((done / d.totalCount) * 100) : 0;
  $('#queueBar').style.width = pct + '%';
  $('#queueCount').textContent = `${done}/${d.totalCount} prompts`;
  const labels = { queued: 'Queued', running: d.isCancelling ? 'Stopping...' : 'Running', completed: 'Completed', cancelled: 'Stopped', error: 'Error' };
  $('#queueStatus').textContent = labels[d.status] || d.status;
  if (d.currentPromptIndex != null && d.promptPreviews) $('#currentLine').textContent = `Now: #${d.promptIndices[d.currentPromptIndex]} ${d.promptPreviews[d.currentPromptIndex]}`;
  // Calculate live ETA
  if (batchStartTime && d.totalCount > 0) {
    const elapsedSec = Math.max(1, (Date.now() - batchStartTime) / 1000);
    const etaEl = $('#queueEta');
    if (done > 0 && done < d.totalCount) {
      const avgSecPerPrompt = elapsedSec / done;
      const remainingPrompts = d.totalCount - done;
      const etaSeconds = Math.ceil(remainingPrompts * avgSecPerPrompt);
      if (etaEl) etaEl.textContent = `⏳ ETA: ~${formatDuration(etaSeconds)}`;
    } else if (done >= d.totalCount) {
      if (etaEl) etaEl.textContent = '🏁 Finished';
    } else {
      if (etaEl) etaEl.textContent = '⏳ ETA: Calculating...';
    }
  }

  const finished = ['completed', 'cancelled', 'error'].includes(d.status);
  $('#stopBtn').classList.toggle('hidden', finished);
  if (finished) {
    if (batchTimer) { clearInterval(batchTimer); batchTimer = null; }
    const totalDurationSec = batchStartTime ? Math.round((Date.now() - batchStartTime) / 1000) : 0;
    const succ = (d.results || []).filter((r) => r.success).length;
    const tot = d.totalCount || (d.results && d.results.length) || 0;
    const avgSpeed = tot > 0 && totalDurationSec > 0 ? (totalDurationSec / tot).toFixed(1) : '0';

    $('#currentLine').textContent = d.status === 'completed' ? `Done: ${succ} OK, ${tot - succ} failed` : '-';
    $('#currentPct').textContent = '';
    
    // Show Batch Analytics Summary Card
    const analyticsCard = $('#batchAnalyticsCard');
    if (analyticsCard) {
      analyticsCard.classList.remove('hidden');
      $('#statTotal').textContent = String(tot);
      $('#statSuccess').textContent = `${succ}/${tot} (${tot ? Math.round((succ / tot) * 100) : 0}%)`;
      $('#statDuration').textContent = formatDuration(totalDurationSec);
      $('#statAvg').textContent = `${avgSpeed}s / item`;
    }
    batchStartTime = null;

    if (d.status === 'completed') {
      playAudioChime();
      toast('All prompts finished. Check Analytics!');
    }
  }
  applyStatusToRows(d);
}

/* ---------------- logs ---------------- */
function addLog(e) {
  logs.push(e);
  if (logs.length > 800) logs = logs.slice(-800);
  const box = $('#logs');
  const div = document.createElement('div');
  div.className = 'log ' + (e.level || 'info');
  div.innerHTML = `<span class="t">${new Date(e.timestamp || Date.now()).toLocaleTimeString()}</span>${escapeHtml(e.message || '')}`;
  box.appendChild(div);
  while (box.childNodes.length > 800) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
  if (!$('#tab-logs').classList.contains('active')) {
    unseenLogs++;
    const b = $('#logBadge'); b.textContent = String(Math.min(unseenLogs, 99)); b.classList.remove('hidden');
  }
}

/* ---------------- Voice Preview (Audio Sampling) ---------------- */
function previewVoice() {
  const cur = settings.defaultSpeaker;
  if (!cur || cur === 'none') return toast('Select a voice from the dropdown first', true);
  
  const voiceMeta = VOICES.find(([n]) => n === cur);
  const gender = voiceMeta ? voiceMeta[1] : 'Flow';
  const style = voiceMeta ? voiceMeta[2] : '';
  
  toast(`Playing demo preview for ${cur}...`);
  
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    }
  } catch (e) {}

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const demoPhrases = [
      `Hello! I am ${cur}. Ready to narrate your Google Flow video.`,
      `Greetings! ${cur} here. Let us create an amazing cinematic video together.`,
      `Hi, this is ${cur}. Your prompt is ready for synthesis.`
    ];
    const phrase = demoPhrases[Math.floor(Math.random() * demoPhrases.length)];
    const u = new SpeechSynthesisUtterance(phrase);
    
    if (gender === 'Female') {
      u.pitch = style.includes('Bright') || style.includes('Youthful') ? 1.25 : 1.15;
      u.rate = style.includes('Breezy') || style.includes('Upbeat') ? 1.05 : 0.96;
    } else if (gender === 'Male') {
      u.pitch = style.includes('Gravelly') || style.includes('Firm') ? 0.82 : 0.92;
      u.rate = style.includes('Casual') || style.includes('Lively') ? 1.04 : 0.96;
    } else {
      u.pitch = 1.0;
      u.rate = 1.0;
    }
    
    const available = window.speechSynthesis.getVoices();
    if (available && available.length) {
      const match = available.find(v => (gender === 'Female' ? /female|zira|samantha|karen|victoria/i.test(v.name) : /male|david|george|alex/i.test(v.name)) && v.lang.startsWith('en'));
      if (match) u.voice = match;
    }
    window.speechSynthesis.speak(u);
  }
}

/* ---------------- Prompt Library & Templates ---------------- */
function renderTemplatesList() {
  const box = $('#templatesList');
  if (!box) return;
  box.innerHTML = '';
  if (!savedTemplates.length) {
    box.innerHTML = '<span class="muted small" style="padding:6px 0;">No templates saved yet. Write prompts and click "Save Current".</span>';
    return;
  }
  savedTemplates.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.innerHTML = `
      <span class="lib-item-title" title="${escapeHtml(t.text)}">â­ ${escapeHtml(t.title || 'Template #' + (i + 1))}</span>
      <span class="lib-item-time">${t.promptsCount || 1} prompt(s)</span>
      <button class="lib-item-del" title="Delete template">&times;</button>
    `;
    item.querySelector('.lib-item-title').addEventListener('click', () => {
      $('#prompts').value = t.text;
      saveForm();
      renderPrompts();
      toast(`Loaded template: ${t.title || 'Template #' + (i + 1)}`);
      $('#promptLibraryDrawer').classList.add('hidden');
    });
    item.querySelector('.lib-item-del').addEventListener('click', (e) => {
      e.stopPropagation();
      savedTemplates.splice(i, 1);
      saveTemplates();
      renderTemplatesList();
      toast('Template removed.');
    });
    box.appendChild(item);
  });
}

function renderHistoryList() {
  const box = $('#historyList');
  if (!box) return;
  box.innerHTML = '';
  if (!promptHistory.length) {
    box.innerHTML = '<span class="muted small" style="padding:6px 0;">No recent history. Prompts will appear here when you start a batch.</span>';
    return;
  }
  promptHistory.forEach((h, i) => {
    const item = document.createElement('div');
    item.className = 'lib-item';
    const dateStr = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.innerHTML = `
      <span class="lib-item-title" title="${escapeHtml(h.text)}">ðŸ•’ ${escapeHtml(h.preview || h.text.substring(0, 50))}</span>
      <span class="lib-item-time">${dateStr}</span>
      <button class="lib-item-del" title="Remove from history">&times;</button>
    `;
    item.querySelector('.lib-item-title').addEventListener('click', () => {
      $('#prompts').value = h.text;
      saveForm();
      renderPrompts();
      toast('Loaded from history');
      $('#promptLibraryDrawer').classList.add('hidden');
    });
    item.querySelector('.lib-item-del').addEventListener('click', (e) => {
      e.stopPropagation();
      promptHistory.splice(i, 1);
      saveHistory();
      renderHistoryList();
    });
    box.appendChild(item);
  });
}

function addPromptToHistory(text) {
  if (!text || !text.trim()) return;
  const clean = text.trim();
  promptHistory = promptHistory.filter(h => h.text !== clean);
  const firstLine = clean.split('\n')[0].replace(/^#\S+\s*/, '').substring(0, 55);
  promptHistory.unshift({
    text: clean,
    preview: firstLine || clean.substring(0, 55),
    time: Date.now()
  });
  if (promptHistory.length > 20) promptHistory = promptHistory.slice(0, 20);
  saveHistory();
  renderHistoryList();
}

function fillVoiceSelect() {
  const sp = $('#defaultSpeaker');
  const cur = settings.defaultSpeaker;
  sp.innerHTML = '';
  sp.add(new Option('None', 'none'));
  VOICES.forEach(([n, g, style]) => sp.add(new Option(g === 'Flow' ? `${n} (from Flow)` : `${n} (${g}, ${style})`, n)));
  sp.value = VOICES.some(([n]) => n === cur) ? cur : 'none';
  if (sp.value !== cur) { settings.defaultSpeaker = sp.value; saveSettings(); }
  const vc = $('#voiceCount');
  if (vc) vc.textContent = `${VOICES.length} voices${scannedVoices.length ? ` (${scannedVoices.length} synced from Flow)` : ' (built-in)'}`;
}

const PRESET_STYLES = {
  cinematic: 'cinematic 4k resolution, anamorphic lens flare, photorealistic lighting, 35mm film grain, masterpiece',
  cyberpunk: 'cyberpunk aesthetics, volumetric neon lighting, rain-slicked reflective surfaces, futuristic neon cyan and magenta',
  drone: 'breathtaking aerial drone footage, sweeping wide-angle view, smooth majestic motion, golden hour sunlight',
  anime: 'makoto shinkai style, vibrant vivid colors, emotive atmosphere, studio ghibli lighting, gorgeous 4k anime render',
  macro: 'extreme macro photography, shallow depth of field, incredible fine details, clean studio softbox lighting',
  action: 'high-speed cinematic action, dramatic dynamic motion blur, intense slow-motion 120fps, epic blockbuster movie shot',
  fantasy: 'epic high fantasy world, magical volumetric mist, ethereal golden illumination, unreal engine 5 hyper-detailed render',
  scifi: 'interstellar deep space odyssey, futuristic mega-structure, volumetric raytracing, sleek holographic interfaces'
};

function applyPreset(presetKey) {
  const addition = PRESET_STYLES[presetKey];
  if (!addition) return;
  const area = $('#prompts');
  const text = area.value.trim();
  if (!text) {
    area.value = addition;
  } else {
    const parts = text.split('\n\n');
    const updated = parts.map((p) => (p.trim() ? `${p.trim()}, ${addition}` : p)).join('\n\n');
    area.value = updated;
  }
  saveForm();
  renderPrompts();
  toast(`Applied ${presetKey.toUpperCase()} preset!`);
}

async function expandStoryToScenes(idea, count = 5) {
  const provider = ($('#aiDrawerProvider') && $('#aiDrawerProvider').value) || settings.aiProvider || 'groq';
  const sysPrompt = `You are an expert AI video director. Break down the user's story or idea into exactly ${count} sequential video prompt scenes for AI video generation (Veo/Google Flow).
Each prompt must start with a tag format like "#0:00 [Scene description]", "#0:04 [Scene description]", "#0:08 [Scene description]" with 4-second intervals.
Describe camera movement, lighting, subject action clearly.
Output ONLY the raw prompts separated by exactly one blank line. Do NOT output markdown code blocks, numbers, or bullet points.`;

  // 1. GROQ (Llama 3.3 70B - Free, Global, No VPN needed)
  if (provider === 'groq') {
    const key = (settings.groqApiKey || '').trim();
    if (key) {
      try {
        toast('Generating with Groq Llama 3...');
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: `Story Idea: ${idea}` }
            ],
            temperature: 0.7
          })
        });
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) return content.trim();
        if (data.error) toast('Groq API: ' + (data.error.message || 'Error'), true);
      } catch (e) {
        toast('Groq call failed, using built-in generator', true);
      }
    } else {
      toast('Groq key not set in Settings - using built-in generator', true);
    }
  }

  // 2. OPENAI (ChatGPT / GPT-4o-mini)
  else if (provider === 'openai') {
    const key = (settings.openaiApiKey || '').trim();
    if (key) {
      try {
        toast('Generating with OpenAI ChatGPT...');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: `Story Idea: ${idea}` }
            ],
            temperature: 0.7
          })
        });
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) return content.trim();
        if (data.error) toast('OpenAI: ' + (data.error.message || 'Error'), true);
      } catch (e) {
        toast('OpenAI call failed, using built-in generator', true);
      }
    } else {
      toast('OpenAI key not set in Settings - using built-in generator', true);
    }
  }

  // 3. GEMINI
  else if (provider === 'gemini') {
    const key = (settings.geminiApiKey || '').trim();
    if (key) {
      try {
        toast('Generating with Gemini AI...');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${sysPrompt}\n\nUser Idea: ${idea}` }] }]
          })
        });
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw && raw.trim()) return raw.trim();
        if (data.error) toast('Gemini: ' + (data.error.message || 'Location not supported'), true);
      } catch (e) {
        toast('Gemini call failed, using built-in generator', true);
      }
    } else {
      toast('Gemini key not set in Settings - using built-in generator', true);
    }
  }

  // 4. BUILT-IN FALLBACK (Always works offline)
  toast('Using Built-in Cinematic Sequencer...');
  const cleanIdea = idea.trim().replace(/[.]+$/, '');
  const shotTypes = [
    { tag: '#0:00', prefix: 'Cinematic wide establishing shot of', motion: 'slow aerial push-in, majestic ambient lighting' },
    { tag: '#0:04', prefix: 'Medium tracking shot featuring', motion: 'camera dynamically following movement, dramatic lighting' },
    { tag: '#0:08', prefix: 'Intense close-up view of', motion: 'shallow depth of field, vivid atmospheric particles and reflections' },
    { tag: '#0:12', prefix: 'High-energy climax sequence with', motion: 'fast dynamic camera sweep, cinematic motion blur, epic climax' },
    { tag: '#0:16', prefix: 'Majestic wide concluding shot of', motion: 'smooth pull-back, gorgeous golden volumetric lighting, cinematic resolution' },
    { tag: '#0:20', prefix: 'Nighttime panoramic scene revealing', motion: 'smooth low-angle glide, neon reflections' },
    { tag: '#0:24', prefix: 'Hero perspective shot capturing', motion: '360 orbit camera rotation, hyper-detailed focus' },
    { tag: '#0:28', prefix: 'Epic aerial perspective over', motion: 'sweeping drone flyover, cinematic sunset rays' },
    { tag: '#0:32', prefix: 'Slow motion 120fps artistic capture of', motion: 'time dilation, ultra-sharp detail' },
    { tag: '#0:36', prefix: 'Grand finale shot of', motion: 'epic fading panorama, cinematic masterpiece' }
  ];

  const scenes = [];
  for (let i = 0; i < Math.min(count, shotTypes.length); i++) {
    const s = shotTypes[i];
    scenes.push(`${s.tag} ${s.prefix} ${cleanIdea}, ${s.motion}, 4k ultra-detailed cinematic render`);
  }
  return scenes.join('\n\n');
}

/* ---------------- Magic Prompt Enhancer (1-Click Hollywood Polish) ---------------- */
async function magicEnhancePrompts() {
  const area = $('#prompts');
  const text = area.value.trim();
  if (!text) return toast('Please enter a prompt first to enhance it', true);

  const btn = $('#magicEnhanceBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enhancing...';
  }

  const sysPrompt = `You are a world-class Hollywood AI Director and Cinematographer specializing in Google Veo and cinematic video generation.
Take the user prompt(s) and enhance each one into a visually stunning, production-quality video scene.
For each scene, enhance lighting (e.g. volumetric god-rays, atmospheric haze, cyan-gold contrast), camera movement (e.g. dynamic low-angle tracking, sweeping 35mm lens pan, smooth orbit), realistic physics, textures, and depth of field.
Preserve any existing '#tag' or '@character' or '(Voice)' at the start of each prompt verbatim.
Keep each prompt concise (under 40 words), highly visual, and direct.
Output ONLY the final enhanced prompts separated by a blank line, without explanations, numbers, quotes, or markdown code blocks.`;

  const provider = settings.aiProvider || 'groq';
  let enhanced = null;

  try {
    if (provider === 'groq' && (settings.groqApiKey || '').trim()) {
      toast('Enhancing with Groq Llama 3...');
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.groqApiKey.trim()}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: text }],
          temperature: 0.65
        })
      });
      const data = await res.json();
      enhanced = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : null;
    } else if (provider === 'openai' && (settings.openaiApiKey || '').trim()) {
      toast('Enhancing with OpenAI...');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.openaiApiKey.trim()}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: text }],
          temperature: 0.65
        })
      });
      const data = await res.json();
      enhanced = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : null;
    } else if (provider === 'gemini' && (settings.geminiApiKey || '').trim()) {
      toast('Enhancing with Google Gemini...');
      const key = settings.geminiApiKey.trim();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${sysPrompt}\n\nUser Prompts:\n${text}` }] }]
        })
      });
      const data = await res.json();
      enhanced = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text.trim() : null;
    }

    if (!enhanced) {
      toast('Applied Hollywood cinematic enhancement formula!');
      const blocks = text.split('\n\n');
      const cinematicFlavors = [
        'cinematic 35mm anamorphic shot, golden hour lighting, volumetric rays, shallow depth of field, 8k ultra-detailed realism',
        'dynamic tracking shot, dramatic high-contrast neon rim light, atmospheric mist, photorealistic reflections, smooth camera motion',
        'epic wide-angle dolly shot, soft diffused cinematic studio lighting, hyper-realistic textures, motion blur, 4k master',
        'low-angle slow tracking shot, volumetric atmospheric haze, award-winning cinematography, hyper-detailed natural physics'
      ];
      enhanced = blocks.map((b, i) => {
        const line = b.trim();
        if (!line) return '';
        const flavor = cinematicFlavors[i % cinematicFlavors.length];
        return `${line}, ${flavor}`;
      }).join('\n\n');
    }

    if (enhanced) {
      area.value = enhanced;
      saveForm();
      renderPrompts();
      toast('✨ Prompt enhanced to Hollywood Cinematic quality!');
    }
  } catch (e) {
    toast('Enhance failed: ' + e.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '&#10024; Enhance';
    }
  }
}

/* ---------------- CSV / Google Sheets Bulk Importer ---------------- */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function importCsvPrompts(csvContent) {
  if (!csvContent || !csvContent.trim()) return toast('CSV file is empty', true);
  const lines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (!lines.length) return toast('No data found in CSV', true);

  const firstRow = parseCsvLine(lines[0]);
  const headers = firstRow.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  let promptCol = -1, tagCol = -1, charCol = -1, voiceCol = -1;
  headers.forEach((h, idx) => {
    if (h.includes('prompt') || h.includes('text') || h.includes('scene') || h.includes('description')) promptCol = idx;
    else if (h.includes('tag') || h.includes('name') || h.includes('title') || h.includes('file')) tagCol = idx;
    else if (h.includes('char') || h.includes('actor') || h.includes('person')) charCol = idx;
    else if (h.includes('voice') || h.includes('speaker') || h.includes('audio')) voiceCol = idx;
  });

  const startIndex = promptCol >= 0 ? 1 : 0;
  if (promptCol === -1) promptCol = 0;

  const parsedPrompts = [];
  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length || !cols[promptCol]) continue;
    
    const promptText = cols[promptCol];
    const tag = tagCol >= 0 && cols[tagCol] ? cols[tagCol].replace(/^#/, '') : '';
    const char = charCol >= 0 && cols[charCol] ? cols[charCol].replace(/^@/, '') : '';
    const voice = voiceCol >= 0 && cols[voiceCol] ? cols[voiceCol] : '';

    let fullPrompt = promptText;
    if (voice && !fullPrompt.includes(`(${voice})`)) fullPrompt = `(${voice}) ${fullPrompt}`;
    if (char && !fullPrompt.includes(`@${char}`)) fullPrompt = `@${char} ${fullPrompt}`;
    if (tag && !fullPrompt.startsWith('#')) fullPrompt = `#${tag} ${fullPrompt}`;

    parsedPrompts.push(fullPrompt);
  }

  if (!parsedPrompts.length) return toast('No valid prompts extracted from CSV', true);

  const cur = $('#prompts').value.trim();
  const joined = parsedPrompts.join('\n\n');
  $('#prompts').value = cur ? `${cur}\n\n${joined}` : joined;
  saveForm();
  renderPrompts();
  toast(`📊 Successfully imported ${parsedPrompts.length} prompt(s) from CSV/Sheets!`);
}

/* ---------------- wiring ---------------- */
function wire() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + t.dataset.tab));
    if (t.dataset.tab === 'logs') { unseenLogs = 0; $('#logBadge').classList.add('hidden'); }
  }));
  $$('#modes .chip').forEach((c) => c.addEventListener('click', () => { settings.mode = c.dataset.mode; saveSettings(); refreshUI(); }));
  $$('#agentTypeRow .seg-btn').forEach((b) => b.addEventListener('click', () => { settings.agentType = b.dataset.agent; saveSettings(); refreshUI(); }));
  $('#maxImagesPerPrompt').addEventListener('change', (e) => { settings[currentInfo().maxKey] = Number(e.target.value); saveSettings(); refreshUI(); });

  fillVoiceSelect();
  $('#scanVoicesBtn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab || !isFlowUrl(tab.url)) return toast('Open a Google Flow project first.', true);
    $('#scanVoicesBtn').disabled = true;
    try {
      const r = await sendToTab(tab.id, { type: 'SCAN_VOICES' });
      const list = (r && r.voices) || [];
      if (!list.length) { toast('Could not read voices from Flow - built-in list kept.', true); return; }
      scannedVoices = Array.from(new Set(list.map((v) => String(v).trim()).filter(Boolean)));
      await chrome.storage.local.set({ [VOICES_KEY]: scannedVoices });
      mergeVoices(); fillVoiceSelect(); bindSettings(); refreshUI();
      toast(`Synced ${scannedVoices.length} voice(s) from Flow`);
    } catch (e) { toast(e.message, true); }
    finally { $('#scanVoicesBtn').disabled = false; }
  });

  let t = null;
  $('#prompts').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { renderPrompts(); saveForm(); }, 250); });
  $('#rangeTo').addEventListener('input', (e) => { e.target._auto = false; });
  // Magic Enhance Button
  $('#magicEnhanceBtn')?.addEventListener('click', magicEnhancePrompts);

  // CSV / Google Sheets Import
  $('#csvInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const text = await f.text();
      importCsvPrompts(text);
      $('#rangeTo')._auto = true;
    } catch (err) {
      toast('Failed to read CSV: ' + err.message, true);
    } finally {
      e.target.value = '';
    }
  });

  // Batch Analytics Close
  $('#closeAnalyticsBtn')?.addEventListener('click', () => {
    $('#batchAnalyticsCard')?.classList.add('hidden');
  });

  // Discord Toggle & Test Button
  $('#enableDiscordToggle')?.addEventListener('change', (e) => {
    $('#discordSettingsBox')?.classList.toggle('hidden', !e.target.checked);
  });

  $('#testDiscordBtn')?.addEventListener('click', async () => {
    const url = (settings.discordWebhookUrl || '').trim();
    if (!url) return toast('Enter a Discord Webhook URL first in Settings', true);
    const status = $('#discordTestStatus');
    status.textContent = 'Sending...';
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TEST_DISCORD', webhookUrl: url }, resolve);
      });
      if (res && res.success) {
        status.textContent = '✅ Sent!';
        toast('Discord test alert sent successfully!');
      } else {
        status.textContent = '❌ ' + ((res && res.error) || 'Failed');
        toast('Discord alert failed: ' + ((res && res.error) || 'Check URL'), true);
      }
    } catch (e) {
      status.textContent = '❌ Error';
      toast('Discord error: ' + e.message, true);
    }
  });

  $('#txtInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#prompts').value = await f.text(); e.target.value = '';
    $('#rangeTo')._auto = true; renderPrompts(); saveForm();
  });

  $('#imageInput').addEventListener('change', async (e) => { await addFiles(Array.from(e.target.files)); e.target.value = ''; });
  const dz = $('#dropZone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => addFiles(Array.from(e.dataTransfer.files)));
  $('#clearImagesBtn').addEventListener('click', () => { images = []; refreshUI(); });

  $('#scanCharsBtn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab || !isFlowUrl(tab.url)) return toast('Open a Google Flow project first.', true);
    $('#scanCharsBtn').disabled = true;
    try {
      const r = await sendToTab(tab.id, { type: 'SCAN_CHARACTERS' });
      scannedChars = ((r && r.characters) || []).map((c) => String(c).replace(/^@+/, '').trim()).filter(Boolean);
      settings.defaultCharacters = settings.defaultCharacters.filter((c) => scannedChars.includes(c));
      await chrome.storage.local.set({ [CHARS_KEY]: scannedChars });
      saveSettings(); refreshUI();
      toast(scannedChars.length ? `Found ${scannedChars.length} character(s)` : 'No characters found in this project', !scannedChars.length);
    } catch (e) { toast(e.message, true); }
    finally { $('#scanCharsBtn').disabled = false; }
  });

  $('#startBtn').addEventListener('click', start);
  $('#stopBtn').addEventListener('click', stop);
  $('#clearBtn').addEventListener('click', () => { $('#prompts').value = ''; saveForm(); renderPrompts(); });

  // Presets
  $$('.preset-pill').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // AI Drawer
  const aiDrawer = $('#aiPromptDrawer');
  const openAiBtn = $('#openAiDrawerBtn');
  const closeAiBtn = $('#closeAiDrawerBtn');
  if (openAiBtn && aiDrawer) {
    openAiBtn.addEventListener('click', () => {
      aiDrawer.classList.toggle('hidden');
      if (!aiDrawer.classList.contains('hidden')) $('#aiStoryIdea').focus();
    });
  }
  if (closeAiBtn && aiDrawer) {
    closeAiBtn.addEventListener('click', () => aiDrawer.classList.add('hidden'));
  }
  const genAiBtn = $('#generateAiPromptsBtn');
  if (genAiBtn) {
    genAiBtn.addEventListener('click', async () => {
      const idea = $('#aiStoryIdea').value.trim();
      if (!idea) { toast('Please enter an idea first', true); return; }
      const count = parseInt($('#aiSceneCount').value, 10) || 5;
      genAiBtn.disabled = true;
      genAiBtn.textContent = 'Generating...';
      try {
        const generated = await expandStoryToScenes(idea, count);
        const cur = $('#prompts').value.trim();
        $('#prompts').value = cur ? `${cur}\n\n${generated}` : generated;
        saveForm();
        renderPrompts();
        if (aiDrawer) aiDrawer.classList.add('hidden');
        toast(`Generated ${count} timed scene prompts!`);
      } catch (e) {
        toast('Generation failed: ' + e.message, true);
      } finally {
        genAiBtn.disabled = false;
        genAiBtn.textContent = 'Generate Scenes';
      }
    });
  }

  // Telegram test button
  const testTgBtn = $('#testTelegramBtn');
  if (testTgBtn) {
    testTgBtn.addEventListener('click', async () => {
      const token = (settings.telegramBotToken || '').trim();
      const chatId = (settings.telegramChatId || '').trim();
      const st = $('#telegramTestStatus');
      if (!token || !chatId) {
        st.textContent = '❌ Enter Token & Chat ID';
        st.style.color = '#f43f5e';
        return;
      }
      st.textContent = 'Sending test...';
      st.style.color = '#38bdf8';
      try {
        const r = await chrome.runtime.sendMessage({ type: 'TEST_TELEGRAM', token, chatId });
        if (r && r.success) {
          st.textContent = '✅ Connected!';
          st.style.color = '#10b981';
          toast('Telegram message sent successfully!');
        } else {
          st.textContent = '❌ ' + (r && r.error ? r.error : 'Failed');
          st.style.color = '#f43f5e';
        }
      } catch (e) {
        st.textContent = '❌ Error';
        st.style.color = '#f43f5e';
      }
    });
  }

  $('#openFlowBtn').addEventListener('click', async (e) => {
    const tab = await getActiveTab();
    const act = (e.currentTarget && e.currentTarget.dataset.act) || (e.target && e.target.dataset.act);
    if (act === 'reload' && tab) chrome.tabs.reload(tab.id);
    else if (tab) chrome.tabs.update(tab.id, { url: FLOW_URL });
    else chrome.tabs.create({ url: FLOW_URL });
    setTimeout(checkPage, 2500);
  });

  $('#openDlSettings').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://settings/downloads' }));
  $('#saveSelectors').addEventListener('click', async () => {
    const raw = $('#customSelectors').value.trim();
    if (raw) { try { const o = JSON.parse(raw); if (typeof o !== 'object' || Array.isArray(o)) throw new Error(); } catch (e) { return toast('That is not valid JSON object.', true); } }
    await chrome.storage.local.set({ [SELECTORS_KEY]: raw });
    toast('Selectors saved. They apply to the next batch.');
  });
  $('#resetSelectors').addEventListener('click', async () => { $('#customSelectors').value = ''; await chrome.storage.local.set({ [SELECTORS_KEY]: '' }); toast('Custom selectors cleared.'); });
  $('#resetSettings').addEventListener('click', async () => {
    if (!confirm('Reset all settings to default?')) return;
    settings = { ...DEFAULTS };
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    bindSettings(); refreshUI(); toast('Settings reset.');
  });

  $('#copyLogs').addEventListener('click', async () => {
    const txt = logs.map((l) => `[${new Date(l.timestamp).toISOString()}] [${(l.level || 'info').toUpperCase()}] ${l.message}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Logs copied'); } catch (e) { toast('Could not copy', true); }
  });
  $('#clearLogs').addEventListener('click', () => { logs = []; $('#logs').innerHTML = ''; });

  // Voice Preview button
  $('#previewVoiceBtn')?.addEventListener('click', previewVoice);

  // Library Drawer Wiring
  const libDrawer = $('#promptLibraryDrawer');
  const openLibBtn = $('#openLibraryBtn');
  const closeLibBtn = $('#closeLibraryDrawerBtn');
  if (openLibBtn && libDrawer) {
    openLibBtn.addEventListener('click', () => {
      libDrawer.classList.toggle('hidden');
      if (!libDrawer.classList.contains('hidden')) {
        renderTemplatesList();
        renderHistoryList();
      }
    });
  }
  if (closeLibBtn && libDrawer) {
    closeLibBtn.addEventListener('click', () => libDrawer.classList.add('hidden'));
  }
  $$('.lib-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.lib-tab').forEach(t => t.classList.toggle('active', t === tab));
      const isTemplates = tab.dataset.libtab === 'templates';
      $('#libTabTemplates').classList.toggle('active', isTemplates);
      $('#libTabTemplates').classList.toggle('hidden', !isTemplates);
      $('#libTabHistory').classList.toggle('active', !isTemplates);
      $('#libTabHistory').classList.toggle('hidden', isTemplates);
    });
  });
  $('#saveCurrentAsTemplateBtn')?.addEventListener('click', () => {
    const text = $('#prompts').value.trim();
    if (!text) return toast('Prompts box is empty!', true);
    const titleInput = $('#newTemplateTitle');
    const title = titleInput.value.trim() || `Template ${new Date().toLocaleDateString()}`;
    savedTemplates.unshift({
      id: 'tpl_' + Date.now(),
      title,
      text,
      promptsCount: parsePrompts(text).length
    });
    saveTemplates();
    renderTemplatesList();
    titleInput.value = '';
    toast('Template saved to library! â­');
  });
  $('#clearHistoryBtn')?.addEventListener('click', () => {
    promptHistory = [];
    saveHistory();
    renderHistoryList();
    toast('History cleared.');
  });

  // AI Drawer provider sync
  const drawerProv = $('#aiDrawerProvider');
  if (drawerProv) {
    drawerProv.value = settings.aiProvider || 'groq';
    drawerProv.addEventListener('change', (e) => {
      settings.aiProvider = e.target.value;
      saveSettings();
      const setProv = $('#settingAiProvider');
      if (setProv) setProv.value = e.target.value;
    });
  }

  // Handled globally

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'ACTION_LOG') addLog(msg.data || {});
    else if (msg.type === 'PROMPT_GROUP_STATUS') onGroupStatus(msg.data);
    else if (msg.type === 'VIDEO_GENERATION_PROGRESS' && msg.data) {
      $('#currentPct').textContent = `#${msg.data.promptIndex}: ${msg.data.percentage}%`;
    }
  });
  chrome.tabs.onActivated.addListener(() => checkPage());
  chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'complete' || info.url) checkPage(); });
}

// Productivity Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  // 1. Ctrl+Enter or Cmd+Enter -> Start AutoFlow
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const startBtn = $('#startBtn');
    if (startBtn && !startBtn.disabled) start();
  }
  // 2. Escape -> Close drawers or Stop batch
  else if (e.key === 'Escape') {
    const aiDrawer = $('#aiPromptDrawer');
    const libDrawer = $('#promptLibraryDrawer');
    if (aiDrawer && !aiDrawer.classList.contains('hidden')) {
      aiDrawer.classList.add('hidden');
    } else if (libDrawer && !libDrawer.classList.contains('hidden')) {
      libDrawer.classList.add('hidden');
    } else {
      const stopBtn = $('#stopBtn');
      if (stopBtn && !stopBtn.classList.contains('hidden')) stop();
    }
  }
  // 3. Ctrl+Alt+A -> Toggle AI Scene Expander
  else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    const aiDrawer = $('#aiPromptDrawer');
    if (aiDrawer) {
      aiDrawer.classList.toggle('hidden');
      if (!aiDrawer.classList.contains('hidden')) $('#aiStoryIdea')?.focus();
    }
  }
  // 4. Ctrl+Alt+L -> Toggle Library
  else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'l' || e.key === 'L')) {
    e.preventDefault();
    const libDrawer = $('#promptLibraryDrawer');
    if (libDrawer) {
      libDrawer.classList.toggle('hidden');
      if (!libDrawer.classList.contains('hidden')) {
        renderTemplatesList();
        renderHistoryList();
      }
    }
  }
});

// Global link interceptor: guarantees NO sidepanel iframe/CSP navigation errors occur
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
    e.preventDefault();
    e.stopPropagation();
    try {
      chrome.tabs.create({ url: href, active: true });
    } catch (err) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }
}, true);

(async function init() {
  await loadAll();
  wire();
  bindSettings();
  refreshUI();
  checkPage();
})();
