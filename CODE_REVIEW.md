# AutoFlow By Faizul Islam Rifat — কোড রিভিউ ও আর্কিটেকচার ডকুমেন্টেশন

এই ডকুমেন্টটিতে **AutoFlow By Faizul Islam Rifat (v2.7.1)** ক্রোম এক্সটেনশনের সম্পূর্ণ কোডবেস স্ট্রাকচার, নতুন প্রফেশনাল ফিচারসমূহ, ফাইল আর্কিটেকচার এবং ব্যবহার নির্দেশিকা বিস্তারিত লিপিবদ্ধ করা হলো।

---

## ১. প্রজেক্ট পরিচিতি
- **নাম:** AutoFlow By Faizul Islam Rifat
- **ভার্সন:** 2.7.1
- **টাইপ:** Google Chrome Extension (Manifest V3)
- **টার্গেট প্ল্যাটফর্ম:** Google Flow (`https://flow.google.com/`, `https://labs.google/fx/`)
- **স্রষ্টা ও স্বত্বাধিকারী:** Faizul Islam Rifat (Verified Creator)
- **সোশ্যাল প্রোফাইল:**
  - Facebook (Author Profile): `https://www.facebook.com/faizulislamrifatkhan`
  - YouTube: `https://www.youtube.com/@faizulislamrifatt`
  - WhatsApp: `https://whatsapp.com/channel/0029VbE9x452phHPoJopqq0x`
  - Telegram: `https://t.me/faizulislamrifatt`
- **রিলিজ প্যাকেজ লোকেশন:** `D:\AutoFlow Release (keep private)\`
  - `Faizul-AutoFlow-v2.7.1.crx` (Chrome সাইনড প্যাকেজ)
  - `Faizul-AutoFlow-v2.7.1.zip` (ওয়েব স্টোর / ব্যাকআপ জিপ)
  - `AutoFlow Extension Code Review.pem` (প্রাইভেট সিকিউরিটি কি — সুরক্ষিত বাইরে সংরক্ষিত)

---

## ২. ফাইল ও ডিরেক্টরি স্ট্রাকচার

```
D:\AutoFlow Extension Code Review\
├── manifest.json            # এক্সটেনশন মেটাডাটা, পারমিশন (Discord, Groq, OpenAI, Gemini host permissions)
├── background.js           # ব্যাকগ্রাউন্ড সার্ভিস ওয়ার্কার (CDP অটোমেশন, Telegram/Discord নোটিফিকেশন, Auto-Healer)
├── README.txt              # ব্যবহার নির্দেশিকা ও ফিচার বিবরণী
├── CODE_REVIEW.md          # আর্কিটেকচার ও কোড রিভিউ ডকুমেন্ট
├── assets/
│   └── avatar.png          # ক্রিয়েটরের অফিশিয়াল প্রফেশনাল অ্যাভাটার
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.css
│   ├── content.js
│   ├── flow.js             # Flow DOM সিলেক্টর ও রানার (Fix: Initializing grace period)
│   ├── queue.js            # প্রম্পট ও ডাউনলোড কিউ, AI Auto-Healer ও স্মার্ট রিট্রাই
│   ├── helpers.js          # লগার ও হেল্পার (Fix: Safe styled console logging)
│   └── selectors.js
└── sidepanel/
    ├── index.html          # প্রফেশনাল এক্সিকিউটিভ ড্যাশবোর্ড (Enhance, CSV Import, ETA, Analytics, Discord)
    ├── style.css           # প্রিমিয়াম ডার্ক-গ্লাস ইউজার ইন্টারফেস ও অ্যানিমেশন
    └── app.js              # কোর কন্ট্রোলার, টাইমার ইঞ্জিন ও মাল্টি-প্রোভাইডার লজিক
```

---

## ৩. v2.7.1 এ সমাধানকৃত এরর ও বাগ ফিক্স (Bug Fixes)

1. **`chrome://extensions` এরর ব্যাজ সমাধান (Safe Logger Fix):**
   - গুগুল ক্রোম কনটেন্ট স্ক্রিপ্টে `console.warn` বা `console.error` কল করলে সেটিকে এক্সটেনশনের ক্র্যাশ বা ত্রুটি হিসেবে ধরে নেয় এবং এক্সটেনশন ম্যানেজারে লাল "Errors" বাটন প্রদর্শন করে।
   - `content/helpers.js`-এ এই কলগুলোকে স্টাইল্ড `console.log` ফরম্যাটে পরিবর্তন করা হয়েছে, যার ফলে ডেভটুলস কনসোলে রঙিন আউটপুট থাকবে কিন্তু ক্রোম কোনো ভুল "Errors" ব্যাজ দেখাবে না।

2. **প্রিম্যাচিউর "generation failed, re-sending" সমাধান (Grace Period Fix):**
   - Flow-তে প্রম্পট সাবমিট করার সাথে সাথে প্রথম ৩ সেকেন্ডে টাইলসে পারসেন্টেজ স্পিনার না আসায় সিস্টেম ভুলবশত টাইলটিকে ব্যর্থ হিসেবে চিহ্নিত করত এবং অপ্রয়োজনীয়ভাবে প্রম্পটটি পুনরায় সেন্ড করত।
   - `content/flow.js`-এর `waitForResults`-এ কমপক্ষে ২০টি পোল (~৩০ সেকেন্ড) ইনিশিয়ালাইজিং গ্রেস পিরিয়ড যোগ করা হয়েছে। ফলে টাইলস শুরু হতে দেরি হলেও এটি শান্তভাবে অপেক্ষা করবে এবং ভিডিও সঠিকভাবে তৈরি হবে।

---

## ৪. ইনস্টলেশন ও ব্যবহার নির্দেশিকা

1. গুগুল ক্রোমে গিয়ে প্রবেশ করুন: `chrome://extensions/`
2. পূর্বের ত্রুটির তালিকা মুছে ফেলার জন্য **Clear all** বাটনে চাপুন।
3. **AutoFlow By Faizul Islam Rifat** কার্ডটির **🔄 (Reload)** আইকনে ক্লিক করুন (অথবা রিলিজ ফোল্ডার থেকে `Faizul-AutoFlow-v2.7.1.crx` টেনে এনে ছেড়ে দিন)।
4. Google Flow (`https://flow.google.com/`) ট্যাবে গিয়ে নতুন আপডেটটি স্মুথলি উপভোগ করুন।
