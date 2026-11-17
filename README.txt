AutoFlow By Faizul Islam Rifat - Chrome Extension v2.7.1
Created by Faizul Islam Rifat
Facebook:  https://www.facebook.com/faizulislamrifatkhan
YouTube:   https://www.youtube.com/@faizulislamrifatt
WhatsApp:  https://whatsapp.com/channel/0029VbE9x452phHPoJopqq0x
Telegram:  https://t.me/faizulislamrifatt

INSTALL (Chrome)
1. Chrome mein chrome://extensions kholein.
2. Upar right side "Developer mode" ON karein.
3. "Load unpacked" dabayein aur "AutoFlow Extension Code Review" folder select karein
   (wo folder jis ke andar manifest.json hai).
   Ya phir Release folder se .crx file drag and drop karein.
4. Puzzle icon se extension ko pin karein.

ISTEMAL
1. https://flow.google.com kholein aur Google account se login karein.
2. Extension icon par click karein - side panel khul jayega.
3. Mode chunein, settings set karein, prompts likhein (har prompt ke beech 1 khali line).
   File naming (Prompt Tag + time code): prompt ke shuru mein #0:04 likhein -> file 0-04.mp4 banegi.
   2 outputs ho to 0-04_1.mp4, 0-04_2.mp4. Tag na ho to "3 video.mp4" (prompt number).
4. "Start AutoFlow" dabayein (Shortcut: Ctrl+Enter). Flow tab khula rehne dein.

KEYBOARD SHORTCUTS
- Ctrl + Enter: Start AutoFlow batch immediately
- Esc: Stop batch / Close open drawers
- Ctrl + Alt + A: Toggle AI Scene Generator drawer
- Ctrl + Alt + L: Toggle Prompt Library & History drawer

NEW IN v2.7.1 (Fixes & Stability)
- Resolved chrome://extensions Errors badge by removing invasive console.warn/error traps from content script logger.
- Fixed early tile polling race condition: added a 20-poll initialization grace period before tiles are marked as failed, preventing false "generation failed, re-sending" loops.
- Styled DevTools console logs with color tags without triggering Chrome extension error flags.

NEW IN v2.7.0
1. ✨ 1-Click "Magic Prompt Enhancer":
   - Button above the prompts box upgrades user prompts into Hollywood cinema-grade Veo prompts with dynamic camera motion, lighting, textures, and color grading.
2. 📊 CSV & Google Sheets Bulk Importer:
   - Dedicated "📊 CSV / Sheets" button imports 50-100+ prompts at once directly from CSV or copy-pasted Google Sheets rows (with automatic #tag, @character, and voice mapping).
3. 🛡️ AI Auto-Healer & Smart Error Recovery:
   - When Google Flow triggers a safety/content policy filter, AutoFlow automatically rewrites the prompt to pass safety filters and retries without breaking your overnight queue.
4. 🎮 Discord Webhook Alert Integration:
   - Get instant rich embeds with completion stats, folder locations, and status directly in your Discord channels.
5. ⏳ Live ETA & Batch Analytics Report:
   - Real-time estimated completion countdown (`⏳ ETA: ~Xm Ys remaining`) and live elapsed time tracker during execution.
   - Comprehensive Analytics card showing total prompts, success rate, total duration, and average speed per video.

ZAROORI
- Chrome Settings > Downloads mein "Ask where to save each file" OFF rakhein.
- Chalte waqt upar "started debugging this browser" ki patti aayegi - ye normal hai.
- Files Downloads/<folder name> mein save hongi (Settings tab se folder badal sakte hain).
- Security Note: Key file (.pem) and release packages are kept outside in "D:\AutoFlow Release (keep private)".
