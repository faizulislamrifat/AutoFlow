/* AutoFlow By Faizul Islam Rifat - background service worker */
'use strict';

const FLOW_PATTERNS = ['*://flow.google.com/*', '*://labs.google/fx/*'];

/* ---------------- Download naming state ---------------- */
let folderPrefix = '';          // "my-folder/"
let namePrefix = '';            // "tag_" used for files Flow downloads by itself (upscaled)
let autoRename = true;
let renameOffTimer = null;
const plannedNames = new Map(); // url -> "folder/file.ext"
let handledDownloads = 0;       // how many Flow media downloads we have named so far

const cleanSlashes = (s) => String(s || '').trim().replace(/^[/\\]+|[/\\]+$/g, '');

function onDeterminingFilename(item, suggest) {
  const url = item.url || '';
  const fromFlow = url.includes('google') || url.startsWith('data:') || url.startsWith('blob:') || url.includes('flow') || url.includes('labs.google');
  const fromUs = !item.byExtensionId || item.byExtensionId === chrome.runtime.id;
  if (!fromFlow && !fromUs) return;
  if (!autoRename) return;

  handledDownloads++;

  // 1. If download was initiated directly by our extension (e.g. direct image/video download):
  if (item.byExtensionId === chrome.runtime.id) {
    let dest = plannedNames.get(url);
    if (dest) plannedNames.delete(url);
    else dest = item.filename;

    if (dest) {
      if (folderPrefix && !dest.startsWith(folderPrefix)) {
        dest = folderPrefix + dest.replace(/^[/\\]+/, '');
      }
      suggest({ filename: dest.replace(/^[/\\]+/, ''), conflictAction: 'uniquify' });
      return;
    }
  }

  // 2. If download was initiated by Google Flow (e.g. 2K/4K/1080p upscale button or page):
  const nameOrUrl = ((item.filename || '') + ' ' + url).toLowerCase();
  const isVideo = /\.(mp4|webm|mov)$/i.test(item.filename || '') || /\.(mp4|webm|mov)/i.test(url) || (item.mime || '').startsWith('video/');
  const ext = isVideo ? '.mp4' : '.png';

  let fn;
  if (namePrefix && namePrefix.trim()) {
    fn = folderPrefix + namePrefix.trim().replace(/_+$/, '') + ext;
  } else {
    const original = item.filename || '';
    const base = original.split(/[/\\]/).pop() || original;
    const cleanBase = base && base.includes('.') ? base : (base ? `${base}${ext}` : (isVideo ? `video${ext}` : `image${ext}`));
    fn = (folderPrefix || '') + cleanBase;
  }

  suggest({ filename: fn.replace(/^[/\\]+/, ''), conflictAction: 'uniquify' });
}

function enableRename(on) {
  const has = chrome.downloads.onDeterminingFilename.hasListener(onDeterminingFilename);
  if (on && !has) chrome.downloads.onDeterminingFilename.addListener(onDeterminingFilename);
  if (!on && has) chrome.downloads.onDeterminingFilename.removeListener(onDeterminingFilename);
}
enableRename(true);

/* ---------------- Side panel ---------------- */
async function setupPanel() {
  try {
    await chrome.sidePanel.setOptions({ path: 'sidepanel/index.html', enabled: true });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) { /* older chrome */ }
}
setupPanel();

chrome.runtime.onInstalled.addListener(async (details) => {
  await setupPanel();
  if (details.reason === 'install') {
    // reload already-open Flow tabs so the content script gets injected
    try {
      const tabs = await chrome.tabs.query({ url: FLOW_PATTERNS });
      for (const t of tabs) if (t.id) chrome.tabs.reload(t.id).catch(() => {});
    } catch (e) {}
  }
});

/* ---------------- Debugger (trusted input) ---------------- */
const attached = new Set();
chrome.tabs.onRemoved.addListener((id) => attached.delete(id));
chrome.debugger.onDetach.addListener((src) => { if (src.tabId !== undefined) attached.delete(src.tabId); });

async function ensureAttached(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (!/already attached/i.test(msg)) throw e;
  }
  attached.add(tabId);
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
    await chrome.debugger.sendCommand({ tabId }, 'Network.setCacheDisabled', { cacheDisabled: true });
  } catch (e) {}
}
const cdp = (tabId, method, params) => chrome.debugger.sendCommand({ tabId }, method, params || {});

async function mouseMove(tabId, x, y) {
  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', modifiers: 0 });
}
async function mouseClick(tabId, x, y) {
  await mouseMove(tabId, x, y);
  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers: 0 });
  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, modifiers: 0 });
}
async function keyPress(tabId, m) {
  const base = { key: m.key, code: m.code, windowsVirtualKeyCode: m.keyCode, nativeVirtualKeyCode: m.keyCode };
  if (m.text !== undefined) { base.text = m.text; base.unmodifiedText = m.text; }
  if (m.modifiers !== undefined) base.modifiers = m.modifiers;
  if (m.keyType) return cdp(tabId, 'Input.dispatchKeyEvent', { type: m.keyType, ...base });
  // keys that type a character use keyDown (+text); control keys (Enter, Escape, Backspace, End...)
  // use rawKeyDown so they never insert stray characters / new lines
  await cdp(tabId, 'Input.dispatchKeyEvent', { type: m.text !== undefined ? 'keyDown' : 'rawKeyDown', ...base });
  await cdp(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

/* ---------------- Notifications & Telegram ---------------- */
async function showDesktopNotification(title, message) {
  try {
    const st = await chrome.storage.local.get('aws_settings');
    const s = st.aws_settings || {};
    if (s.enableDesktopNotification === false) return;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'AutoFlow By Faizul Islam Rifat',
      message: message || 'Batch operation finished.'
    });
  } catch (e) {}
}

async function sendDiscordAlert(title, description, fields = [], isError = false) {
  try {
    const st = await chrome.storage.local.get('aws_settings');
    const s = st.aws_settings || {};
    const webhookUrl = (s.discordWebhookUrl || '').trim();
    if (!webhookUrl || s.enableDiscord !== true) return { success: false, error: 'Discord not enabled' };
    const embed = {
      title,
      description,
      color: isError ? 0xff4d4f : 0x5865f2,
      fields,
      footer: { text: 'AutoFlow By Faizul Islam Rifat • Verified Creator' },
      timestamp: new Date().toISOString()
    };
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'AutoFlow By Faizul Islam Rifat',
        embeds: [embed]
      })
    });
    return { success: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: errText(e) };
  }
}

async function sendTelegramAlert(text) {
  try {
    const st = await chrome.storage.local.get('aws_settings');
    const s = st.aws_settings || {};
    const token = (s.telegramBotToken || '').trim();
    const chatId = (s.telegramChatId || '').trim();
    if (!token || !chatId || s.enableTelegram !== true) return { success: false, error: 'Telegram not enabled' };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
    const json = await res.json();
    return { success: json.ok, error: json.description };
  } catch (e) {
    return { success: false, error: errText(e) };
  }
}

/* ---------------- Messages ---------------- */
const errText = (e) => (e && e.message) ? e.message : String(e);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = (sender.tab && sender.tab.id) || (msg && msg.tabId);
  const needTab = () => { if (!tabId) { reply({ success: false, error: 'No tab id' }); return false; } return true; };

  switch (msg && msg.type) {
    case 'TEST_DISCORD': {
      const { webhookUrl } = msg;
      (async () => {
        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'AutoFlow By Faizul Islam Rifat',
              embeds: [{
                title: '🎮 AutoFlow By Faizul Islam Rifat Test Notification',
                description: 'Your Discord webhook alert system is connected successfully! You will receive live batch completion reports here.',
                color: 0x5865f2,
                fields: [
                  { name: 'Status', value: '✅ Connected', inline: true },
                  { name: 'Version', value: 'v2.7.0 Pro', inline: true }
                ],
                footer: { text: 'AutoFlow By Faizul Islam Rifat • Verified Creator' },
                timestamp: new Date().toISOString()
              }]
            })
          });
          reply({ success: res.ok, error: res.ok ? null : `HTTP ${res.status}` });
        } catch (e) {
          reply({ success: false, error: errText(e) });
        }
      })();
      return true;
    }

    case 'AUTO_HEAL_PROMPT': {
      const { prompt, error } = msg;
      (async () => {
        try {
          const st = await chrome.storage.local.get('aws_settings');
          const s = st.aws_settings || {};
          const groqKey = (s.groqApiKey || '').trim();
          const openaiKey = (s.openaiApiKey || '').trim();
          let healed = null;

          const healSysPrompt = 'You are an AI video prompt safety expert. The user prompt was rejected or failed due to safety, content policy, or sensitive words. Rewrite the prompt to be 100% compliant with strict AI safety policies while preserving the visual scene, artistic style, and action intent. Strip out any violence, weapons, sensitive words, or trademarks. Output ONLY the safe prompt text, no quotes or explanations.';

          if (groqKey) {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: healSysPrompt }, { role: 'user', content: `Original Prompt: ${prompt}\nError details: ${error || 'Safety policy warning'}` }],
                temperature: 0.5
              })
            });
            const j = await r.json();
            healed = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content ? j.choices[0].message.content.trim() : null;
          } else if (openaiKey) {
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: healSysPrompt }, { role: 'user', content: `Original Prompt: ${prompt}\nError details: ${error || 'Safety policy warning'}` }],
                temperature: 0.5
              })
            });
            const j = await r.json();
            healed = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content ? j.choices[0].message.content.trim() : null;
          }

          if (!healed) {
            healed = prompt
              .replace(/\b(gun|weapon|blood|kill|death|fight|attack|naked|nude|nsfw|sexy)\b/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
          }

          reply({ success: true, healedPrompt: healed || prompt });
        } catch (e) {
          reply({ success: false, error: errText(e) });
        }
      })();
      return true;
    }

    case 'TEST_TELEGRAM': {
      const { token, chatId } = msg;
      (async () => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '🔔 *AutoFlow By Faizul Islam Rifat Test Notification*\n\nYour Telegram alert system is connected successfully! You will receive automatic updates whenever video/image batches finish.',
              parse_mode: 'Markdown'
            })
          });
          const json = await res.json();
          reply({ success: json.ok, error: json.description });
        } catch (e) {
          reply({ success: false, error: errText(e) });
        }
      })();
      return true;
    }

    case 'SET_ZOOM':
      if (!needTab()) return false;
      chrome.tabs.setZoom(tabId, msg.zoomFactor).then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    case 'DOWNLOAD_RESOURCE': {
      const { url, filename, folder, autoChangeFileName } = msg;
      const opts = { url, saveAs: false, conflictAction: 'uniquify' };
      if (autoChangeFileName !== false) {
        const f = cleanSlashes(folder);
        const n = String(filename || '').trim().replace(/^[/\\]+/, '');
        const dest = f ? `${f}/${n}` : n;
        if (dest) { plannedNames.set(url, dest); opts.filename = dest; }
      }
      chrome.downloads.download(opts, (id) => {
        const le = chrome.runtime.lastError;
        reply(!le && id ? { success: true, downloadId: id } : { success: false, error: le ? le.message : 'Download failed to start' });
      });
      return true;
    }

    case 'SET_FOLDER_NAME': {
      if (typeof msg.folderName === 'string') folderPrefix = msg.folderName.trim() ? cleanSlashes(msg.folderName) + '/' : '';
      if (typeof msg.prefix === 'string') namePrefix = msg.prefix.trim();
      if (typeof msg.autoChangeFileName === 'boolean') autoRename = msg.autoChangeFileName;
      if (renameOffTimer) { clearTimeout(renameOffTimer); renameOffTimer = null; }
      enableRename(autoRename);
      reply({ success: true });
      return false;
    }

    case 'DOWNLOAD_COUNTER':
      reply({ count: handledDownloads });
      return false;

    case 'OPEN_DOWNLOAD_SETTINGS':
      chrome.tabs.create({ url: 'chrome://settings/downloads' });
      reply({ success: true });
      return false;

    case 'PROMPT_GROUP_STATUS': {
      const data = msg.data || {};
      const st = data.status;
      if (st === 'completed' || st === 'cancelled' || st === 'error') {
        if (renameOffTimer) clearTimeout(renameOffTimer);
        renameOffTimer = setTimeout(() => { namePrefix = ''; renameOffTimer = null; }, 300000);

        if (st === 'completed') {
          const succ = (data.results || []).filter((r) => r.success).length;
          const tot = data.totalCount || (data.results && data.results.length) || 0;
          showDesktopNotification('Batch Completed! 🚀', `Successfully generated & downloaded ${succ}/${tot} items in Downloads/${folderPrefix || 'faizul-flow'}`);
          sendTelegramAlert(`🚀 *AutoFlow By Faizul Islam Rifat Alert*\n\n✅ *Batch Completed!*\n📊 *Total Prompts:* ${tot}\n🎯 *Successful:* ${succ}\n📁 *Saved Folder:* \`Downloads/${folderPrefix || 'faizul-flow'}\`\n🕒 *Completed At:* ${new Date().toLocaleTimeString()}`);
          sendDiscordAlert('🚀 AutoFlow By Faizul Islam Rifat — Batch Completed!', `Successfully generated & downloaded **${succ}/${tot}** items.`, [
            { name: '📊 Total Prompts', value: String(tot), inline: true },
            { name: '🎯 Successful', value: String(succ), inline: true },
            { name: '📁 Saved Folder', value: `Downloads/${folderPrefix || 'faizul-flow'}`, inline: false }
          ], false);
        } else if (st === 'error') {
          showDesktopNotification('Batch Error ⚠️', 'An error occurred while generating prompts.');
          sendTelegramAlert(`⚠️ *AutoFlow By Faizul Islam Rifat Alert*\n\n❌ *Batch Failed with Error*\nPlease check Google Flow or the sidepanel logs.`);
          sendDiscordAlert('⚠️ AutoFlow By Faizul Islam Rifat — Batch Failed', 'An error occurred while running prompts. Please check Google Flow or extension logs.', [], true);
        }
      }
      return false;
    }

    case 'FETCH_AS_DATAURL':
      (async () => {
        try {
          const r = await fetch(msg.url, { credentials: 'include' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const blob = await r.blob();
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = '';
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          reply({ success: true, dataUrl: `data:${blob.type || 'image/png'};base64,${btoa(bin)}` });
        } catch (e) { reply({ success: false, error: errText(e) }); }
      })();
      return true;

    case 'DBG_ATTACH':
      if (!needTab()) return false;
      ensureAttached(tabId).then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    case 'DBG_DETACH':
      if (!needTab()) return false;
      (async () => {
        try { if (attached.has(tabId)) await chrome.debugger.detach({ tabId }); } catch (e) {}
        attached.delete(tabId);
        reply({ success: true });
      })();
      return true;

    case 'DBG_INSERT_TEXT':
      if (!needTab()) return false;
      ensureAttached(tabId).then(() => cdp(tabId, 'Input.insertText', { text: msg.text }))
        .then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    case 'DBG_KEY':
      if (!needTab()) return false;
      ensureAttached(tabId).then(() => keyPress(tabId, msg))
        .then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    case 'DBG_HOVER':
      if (!needTab()) return false;
      ensureAttached(tabId).then(() => mouseMove(tabId, msg.x, msg.y))
        .then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    case 'DBG_CLICK':
      if (!needTab()) return false;
      ensureAttached(tabId).then(() => mouseClick(tabId, msg.x, msg.y))
        .then(() => reply({ success: true })).catch((e) => reply({ success: false, error: errText(e) }));
      return true;

    default:
      return false;
  }
});
