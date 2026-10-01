# SHOW — Design System

> v0.1 · 2026-09-06 · Premium Luxury · Mobile-first · Awwwards-target

---

## 0. အခြေခံ နိယာမ

### "Black & Gold" — founder ruling, 2026-09-07
**Dark က default။ Black + Gold။ Light က optional, switchable။**

Gold ကို **hairline နဲ့ စာလုံးအသေးမှာသာ** သုံးသည် — card အပြည့် ဖြည့်ခြင်း မပြု။
နောက်ခံက charcoal မဟုတ်၊ **true black** (`#08080A`, canvas well က `#000`)။

> ⚠️ ဓာတ်ပုံကနေ ဆွဲထုတ်တဲ့အရောင်ကို ဖျက်မပစ်ဘဲ `--image-accent` အဖြစ် **အဆင့်လျှော့ထား** —
> ဓာတ်ပုံနဲ့ဆိုင်တဲ့ surface (histogram, stage marker) မှာသာ သုံးပြီး brand gold နဲ့ မပြိုင်စေရ။

### Luxury = ချုပ်တည်းမှု၊ များပြားမှု မဟုတ်
- Motion နည်းနည်း၊ ဒါပေမယ့် **လေးလံ**ရမယ် (600–900ms, expo ease)
- Border/box လျှော့ — **negative space နဲ့ type weight** နဲ့ hierarchy ဆောက်
- Radius သေးသေး (crisp), bubbly မဟုတ်
- Gradient မသုံး (ဓာတ်ပုံနဲ့ ပြိုင်လို့)
- Shadow ကို depth အတွက်သာ၊ decoration အတွက် မဟုတ်

---

## 1. Colour Tokens

### 1.1 Dark — default
```
--bg          #08080A   အခြေခံ (true black, အနည်းငယ် အေး)
--bg-sunken   #000000   canvas well — ဓာတ်ပုံက ဘာမှမရှိတဲ့အပေါ် ထိုင်ရမယ်
--surface     #101014   panel / chip
--surface-2   #17171C   raised / selected
--surface-3   #202027   hover
--line        #FFFFFF 7%
--line-strong  gold 30%   ← အလေးပေးရာမှာ gold hairline
--ink         #F2EFE9   warm off-white (pure white မသုံး)
--ink-2       #9C978E
--ink-3       #625E58

--gold        #D4A22F   ★ brand accent
--gold-soft   #F0C75E   hover
--gold-deep   #8A6A17   pressed
--gold-ink    #08080A   gold ပေါ်က စာသား
--gold-glow    gold 14%  inner shadow / glow သာ

--accent      = --gold
--image-accent = --gold (ဓာတ်ပုံရှိမှ override)
```
`#D4A22F` on `#08080A` ≈ **8.0 : 1** — body text အတွက်ပင် လုံလောက်သည်။

### 1.2 Light — opt-in, switchable
```
--bg #FAF9F6 · --bg-sunken #EFECE4 · --surface #FFFFFF
--surface-2 #F7F5F0 · --surface-3 #EFECE4
--ink #14130F · --ink-2 #5A564D · --ink-3 #8E8A80
--gold #8A6A17 · --gold-soft #A8842A · --gold-deep #5E4708 · --gold-ink #FAF9F6
```
> Light မှာ gold ကို **နက်အောင်** ချရသည် — မဟုတ်ရင် အဖြူပေါ်မှာ contrast မရ။

### 1.3 Gold ကို ဘယ်လိုသုံးရမလဲ (အရေးအကြီးဆုံး စည်းမျဉ်း)
| ✅ သုံးရမည် | ❌ မသုံးရ |
|---|---|
| Hairline (1px border, divider, active underline) | Card / panel နောက်ခံ အပြည့် |
| Micro-label, နံပါတ်, ရွေးထားသော chip ရဲ့ ဘောင် | Body စာသား တစ်ပိုဒ်လုံး |
| အဓိက CTA တစ်ခုတည်း (တစ်မျက်နှာမှာ တစ်ခု) | ခလုတ်တိုင်း |
| Nav ရဲ့ လက်ရှိနေရာ မှတ်သား | Gradient / metallic texture |
| Focus ring | Icon အားလုံး |

### 1.4 Functional (status သာ — brand မဟုတ်)
```
--ok #4A8F5E · --warn #B08A3E · --err #B4453A
```

### 1.5 `--image-accent` — ဓာတ်ပုံကနေ ဆွဲထုတ်ခြင်း
`lib/useImageAccent.ts` — 32×32 downsample → HSL → chroma အမြင့်ဆုံး ⅓ ရဲ့ hue ကို
vector အဖြစ် ပျမ်းမျှ → S ≤ 0.42, L = dark 0.78 / light 0.42 အဖြစ် clamp။
Chroma < 0.06 ဆို gold ကို ပြန်သုံး။
**ဓာတ်ပုံနှင့်ဆိုင်သော surface (histogram, stage marker, compare) မှာသာ** သုံးရမည်။

---

## 2. Typography — Plus Jakarta Sans

### 2.1 Weights
| Weight | သုံးရာ |
|---|---|
| 200 ExtraLight | Display heading (ကြီးကြီး) သာ |
| 300 Light | Sub-display, quote |
| 500 Medium | Body, UI label |
| 800 ExtraBold | Micro-label (uppercase, tracked), နံပါတ် |

> 400 နဲ့ 600 **မသုံး** — weight ကွာဟမှု ကြီးမှ luxury ဖြစ်တယ်။

### 2.2 Scale (fluid, mobile-first)
```
--t-display  clamp(2.75rem, 11vw, 7.5rem)   w200  lh 0.94  ls -0.04em
--t-h1       clamp(2rem,  7vw,  4rem)       w200  lh 1.02  ls -0.03em
--t-h2       clamp(1.5rem, 4.5vw, 2.5rem)   w300  lh 1.10  ls -0.02em
--t-h3       clamp(1.15rem, 3vw, 1.5rem)    w500  lh 1.25  ls -0.01em
--t-body     clamp(0.9375rem, 2.2vw, 1rem)  w500  lh 1.70  ls  0
--t-small    0.8125rem                      w500  lh 1.55  ls  0
--t-micro    0.6875rem                      w800  lh 1.0   ls  0.18em  UPPERCASE
```

### 2.3 မြန်မာစာ
- Fallback: **Pyidaungsu** → **Padauk** → `Noto Sans Myanmar`
- မြန်မာစာက Latin ထက် အမြင်အားဖြင့် သေးတယ် → `font-size-adjust` သို့ +6% size bump
- Line-height ပိုလို: မြန်မာ body = **1.9** (Latin 1.7)
- `--t-micro` ရဲ့ letter-spacing ကို မြန်မာမှာ **မသုံး** (တွဲရေး ပျက်တယ်)

---

## 3. Space & Layout

### 3.1 Scale (4px base)
```
0.5→2px  1→4  2→8  3→12  4→16  5→20  6→24  8→32
10→40  12→48  16→64  20→80  24→96  32→128  40→160
```

### 3.2 Section rhythm
```
--section-y   clamp(4rem, 12vw, 10rem)     ပုံမှန်
--section-y-l clamp(6rem, 18vw, 15rem)     hero / အသက်ပြင်း
--gutter      clamp(1.25rem, 5vw, 3.5rem)
--max-w       1440px
--max-read    68ch
```

### 3.3 Mobile-first ဥပဒေ
- Touch target **အနည်းဆုံး 44×44px**
- အဓိက action က **thumb zone** (အောက် ⅓) မှာ ရှိရမယ်
- Tab ကို ရှောင် → single scroll + sticky section nav
- Horizontal scroll က **body မှာ ဘယ်တော့မှ မဖြစ်ရ** — overflow container ထဲမှာသာ
- Sticky bottom bar က အဓိက CTA အတွက် (safe-area-inset ဂရုစိုက်)

---

## 4. Radius / Elevation / Grain

```
--r-xs   2px    tag, chip
--r-sm   6px    button, input
--r-md   10px   card
--r-lg   16px   panel, sheet
--r-full 999px  avatar, pill
```

**Elevation** — shadow ၃ ဆင့်သာ၊ depth အတွက်သာ:
```
--e1  0 1px 2px rgb(0 0 0 / .28)
--e2  0 8px 24px -8px rgb(0 0 0 / .45)
--e3  0 24px 64px -16px rgb(0 0 0 / .55)
```

**Grain** — `2%` opacity SVG noise overlay, `mix-blend-mode: overlay`၊
ဓာတ်ပုံ canvas ပေါ်မှာ **မတင်ရ** (ဓာတ်ပုံရဲ့ texture ကို ညစ်စေတယ်)

---

## 5. Motion

### 5.1 Easing
```
--ease-out   cubic-bezier(.16, 1, .3, 1)      ★ အဓိက (expo out)
--ease-in-out cubic-bezier(.65, 0, .35, 1)
--ease-soft  cubic-bezier(.25, .46, .45, .94)
```

### 5.2 Duration
```
--d-instant  120ms   hover, focus ring
--d-quick    240ms   toggle, chip
--d-base     420ms   card, panel
--d-slow     720ms   ★ page transition, reveal  (luxury က ဒီမှာ ရှိတယ်)
--d-epic     1200ms  hero entrance သာ
```

### 5.3 ဥပဒေ
- Stagger = **60ms**၊ အများဆုံး ၆ ခုသာ (ကျန်တာ တစ်ပြိုင်တည်း)
- Transform + opacity သာ animate လုပ် (layout property မလုပ်)
- `prefers-reduced-motion` → duration အားလုံး **1ms**, transform ဖျက်၊ opacity ထား
- Scroll-linked animation က `IntersectionObserver` သာ၊ scroll listener မသုံး

---

## 6. Components — v1 core

| Component | မှတ်ချက် |
|---|---|
| **Reveal** ★ | signature — layer stack scrub (§7) |
| Button | primary (accent) / ghost / quiet · min-h 44 |
| Field | label အပေါ်, hairline underline, focus = accent underline |
| Chip / Tag | r-xs, micro type |
| Card | surface, line hairline, r-md, hover → surface-2 |
| Sheet | mobile bottom sheet (drag-to-dismiss), desktop → side panel |
| Nav | mobile: sticky bottom · desktop: top hairline |
| Meter | token budget / identity match — numeric + bar |
| Canvas | image stage, pinch-zoom, achromatic surround |
| Toast | bottom, above thumb bar |

---

## 7. ★ The Reveal — signature interaction

AJAX ဆီက ယူတဲ့ တစ်ခုတည်းသော design element ရဲ့ ဆင့်ကဲပုံ။

### 7.1 အခြေခံ
Before ↔ After နှစ်ခုတည်း မဟုတ်ဘဲ **layer stack** ကို scrub လုပ်ရတယ်:
```
0%                                                        100%
│ မူရင်း │ အရိပ် │ အလင်း │ အရောင် │ အသားအရေ │ ပြီးဆုံး │
```

### 7.2 အပြုအမူ
- **Drag** — လက်တစ်ချောင်း (mobile-first)
- **Keyboard** — ← → တစ်ဆင့်စီ · Home/End
- **Scrub label** — လက်ရှိ layer နာမည် handle ဘေးမှာ ပေါ်, ရပ်ရင် fade
- **Tick marks** — layer အရေအတွက်အလိုက် hairline၊ handle က တိတိကျကျ snap လုပ်နိုင်
- **Idle hint** — ဝင်လာချိန် handle က 8% ရွေ့ပြပြီး ပြန်လာ (တစ်ခါတည်း)
- **Reduced motion** — hint မလုပ်, transition ချက်ချင်း

### 7.3 နည်းပညာ
- Layer တွေက `<canvas>` ပေါ်မှာ stack — DOM image overlay မဟုတ် (mobile မှာ ချောမွေ့ဖို့)
- Clip-path inset နဲ့ reveal, GPU composited
- Pointer Events API (touch/mouse/pen တစ်ပေါင်းတည်း)
- `touch-action: pan-y` — ဒေါင်လိုက် scroll မပိတ်ရ

### 7.4 ဒါက ဘာလို့ copy မလုပ်နိုင်လဲ
Layer stack ရှိမှ ဖြစ်တယ် — **The Negative** (semantic layer model) ရှိမှသာ။
Flat image in/out product မှာ ဒီ interaction က မဖြစ်နိုင်ဘူး။

---

## 8. Accessibility

- Contrast: body ≥ 4.5:1 · large ≥ 3:1 · focus ring ≥ 3:1
- Focus ring: `2px solid var(--accent)` + `2px` offset — **ဘယ်တော့မှ မဖျက်ရ**
- Keyboard: interactive အားလုံး reachable, tab order = visual order
- `prefers-reduced-motion` အပြည့်အဝ
- Live region: generate status, meter ပြောင်းလဲမှု
- Myanmar + English `lang` attribute မှန်ကန်စွာ

---

## 8.5 ★ Flex ဥပဒေ — မဖြစ်မနေ မှတ်ရမည်

> ဒီ bug ကို project အတွင်း **နှစ်ကြိမ်** ရှာရပြီးပြီ။

`overflow` (auto/hidden) သတ်မှတ်ထားသော element သည် flex item ဖြစ်ပါက
သူ့ရဲ့ **automatic minimum size က ၀ ဖြစ်သွားသည်**။ ဒါကြောင့် အမြင့်
သတ်မှတ်ထားသော flex container ထဲမှာ `flex-shrink: 1` (default) က
သူ့ကို ဖိချပစ်နိုင်သည် — 40px chip တွေ 0.9px ဖြစ်သွားခြင်း၊
ပုံက frame ကို ကျော်ထွက်သွားခြင်း ဖြစ်စေသည်။

**စည်းမျဉ်း:** flex container ထဲက child တစ်ခုမှာ `overflow` သတ်မှတ်ရင်
**`flex: none` ကို မဖြစ်မနေ တွဲရေးပါ** (scroll ဖြစ်စေချင်တဲ့ child မှလွဲ၍)။

```css
.thing {
  flex: none;        /* ← ဒါမပါရင် ဖိခံရမည် */
  overflow-x: auto;
}
```

---

## 9. ဘယ်တော့မှ မလုပ်ရ (anti-patterns)

| ❌ | ဘာလို့ |
|---|---|
| Gold ကို card/panel အပြည့် ဖြည့်ခြင်း | ခွဲခြားမရဖြစ်စေ — SHOW ရဲ့ gold က hairline နဲ့ small type သာ |
| Charcoal နောက်ခံ | true black သာ သုံးရမည် |
| Landing-page ဟန် | ဒါက **web app** — marketing site မဟုတ် |
| Gradient background | ဓာတ်ပုံနဲ့ ပြိုင်တယ် |
| Room card grid ကို ကူး | IA က တူသွားမယ် |
| Tab အများကြီး | mobile မှာ ဆိုးတယ် |
| Emoji icon | luxury မဟုတ် |
| Bounce / spring easing | ပေါ့ပါးတယ် |
| Pure black #000 / pure white #fff | ကြမ်းတယ်၊ warm-neutral သုံး |
| Text ပေါ်မှာ blur backdrop များများ | mobile GPU ကုန် |
