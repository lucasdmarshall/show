# SHOW — Competitive Strategy

> Founder ruling · 2026-09-06
> **SHOW က AJAX လိုပဲ သွားမယ်။ Prompt ကို ဦးစားပေးမယ်။ Image generation က premium only။ အဓိကက AJAX ကို ပြိုင်ဖို့။**

---

## 1. Positioning

| | AJAX | SHOW |
|---|---|---|
| ဘယ်လို ဖော်ပြလဲ | "Complete AI Post-Production Studio" | **"Myanmar's Prompt Studio"** — prompt ဆောက်တဲ့နေရာ |
| ပစ်မှတ် | Studio photographer | **AI နဲ့ ပုံလုပ်တဲ့ လူတိုင်း** (photographer + designer + FB page + content creator + ကျောင်းသား) |
| ဝင်ခွင့် | 65,000 MMK ပေးမှ | **အခမဲ့၊ အကန့်အသတ်မရှိ** |
| Prompt ရဲ့ နေရာ | Finalize room ရဲ့ **အဆုံးမှာ** ထွက်လာတဲ့ output | **product ကိုယ်တိုင်** |
| Image generation | core (အားလုံး ဒီအတွက်) | **premium add-on** |

### 1.1 ဘာကြောင့် ဒီလို ပြောင်းတာ မှန်လဲ

**① Cost structure က လုံးဝ ကွာတယ်**
Prompt ဆောက်တာက LLM call ~$0.001။ Image generation က $0.03–0.15။ **၃၀–၁၅၀ ဆ** ကွာတယ်။
→ Prompt ကို **အခမဲ့ပေးလို့ရတယ်**။ AJAX က ဒါကို မလုပ်ရဲဘူး (သူ့ business model က generation ပေါ်မှာ မှီနေလို့)။

**② ဈေးကွက် ကြီးသွားတယ်**
AJAX ရဲ့ ဈေးကွက် = မြန်မာ studio photographer (~၂,၀၀၀–၅,၀၀၀ ယောက်)
SHOW ရဲ့ ဈေးကွက် = **Midjourney / ChatGPT / ComfyUI / Draw Things သုံးတဲ့ မြန်မာလူ အားလုံး** (~၅၀,၀၀၀–၂၀၀,၀၀၀)
→ **၂၀–၅၀ ဆ ပိုကြီးတယ်**

**③ လူတွေမှာ tool ရှိပြီးသား**
Midjourney subscription, ChatGPT Plus, ComfyUI local — မြန်မာမှာ ရှိပြီးသားလူတွေ အများကြီး။
သူတို့ လိုချင်တာက **generation မဟုတ်ဘူး — prompt ပါ**။
AJAX က သူ့ cloud ကို အတင်းသုံးခိုင်းတယ်။ SHOW က **သူတို့ရှိပြီးသား tool ဆီ ပို့ပေးတယ်**။

---

## 2. Tier Model

### FREE — အကန့်အသတ်မရှိ, အမြဲတမ်း
> **ဒါက loss leader မဟုတ်ဘူး — ဒါက weapon ပါ**

- ✅ Prompt Compiler အပြည့် (§2B.1) — platform ၈ ခုအတွက် ထုတ်လို့ရ
- ✅ Burmese Prompt Dictionary (§2B.2)
- ✅ Persona / Fashion / Beauty / Scene / Art Director — **decision builder အားလုံး**
- ✅ Token Budget Meter (§2B.4), Health Check (§2B.11), Syntax Tutor (§2B.9)
- ✅ Copy → MidJourney / ComfyUI JSON / Draw Things / ChatGPT / Gemini / Flux
- ✅ Device-side tools အားလုံး (grade, curves, crop, retouch, batch, cutout, export) — WASM, offline
- ✅ Prompt library ကြည့်လို့ရ
- ✅ Reverse Prompt — **တစ်ရက် ၃ ခါ**
- ✅ Device-side draft preview (low-res, watermark)
- ❌ Cloud image generation

### PROMPT PRO — ~5,000 MMK/လ
- ✅ Reverse Prompt အကန့်အသတ်မရှိ
- ✅ Prompt Git (branch/diff/version)
- ✅ Prompt Marketplace မှာ **ရောင်းခွင့်**
- ✅ Model Arena (prompt နှိုင်းယှဉ်)
- ✅ Token Ablation (§2B.5)
- ✅ Private prompt library အကန့်အသတ်မရှိ
- ✅ Video prompt dialect (§2B.10) + storyboard
- ❌ Cloud image generation

### STUDIO — ~25,000 MMK/လ (+ USD balance)
- ✅ Prompt Pro အားလုံး
- ✅ **Cloud image generation** — room အားလုံး
- ✅ Costume Wall + Backdrop Wall (မြန်မာ library)
- ✅ Composite Harmonizer, Baby Studio, Old Photo, Living Memory
- ✅ Myanmar Text Engine (album/ဖိတ်စာ/promo)
- ✅ Public portfolio `show.com/@name`
- ✅ လစဉ် USD balance ပါ

### EVENT — သီးသန့်
- Event Photo အပြည့် (QR gallery, watch folder, live wall, print)

> **Activation fee မရှိ။** AJAX က ဝင်ခွင့်အတွက် 50,000 MMK ကောက်တယ် — ဒါက သူ့ရဲ့ အားနည်းချက် အကြီးဆုံး။

---

## 3. AJAX ကို တိုက်မယ့် အချက် ၁၀ ချက်

| # | AJAX ရဲ့ အားနည်းချက် | SHOW ရဲ့ တိုက်ချက် |
|---|---|---|
| 1 | **၇ ရက် trial မှာ API balance အခမဲ့ မပါဘူး** — sign up လုပ်ပြီး ဘာမှ မလုပ်နိုင် | **Prompt အားလုံး အမြဲအခမဲ့** + device preview အခမဲ့ |
| 2 | **ဝင်ခွင့် 50,000 MMK** activation fee | **၀ ကျပ်** — activation fee လုံးဝမရှိ |
| 3 | **Payment ကို Founder လက်ခံမှ ရ** (နာရီ/ရက်နဲ့ချီ စောင့်) | **၁ မိနစ်အတွင်း အလိုအလျောက်** |
| 4 | **သူ့ cloud ကိုပဲ သုံးခိုင်း** — MJ/ComfyUI ရှိသူ အလကား | **ကိုယ့် tool ဆီ ပို့ပေး** (BYO — MJ, ComfyUI, Draw Things, ChatGPT) |
| 5 | Prompt က Finalize ရဲ့ **အဆုံးမှာမှ** ရ — room ၄ ခု ဖြတ်ပြီးမှ | Prompt က **ပထမဆုံး screen** — ၃၀ စက္ကန့်နဲ့ prompt ရ |
| 6 | **ပုံကနေ prompt ပြန်ထုတ်လို့ မရ** | **Reverse Prompt** — အကြီးဆုံး hook |
| 7 | **မြန်မာစကားလုံး prompt မှာ အလုပ်မလုပ်** | **Burmese Prompt Dictionary** (concept ၅၀၀+) |
| 8 | **Exhibition က public link မထုတ်ပေး** — မျှဝေလို့မရ | **Public portfolio + FB OG card** — user က ကြော်ငြာပေးသလိုဖြစ် |
| 9 | **Desktop-oriented** (Watch Folder = Chrome desktop, tab များ) | **Mobile-first** |
| 10 | **Community/network effect မရှိ** | **Prompt Marketplace** — ရောင်းလို့ရ, revenue share |

---

## 4. Funnel

```
Reverse Prompt (viral hook, FB မှာ ပျံ့)
   → အခမဲ့ prompt tool သုံး (နေ့စဉ်, ကိုယ့် MJ/ComfyUI နဲ့)
      → Token Meter / Health Check နဲ့ အကျင့်ဖြစ်လာ
         → Marketplace မှာ prompt ရောင်းချင် → PROMPT PRO
            → "ဒီမှာတင် generate လုပ်လိုက်ရင် လွယ်တာပဲ" → STUDIO
               → Album/ဖိတ်စာ လုပ်ရ (Myanmar Text Engine) → ဆက်ဆွဲထား
```

**အဓိကအချက်:** အခမဲ့ user က cost မကုန်ဘူး (prompt = LLM call ~$0.001)။
ဒါကြောင့် **အခမဲ့ user သောင်းချီ ထားနိုင်တယ်** — AJAX က ဒါကို မလုပ်နိုင်ဘူး။

---

## 5. Go-to-market

1. **Reverse Prompt ကို FB မှာ လွှတ်** — "ဒီပုံရဲ့ prompt ဒါပါပဲ" post တွေ
2. **မြန်မာ AI/Midjourney/ComfyUI FB group တွေ** — အခမဲ့ tool အနေနဲ့ ဝင်
3. **Prompt Marketplace** — prompt ရောင်းနေတဲ့သူတွေကို ဆွဲသွင်း (သူတို့ရဲ့ audience ပါလာ)
4. **Myanmar Text Engine** — designer group တွေ (photographer မဟုတ်တဲ့ ဈေးကွက်)
5. **Living Memory** — မိသားစု/emotional viral
6. **Messenger bot** — friction သုည

---

## 6. အန္တရာယ် (ရိုးရိုးသားသား)

| အန္တရာယ် | တုံ့ပြန်ချက် |
|---|---|
| AJAX က free prompt tier ကို ကူးလုပ်နိုင် | သူ့ business model က generation ပေါ်မှီနေလို့ **cannibalize ဖြစ်မယ်**။ ကူးဖို့ ခက်တယ်။ ဒါပေမယ့် ၆ လအတွင်း moat (Dictionary, Marketplace, Content) ဆောက်ထားရမယ် |
| အခမဲ့ user များပြီး ဝင်ငွေမရ | Prompt cost နည်းလို့ ခံနိုင်တယ်။ ဒါပေမယ့် **conversion rate ကို ကြည့်ရမယ်** — ၃% အောက်ဆို tier ပြန်ချိန်ရမယ် |
| မြန်မာမှာ subscription ပေးလေ့မရှိ | တစ်လစာ ဝယ်တာ (one-off top-up) ကိုပါ ခွင့်ပြု။ KBZPay နဲ့ ၅,၀၀၀ က ခံနိုင်တဲ့ ဈေး |
| AJAX မှာ content library ရှိပြီးသား | သူ့ costume gallery က **ကန့်သတ်ထားတယ်**။ SHOW က တိုင်းရင်းသား ၅၀+ နဲ့ ကျော်တက်ရမယ် — ဒါက ၆ လ အလုပ် |
| Prompt-only က ဈေးနည်းလွန်း | Prompt Pro က **ဝင်ငွေ မဟုတ်ဘူး — habit ပါ**။ ဝင်ငွေက Studio tier နဲ့ Event ကနေ |

---

## 7. ဆုံးဖြတ်ရန် ကျန်

- [ ] Free tier ရဲ့ Reverse Prompt limit — ၃/ရက် သင့်လား?
- [ ] Prompt Pro ဈေး — 5,000 MMK မှန်လား?
- [ ] Studio tier မှာ USD balance ဘယ်လောက် ထည့်ပေးမလဲ
- [ ] One-off top-up (subscription မဟုတ်) ခွင့်ပြုမလား
- [ ] AJAX ကို တိုက်ရိုက် နာမည်တပ် နှိုင်းယှဉ်မလား (marketing မှာ)
