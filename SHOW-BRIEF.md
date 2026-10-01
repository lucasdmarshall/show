# SHOW — Project Brief

> Founder brief အရ မှတ်တမ်းတင်ထားသော source-of-truth စာရွက်။
> နောက်ဆုံးပြင်ဆင်သည့်ရက်: 2026-09-06
> အခြေအနေ: **Draft v0.1 — requirements captured, architecture မဆုံးဖြတ်ရသေး**

---

## 1. Product Name

**SHOW**

---

## 2. Core Mandate (founder ပြောသည့်အတိုင်း)

| # | လိုအပ်ချက် | မှတ်ချက် |
|---|---|---|
| 1 | AJAX CLICK AI STUDIO ထက် **အဆ ၁၀၀ သာရမည်** | benchmark = `https://ajaxclickaistudio.com/` |
| 2 | AJAX ထက် **ဆန်းပြားရမည်** | |
| 3 | **နည်းပညာလောကမှာ မရှိသေးတဲ့ feature** များ ပါရမည် | genuinely novel — prior art မရှိ |
| 4 | **ရှိမှန်းလူတွေ မသိသေးတဲ့ feature** များ ပါရမည် | latent need — ရှိပြီးသားပြဿနာကို လူတွေ ပြဿနာမှန်း မသိသေးတာ |
| 5 | UI = **Premium Luxury** | |
| 6 | **Awwwards level** website ဖြစ်ရမည် | SOTD/SOTM အဆင့် |
| 7 | **Mobile first** | desktop ကို progressive enhancement အဖြစ်သာ |

---

## 3. AJAX နှင့် ဆက်နွယ်မှု — ရှင်းလင်းချက် (2026-09-06 ပြင်ဆင်ချက်)

### 3.1 Feature scope — **အကုန်ယူသည်**
> **SHOW ⊃ AJAX**

AJAX မှာရှိသမျှ **feature အားလုံး** SHOW မှာ ပါရမည်။ တစ်ခုမှ မကျန်ရ။
ပါရုံတင်မကဘဲ **တစ်ခုချင်းစီ ပိုကောင်းရမည်**။
ထို့အပြင် AJAX မှာ လုံးဝမရှိသော feature အသစ်များ ထပ်ထည့်ရမည်။

အသေးစိတ် mapping → `docs/02-FEATURES.md`

### 3.2 Design/UI scope — **Before/After slider သာ**
- ✅ **Before / After slider interaction** — ဒါတစ်ခုတည်းသာ design အနေနဲ့ ယူသည် (ပြီးတော့ ဆင့်ကဲရမည်)
- ❌ Visual language, layout, IA, colour, motion, naming, brand — **အားလုံး SHOW ကိုယ်ပိုင်**
- ❌ AJAX ရဲ့ "room" browser UI ကို ကူးမချ — feature က တူပေမယ့် ဖော်ပြပုံ မတူရ

---

## 4. Tech Stack (သတ်မှတ်ပြီး)

### 4.1 Frontend
- **Language: TypeScript** (strict mode, no `any`)
- Framework — မဆုံးဖြတ်ရသေး (Next.js App Router vs. Remix/React Router vs. SvelteKit)
- Rendering — mobile-first, WebGPU/WebGL2 canvas pipeline

### 4.2 Backend
- **Rust သို့မဟုတ် Go** — *ဘယ်ဟာက ပိုကောင်းလဲ ဆုံးဖြတ်ခွင့်ကို engineering ဘက်က ပေးထား*
  - လက်ရှိ အကြံပြုချက်: **Rust** (အကြောင်းရင်း §4.4)
- **+ Python** — AI / ML orchestration layer

### 4.3 Typography
- **Plus Jakarta Sans** — primary typeface
- (display/serif accent တစ်ခု ထပ်ထည့်မလား — ဆွေးနွေးရန် ကျန်)

### 4.4 Rust vs Go — အကြံပြုချက် (ဆုံးဖြတ်ရန် ကျန်)

**Rust ကို ရွေးသင့်သည့် အဓိကအကြောင်းရင်း — WASM code sharing:**

Rust နဲ့ရေးထားတဲ့ image pipeline (color science, curves, histogram, grain, LUT, tone-map, shadow solver) ကို —
- server မှာ **native** run လုပ်လို့ရ
- browser မှာ **WASM + WebGPU** အဖြစ် တစ်ခုတည်းသော code base ကနေ run လုပ်လို့ရ

→ ပုံရဲ့ **on-device preview နဲ့ server-side final render က pixel-identical** ဖြစ်တယ်။
→ Myanmar internet အခြေအနေအတွက် **offline-first** ဖြစ်နိုင်တယ်။
→ Go မှာ ဒါကို မရဘူး (TinyGo က ဒီ workload အတွက် မလုံလောက်)။

| | Rust | Go |
|---|---|---|
| WASM/browser code sharing | ✅ first-class | ❌ |
| Image/pixel throughput | ✅ zero-copy, SIMD, `wgpu` | ⚠️ GC pause |
| GPU compute | ✅ `wgpu`, `cudarc` | ⚠️ CGO |
| Dev velocity | ⚠️ ပိုနှေး | ✅ ပိုမြန် |
| Team hiring | ⚠️ ခက် | ✅ လွယ် |
| Concurrency ergonomics | ⚠️ | ✅ |

**Proposed split:**
- **Rust (axum + tokio)** — API gateway, media/pixel engine, shadow & relight solver, WASM edge runtime
- **Python (FastAPI)** — model orchestration, prompt compilation, embeddings, QA critic
- **Go** — မလို။ (လိုအပ်ရင် internal ops/queue service အတွက်သာ)

---

## 5. Design Direction

- **Premium Luxury** — mass-market SaaS မဟုတ်။ atelier / maison feel။
- **Awwwards level** — motion design, scroll choreography, WebGL, custom cursor, sound design (optional) — ဒါပေမယ့် performance မထိခိုက်စေရ။
- **Mobile first** — layout, gesture, thumb-reach, one-hand operation ကို အရင်ဒီဇိုင်း။ Desktop က mobile ရဲ့ expansion ဖြစ်ရမယ်။
- `prefers-reduced-motion` ကို အပြည့်အဝ လေးစားရမည်။
- Dark-first palette + light mode — နှစ်ခုလုံး ညီညီညာညာ ရှိရမည်။

---

## 6. Non-negotiables

1. Mobile ပေါ်မှာ Awwwards-level ဖြစ်ရမယ် — desktop-only showpiece မဟုတ်။
2. TypeScript strict။
3. Plus Jakarta Sans။
4. Before/After slider က SHOW ရဲ့ signature interaction ဖြစ်ရမယ် (AJAX ထက် ဆင့်ကဲပြီးသား)။
5. Feature တိုင်း — "ဘာကြောင့် ဒါက တခြားမှာ မရှိသေးတာလဲ" ဆိုတာ ဖြေနိုင်ရမယ်။

---

## 6.5 Market Reality — founder ruling (2026-09-06) ⚠️

> **ဒါက product ဆုံးဖြတ်ချက်တိုင်းကို လွှမ်းမိုးသည်။**

- **Market = မြန်မာနိုင်ငံ တစ်ခုတည်း။** Global မဟုတ်။
- မြန်မာမှာ **professional workflow နဲ့ copyright ကို ဂရုမစိုက်ဘူး**။
- လူတွေ လိုချင်တာ နှစ်ခုပဲ — **① Feature လန်းလန်း ② Result**

### ဒါကြောင့် ဖြုတ်လိုက်သည် (cut, v1+)
| ဖြုတ်လိုက်သည် | အကြောင်းရင်း |
|---|---|
| Identity Passport (consent enforcement) | compliance ကို ဘယ်သူမှ မတန်ဖိုးထား |
| C2PA / Provenance Ledger | ထို့အတူ |
| Cultural Integrity **validator** | ethics-driven။ *(costume **library** ကတော့ ကျန်တယ် — result ဖြစ်လို့)* |
| Zero-Knowledge Client Vault | ဈေးပိုတောင်းလို့ မရ |
| Job Economics Panel | business tool — "လန်း" မဟုတ် |
| Set Probe / Live Viewfinder | pro-photographer အတွက်လွန်း |
| Model Release Generator | ထို့အတူ |

### ဒါကြောင့် ဦးစားပေးသည် (elevated)
- **Speed** — room ၅ ခု ဖြတ်ခိုင်းတာ မလုပ်ရ။ တစ်ချက်နှိပ် → ရလဒ်
- **Emotional payload** — မျှဝေချင်စိတ် ဖြစ်စေတဲ့ ရလဒ်
- **Motion** — ပုံ → video (Facebook Reels)
- **Myanmar content moat** — ဝတ်စုံ / နေရာ / ပွဲလမ်း / **စာလုံး**
- **Distribution** — Messenger/Viber က website ထက် အရေးကြီးနိုင်

---

## 6.6 Product Model — founder ruling (2026-09-06) ⚠️

> အသေးစိတ် → [docs/03-STRATEGY.md](docs/03-STRATEGY.md)

- SHOW က **AJAX လိုပဲ** သွားမည် (တူညီသော ဈေးကွက်၊ တူညီသော အမျိုးအစား)
- **Prompt ကို ဦးစားပေး** — prompt craft က product ၏ အဓိက
- **Image generation = premium members only**
- **အဓိကရည်ရွယ်ချက် = AJAX ကို ပြိုင်ရန်**

**ဆက်စပ်လာသော ဆုံးဖြတ်ချက်များ:**
- Prompt tool အားလုံး **အခမဲ့၊ အမြဲတမ်း** (cost နည်းလို့ ခံနိုင်သည် — LLM call ~$0.001 vs image ~$0.03–0.15)
- Activation fee **မရှိ** (AJAX = 50,000 MMK — သူ့ရဲ့ အားနည်းချက်အကြီးဆုံး)
- Payment **အလိုအလျောက်၊ ၁ မိနစ်** (AJAX = Founder manual approval)
- **BYO tool** — ကိုယ့် MidJourney / ComfyUI / Draw Things / ChatGPT ဆီ ပို့ပေး
- ဈေးကွက်ကို ချဲ့သည်: photographer သာမက **AI နဲ့ ပုံလုပ်တဲ့ လူတိုင်း**

---

## 7. Open Decisions (ဆုံးဖြတ်ရန် ကျန်)

- [x] ~~Frontend framework~~ → **Next.js 16 App Router + TypeScript strict** (2026-09-07)
- [x] ~~Rust vs Go~~ → **Rust** (WASM code-sharing အတွက်) (2026-09-07)
- [x] ~~Target market~~ → **မြန်မာ တစ်ခုတည်း** (2026-09-06)
- [x] ~~Display/accent typeface~~ → **မလို** — Plus Jakarta Sans ရဲ့ weight 200/300/500/800
      ကွာဟမှုနဲ့ hierarchy ဆောက်။ မြန်မာစာ = Padauk (2026-09-07)
- [ ] Feature scope for v1
- [ ] ~~Monetisation model~~ → **ရွှေ့ထား** — app အရင်ဆောက်မည် (founder, 2026-09-07)
- [ ] Messenger bot ကို v1 မှာ ထည့်မလား

### Product & theme ruling (2026-09-07)
- ဒါက **web app** — landing page မဟုတ် (founder correction)
- Theme: **Dark default = Black + Gold**၊ Light က optional/switchable

### Marketing ruling (2026-09-07)
- AJAX ကို **နာမည်တပ် နှိုင်းယှဉ်ခြင်း မပြု**
- ကိုယ်ပိုင် UI အရည်အသွေးနဲ့သာ သာလွန်ကြောင်း ပြမည်
- ⇒ `docs/03-STRATEGY.md` ရဲ့ §3 ဇယားက **internal only**၊ public copy မဟုတ်

---

## 10. လက်ရှိ တည်ဆောက်ပြီးသား (2026-10-01 — section ၁၃ ခုလုံး)

| | |
|---|---|
| `web/` | Next.js 16 · TS strict · Tailwind v4 · Turbopack |
| `web/src/app/globals.css` | Design token အပြည့် (§`docs/04-DESIGN-SYSTEM.md`) |
| `web/src/components/Reveal.tsx` | ★ **The Reveal** — signature interaction |
| `web/src/lib/useImageAccent.ts` | ဓာတ်ပုံကနေ accent ဆွဲထုတ်ခြင်း |
| `web/src/lib/useTheme.ts` | auto / light / dark |
| `web/src/components/AppShell.tsx` | app shell — bottom tabs / left rail |
| `web/src/components/Studio.tsx` | ★ **Studio** — mode ၇ ခု → compiled prompt |
| `web/src/components/Reverse.tsx` | ★ **Reverse** — ပုံကနေ prompt ပြန်ထုတ် |
| `web/src/components/Library.tsx` | ★ **Library** — version graph + word diff |
| `web/src/lib/library.ts` | ★ Prompt Git — save/branch/diff (localStorage) |
| `web/src/components/PromptDock.tsx` | Studio · Reverse မျှသုံးသော dock (+ save) |
| `web/src/components/Grade.tsx` | ★ **Grade** — tone · colour · curves, device-side |
| `web/src/lib/grade.ts` | grade engine — monotone curve LUT, pipeline, histogram, `.cube` |
| `web/src/components/Curves.tsx` | curve editor (touch · keyboard) |
| `web/src/components/DropZone.tsx` | Reverse · Grade မျှသုံးသော photo drop |
| `web/scripts/grade.check.mts` | engine check — `npm run check:grade` |
| `web/src/components/Batch.tsx` · `lib/series.ts` | ★ **Batch** — look တစ်ခု shoot တစ်ခုလုံး · **Series Coherence** (ကွဲနေတဲ့ပုံ + ပြင်ပေးချက်) · auto-cull (ဝါး/ပြင်း/ထပ်) · .zip |
| `web/src/components/Restore.tsx` · `lib/restore.ts` | ★ **Restore** — ဖုန်မှုန့်/ခြစ်ရာ/မှေးမှိန် device-side · ပြင်တဲ့ pixel ကို ရွှေရောင်နဲ့ ပြ · colourise/Living Memory = premium |
| `web/src/components/Harmonize.tsx` · `lib/composite.ts` | ★ **Harmonize** — colour match · light wrap · contact shadow · rim · fog/rays · mode ၁၂ · ၄ မျိုး ရွေး · plain backdrop key-out |
| `web/src/components/Background.tsx` · `lib/backdrops.ts` | ★ **Background** — Backdrop Wall မြန်မာ့နေရာ ၄၆ · time-of-day slider · light match · shot estimate · inpaint prompt |
| `web/src/components/Baby.tsx` · `lib/baby.ts` | ★ **Baby** — theme ၃၂ (မြန်မာ pack ၁၀) · preview drawer · consent gate |
| `web/src/components/Album.tsx` · `lib/album.ts` · `lib/layout.ts` · `lib/myanmar.ts` | ★★★ **Album / Myanmar Text Engine** — ဖိတ်စာ/cover/spread/ဈေးနှုန်း/promo/testimonial · **Zawgyi→Unicode** · ဝဏ္ဏအလိုက် line break · မြန်မာဂဏန်း · spread auto-layout (ခေါက်ရာမကျ၊ မဖြတ်) |
| `web/src/components/Event.tsx` · `EventWall.tsx` · `lib/event.ts` | ★ **Event** — guest QR · filename code နဲ့ auto-assign · watch folder · look+logo auto · quality flag · live wall ၅ မျိုး · 4×6 print · QR ကတ် print · guest .zip |
| `web/src/components/Work.tsx` · `lib/vault.ts` | ★ **Work** — IndexedDB vault · export တိုင်း auto-save · trash/restore · bulk .zip |
| `web/src/components/Portfolio.tsx` · `lib/portfolio.ts` | ★ **Portfolio** — တကယ့် static site (.zip) · OG share card 1200×630 · phone/desktop live preview |
| `web/src/components/Generate.tsx` · `lib/premium.ts` | premium generate seam — `NEXT_PUBLIC_SHOW_API` → `POST /v1/generate` · seed pinning · ရလဒ် ၄ ခု · The Wait |
| `web/src/lib/compile.ts` (Edit) | img2img / inpaint dialect ၅ ခုလုံး — ComfyUI workflow အပြည့် (LoadImage→VAEEncode(ForInpaint)→KSampler→Save) |
| `web/scripts/engines.check.mts` | engine check ၅၀+ — `npm run check:engines` (restore · series · composite · Myanmar text · layout · zip) |
| `web/src/lib/analyze.ts` | ★ device-side image measurement |
| `web/src/lib/sections.ts` | section မြေပုံ ၁၃ ခု (direct / fix / deliver) |
| `web/src/lib/catalogue.ts` | mode ၇ ခုစီရဲ့ decision catalogue |
| `web/src/lib/compile.ts` | ★ **Prompt Compiler** — dialect ၅ ခု, mode-aware |
| `web/src/app/page.tsx` | app entry |

**စစ်ဆေးပြီး:** `tsc --noEmit` ✓ · `eslint` ✓ · `next build` ✓ · mobile 375px ✓ · desktop 1280px ✓ · keyboard ✓ · light/dark ✓ · မြန်မာ mode ✓

**Reverse မှာ တကယ် တိုင်းတာနိုင်တာ (device-side, mock မဟုတ်):**
aspect · exposure key (mean luma) · contrast (σ) · light direction (L−R / T−B) ·
colour temperature (R−B) · saturation (mean S) · depth of field (centre/edge Laplacian) · palette

**မတိုင်းနိုင်သေးတာ (model pass လိုသည် — UI မှာ ရိုးရိုးသားသား ဖော်ပြထား):**
subject · wardrobe · pose · place

### Backend — `server/` (Rust · axum · SQLite) (2026-10-01)

| | |
|---|---|
| `server/src/auth.rs` | ဖုန်း/email login · argon2id · HttpOnly session cookie (token ကို SHA-256 ပဲ သိမ်း) |
| `server/src/generate.rs` · `provider.rs` | `POST /v1/generate` — member only · ရလဒ် ၄ ခု · seed pin · fail ရင် မဖြတ် · provider: `dev` / `openai` / `comfyui` |
| `server/src/portfolio.rs` | `PUT /v1/portfolio/{handle}` → `/@handle/` တကယ့် public page · og:image absolute rewrite · zip path စစ် |
| `server/src/events.rs` | event + guest + photo sync → `/e/{event}/{code}` guest gallery · Save all zip |
| `server/tests/api.rs` | HTTP အပြည့် integration test — `cargo test` |
| `web/src/lib/account.ts` · `components/Account.tsx` | bar ထဲက sign in / အကောင့်သစ် sheet |

| `server/src/models.rs` · `refine.rs` · `firebase.rs` | **OpenRouter** — Nano Banana Pro (`google/gemini-3-pro-image`) · GPT Image 2.5 Sunburst (`openai/gpt-image-2.5-sunburst`) · Refine with AI (`openai/gpt-4.1`, account တစ်ခု တစ်ရက် ၁၂၀) · **Firebase Auth** ID token စစ်ပြီး SHOW session |
| `web/src/components/Create.tsx` | ★ **Create** — model ရွေး · craft/refine prompt prefill · ၁–၄ ပုံ · film-develop wait · Edit (စကား + reference ပုံ) · before/after Reveal · Save to device |
| `web/src/components/PromptDock.tsx` | Prompt ကူးမည် · **Image ထုတ်မည်** · စာကြည့်တိုက်ထဲ သိမ်းမည် · **Refine with AI** (မူရင်း/AI ပြောင်းကြည့်) |
| `web/src/lib/firebase.ts` | Google · ဖုန်း OTP (09… → +959…) · email — SDK ကို sign-in sheet ဖွင့်မှ load |

Product ruling (2026-10-01): system ၂ မျိုး — **prompt** (craft + AI refine, အခမဲ့) နဲ့ **image generation** (member)။ API = **OpenRouter**။ Login = **Firebase**။

Membership: pricing မဆုံးဖြတ်ရသေးလို့ `cargo run -- grant <login> <days>` နဲ့ လက်နဲ့ ပေး။

**ချိတ်ပြီးသား:** ပုံထုတ်ခြင်း · portfolio publish · guest QR gallery (desk ကနေ auto-sync)။
**မလုပ်ရသေး:** payment · Messenger delivery · face search (Python model service အဖြစ် စီစဉ်) · Print-to-door · login/guest-code rate limit။

⚠️ `web/public/demo/*.jpg` သည် **placeholder** (Lorem Picsum) — SHOW ကိုယ်ပိုင် ဓာတ်ပုံနဲ့ လဲရမည်

---

## 8. Reference — AJAX CLICK AI STUDIO (benchmark ကို လေ့လာထားချက်)

### 8.1 ရှိပြီးသား (confirmed shipped)
- Room ၁၇ ခု: Persona, Beauty, Fashion, Background Change, Manipulate Studio, Creative Director, Finalize, Composite Harmonizer, Baby Studio, Old Photo Restore, Skin Retouch, Batch Studio, Cinematic Prompt Studio, Event Photo Desktop, Album Designer, Collection, Exhibition
- Workflow: `Reception → Persona → Fashion → Art Director → Finalize → Collection → Exhibition`
- Creative Context — session အတွင်း ဆုံးဖြတ်ချက် သယ်ဆောင်
- Prompt output ၃ မျိုး: Natural / Positive-Negative / Weight Syntax
- Draw Things local bridge (0 CU) + Cloud generate
- CU pricing per room-mode (0.33 – 4.49 CU)
- Fail ရင် မဖြတ် / balance မလောက်ရင် block
- Myanmar Costume Gallery (costume reference image + era prompt)
- Event Photo: per-guest QR gallery, Watch Folder, live wall, print queue
- Bilingual (MM/EN) guide + Help Centre (answer sheet ၈ ခု, FAQ ၈၉ ခု)
- Before/After slider (keyboard accessible)

### 8.2 ကြေညာထားပေမယ့် အတည်မပြုနိုင် (FAQ မှာ "may be available")
Team workspace, Projects/version history, Image-to-video & storyboard, Developer API, Free/Creator/Pro/Lifetime tiers, live chat, courses, 2FA

### 8.3 AJAX ရဲ့ အားနည်းချက် — SHOW ရဲ့ အခွင့်အလမ်း
| AJAX အားနည်းချက် | SHOW အခွင့်အလမ်း |
|---|---|
| Payment က manual Founder approval | automated, instant |
| Pricing page နဲ့ FAQ tier မကိုက် | ရှင်းလင်းသော တစ်ခုတည်းသော pricing truth |
| Exhibition မှာ public link မရ | real, shareable, SEO-able presentation |
| Prompt-centric (Finalize မှာ prompt ထုတ်) | **prompt-less / parametric** — prompt က implementation detail ဖြစ်သင့် |
| Room တွေ သီးခြားစီ | တစ်ခုတည်းသော non-destructive document model |
| Draw Things bridge က Terminal + Node.js လို | zero-install local compute |
| Result တစ်ခုပဲပြန်၊ history မရှိ | branchable history |
| Identity "lock" ကို ကတိပေးပေမယ့် **တိုင်းတာပြမပေး** | measurable identity retention score |
| Cultural gallery ရှိပေမယ့် **validator မရှိ** | cultural integrity engine |

---

## 9. Next Step

→ Feature ideation session (novel + latent-need features)
→ ရလဒ်ကို `docs/02-FEATURES.md` မှာ သီးသန့် မှတ်တမ်းတင်မည်
