"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, type MotionValue } from "motion/react";
import { GROUP_LABEL, SECTIONS, type GroupId, type SectionDef } from "@/lib/sections";
import { DETAILS, HERO_IMAGE, SHOWCASE, UNDERNEATH } from "@/lib/landing";
import { WaterHero } from "./WaterHero";
import { Compare } from "./Compare";
import {
  ClipReveal,
  GroupNumber,
  Parallax,
  PinnedSteps,
  Rail,
  RisingMark,
  ScrollProgress,
  ScrollWords,
  TiltIn,
  VelocityMarquee,
  useHeroExit,
} from "./Motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

/* rises into place the first time it is scrolled to */
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.95, ease: EASE, delay },
});

const GROUP_LINE: Record<GroupId, { en: string; my: string }> = {
  direct: {
    en: "Decide the photograph before it exists — or read it back from one that does.",
    my: "ဓာတ်ပုံ မရှိခင် ဆုံးဖြတ် — ဒါမှမဟုတ် ရှိပြီးသားပုံကနေ ပြန်ဖတ်။",
  },
  fix: {
    en: "Repair, relight, replace, regrade. The person in it stays exactly who they are.",
    my: "ပြင်၊ အလင်းပြန်ထိုး၊ နောက်ခံပြောင်း၊ အရောင်ညှိ — ပုံထဲက လူကတော့ ဒီလူပဲ။",
  },
  deliver: {
    en: "Albums, galleries and pages — with Burmese set properly.",
    my: "အယ်လ်ဘမ်၊ gallery၊ page — မြန်မာစာ မှန်မှန်ကန်ကန်နဲ့။",
  },
};

const TIER: Record<SectionDef["tier"], { en: string; my: string }> = {
  free: { en: "Free", my: "အခမဲ့" },
  device: { en: "On device", my: "စက်ပေါ်မှာ" },
  premium: { en: "Premium", my: "Premium" },
};

const MODELS = [
  {
    name: "Nano Banana Pro",
    by: "Google · Gemini 3 Pro Image",
    en: "Composes from up to 14 references and holds a face across edit after edit. Up to 4K.",
    my: "Reference ၁၄ ပုံအထိ ပေါင်းနိုင်ပြီး ထပ်ခါထပ်ခါ ပြင်လည်း မျက်နှာ မပြောင်း။ 4K အထိ။",
  },
  {
    name: "GPT Image 2.5 Sunburst",
    by: "OpenAI",
    en: "Precision edits and fine detail — slower, and sharper for it.",
    my: "တိကျတဲ့ edit နဲ့ အသေးစိတ် ကြည်လင်မှု — နည်းနည်းကြာပေမဲ့ ပိုပြတ်သား။",
  },
];

const STEPS = [
  {
    en: ["Bring the photograph", "Your own frame, and any references — a face, an outfit, a place. Each gets a number and a job."],
    my: ["ဓာတ်ပုံ ယူလာ", "ကိုယ့်ပုံနဲ့ reference တွေ — မျက်နှာ၊ ဝတ်စုံ၊ နေရာ။ တစ်ပုံချင်း နံပါတ်နဲ့ တာဝန် ရတယ်။"],
  },
  {
    en: ["Say what changes", "Choose from nearly a thousand decisions, or just write it. Say what must not move."],
    my: ["ဘာပြောင်းမလဲ ပြော", "ရွေးစရာ ၁,၀၀၀ နီးပါးထဲက ရွေး၊ ဒါမှမဟုတ် ရေးလိုက်။ ဘာမပြောင်းရဘူးဆိုတာလည်း ပြော။"],
  },
  {
    en: ["Judge it at the seam", "Before against after, zoomed to the eyelashes. Keep it, and deliver it."],
    my: ["ကြားမျဉ်းမှာ စစ်", "Before နဲ့ After ကို မျက်တောင်အထိ ချဲ့ကြည့်။ သိမ်း၊ ပို့။"],
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="lf__icon" aria-hidden="true">
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: EASE }}
      />
    </svg>
  );
}

/** Headline lines that slide up out of a mask, one after another. */
function Lines({
  lines,
  my,
  className,
  delay = 0,
  drift = [],
}: {
  lines: string[];
  my: boolean;
  className: string;
  delay?: number;
  drift?: (MotionValue<string> | undefined)[];
}) {
  return (
    <span className={`${className} ${my ? "my" : ""}`}>
      {lines.map((l, i) => (
        <motion.span key={`${my}-${i}`} className="mask" style={{ x: drift[i] }}>
          <motion.span
            className="mask__in"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.12 }}
          >
            {l}
          </motion.span>
        </motion.span>
      ))}
    </span>
  );
}

export function Landing() {
  const [my, setMy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hero = useRef<HTMLElement>(null);
  const t = (en: string, mm: string) => (my ? mm : en);
  const cls = (base = "") => `${base} ${my ? "my" : ""}`.trim();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  /* leaving the hero: the water becomes a card, the headline parts */
  const exit = useHeroExit(hero);

  const groups: GroupId[] = ["direct", "fix", "deliver"];
  const tiers = (["free", "device", "premium"] as const).map((k) => ({ k, rooms: SECTIONS.filter((s) => s.tier === k) }));

  return (
    <div className="landing" lang={my ? "my" : "en"}>
      {/* -- nav ------------------------------------------------------- */}
      <header className="lnav" data-scrolled={scrolled || undefined}>
        <Link href="/" className="lnav__mark" aria-label="SHOW">
          SHOW
        </Link>
        <nav className="lnav__links" aria-label={t("Sections", "အပိုင်းများ")}>
          <a href="#work" className={cls()}>{t("Work", "လက်ရာ")}</a>
          <a href="#features" className={cls()}>{t("Features", "လုပ်ဆောင်ချက်")}</a>
          <a href="#how" className={cls()}>{t("How", "ဘယ်လို")}</a>
        </nav>
        <div className="lnav__end">
          <div className="seg" role="group" aria-label="Language">
            <button type="button" aria-pressed={!my} onClick={() => setMy(false)}>
              EN
            </button>
            <button type="button" className="my" aria-pressed={my} onClick={() => setMy(true)}>
              မြန်မာ
            </button>
          </div>
          <Link href="/app" className="lbtn lbtn--small">
            <span className={cls()}>{t("Open studio", "စတူဒီယို ဖွင့်")}</span>
          </Link>
        </div>
      </header>
      <ScrollProgress />

      {/* -- hero: the water ---------------------------------------------- */}
      <section ref={hero} className="hero" data-water>
        <motion.div className="hero__stage" style={exit.stage}>
          <WaterHero image={HERO_IMAGE} />
          <div className="hero__shade" aria-hidden="true" />
        </motion.div>
        <div className="hero__inner">
          <motion.p
            className={cls("hero__eyebrow t-micro")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          >
            {t("Myanmar's photo studio · with AI", "မြန်မာ ဓာတ်ပုံဆရာတွေအတွက် AI စတူဒီယို")}
          </motion.p>
          <h1 className="hero__title">
            <Lines
              key={String(my)}
              my={my}
              className="hero__lines"
              lines={my ? ["ဓာတ်ပုံတိုင်း", "ပြီးပြည့်စုံအောင်။"] : ["Photographs,", "finished."]}
              delay={0.25}
              drift={exit.lines}
            />
          </h1>
          <motion.div style={exit.text}>
          <motion.p
            className={cls("hero__sub")}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.8 }}
          >
            {t(
              "Restore, relight, replace and deliver — with Nano Banana Pro and GPT Image, and before against after at every step. The face always stays the face.",
              "ပြန်ပြင်၊ အလင်းပြန်ထိုး၊ နောက်ခံပြောင်း၊ ပို့ဆောင် — Nano Banana Pro နဲ့ GPT Image သုံးပြီး အဆင့်တိုင်းမှာ before/after ယှဉ်ကြည့်လို့ရတယ်။ မျက်နှာကတော့ မူရင်းအတိုင်း။",
            )}
          </motion.p>
          <motion.div
            className="hero__cta"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 1 }}
          >
            <Link href="/app" className="lbtn">
              <span className={cls()}>{t("Open the studio", "စတူဒီယို ဖွင့်မည်")}</span>
              <span aria-hidden="true" className="lbtn__arrow">→</span>
            </Link>
            <a href="#work" className="lbtn lbtn--ghost">
              <span className={cls()}>{t("See the work", "လက်ရာ ကြည့်မည်")}</span>
            </a>
          </motion.div>
          </motion.div>
        </div>
        <motion.p
          className={cls("hero__hint t-micro")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
        >
          <span className="hero__drop" aria-hidden="true" />
          {t("Touch the water", "ရေပြင်ကို ထိကြည့်ပါ")}
        </motion.p>
      </section>

      {/* -- marquee: leans and speeds with the scroll -------------------- */}
      <VelocityMarquee>
        <span className="marquee__run">
          {[
            ["Restore", "ပြန်ပြင်"],
            ["Relight", "အလင်းပြန်ထိုး"],
            ["Replace", "နောက်ခံပြောင်း"],
            ["Regrade", "အရောင်ညှိ"],
            ["Reunite", "ပြန်ဆုံ"],
            ["Deliver", "ပို့ဆောင်"],
          ].map(([en, mm]) => (
            <span key={en} className="marquee__item">
              <span>{en}</span>
              <span className="my">{mm}</span>
              <span className="marquee__dot">✦</span>
            </span>
          ))}
        </span>
      </VelocityMarquee>

      {/* -- the statement, lit word by word -------------------------------- */}
      <ScrollWords
        key={String(my)}
        my={my}
        gold={my ? ["မျက်နှာ", "ဓာတ်ပုံ"] : ["edit", "face", "photograph"]}
        text={t(
          "Photographers in Myanmar edit far more than they invent. So SHOW starts from the photograph you already have — and never lets a model touch the face.",
          "မြန်မာ ဓာတ်ပုံဆရာတွေက အသစ်ဖန်တီးတာထက် ပြင်တာ အများကြီး ပိုလုပ်တယ်။ ဒါကြောင့် SHOW က ကိုယ့်မှာ ရှိပြီးသား ဓာတ်ပုံကနေ စတယ် — ပြီးတော့ မျက်နှာ ကို model ကို ဘယ်တော့မှ မထိခိုင်းဘူး။",
        )}
      />

      {/* -- showcase ------------------------------------------------------- */}
      <section id="work" className="lsec showcase">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("01 — Work", "၀၁ — လက်ရာ")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t("Drag the seam.", "ကြားမျဉ်းကို ဆွဲကြည့်ပါ။")}
          </motion.h2>
          <motion.p {...rise(0.1)} className={cls("lsec__lede")}>
            {t(
              "Every result in SHOW is judged the same way: the photograph you brought on one side, what it became on the other.",
              "SHOW မှာ ရလဒ်တိုင်းကို ဒီလိုပဲ စစ်တယ် — ယူလာတဲ့ပုံ တစ်ဘက်၊ ဖြစ်လာတဲ့ပုံ တစ်ဘက်။",
            )}
          </motion.p>
        </div>
        <div className="showcase__grid">
          {SHOWCASE.map((item, i) => (
            <Parallax key={item.id} speed={[0.2, 0.9, 0.35, 0.6, 0.8, 0.3][i] ?? 0.4} className={`showcase__item showcase__item--${i + 1}`}>
            <figure className="showcase__fig">
              <ClipReveal delay={(i % 2) * 0.1}>
                <Compare item={item} my={my} />
              </ClipReveal>
              <figcaption className="showcase__cap">
                <span className="showcase__n t-micro">{String(i + 1).padStart(2, "0")}</span>
                <span className="showcase__text">
                  <span className={cls("showcase__title")}>{t(item.title, item.titleMy)}</span>
                  <span className={cls("showcase__note")}>{t(item.note, item.noteMy)}</span>
                </span>
                <a href={`#room-${item.section}`} className={cls("showcase__room t-micro")}>
                  {SECTIONS.find((s) => s.id === item.section)?.[my ? "labelMy" : "label"]}
                </a>
              </figcaption>
            </figure>
            </Parallax>
          ))}
        </div>
      </section>

      {/* -- every room ------------------------------------------------------ */}
      <section id="features" className="lsec features">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("02 — Everything in the studio", "၀၂ — စတူဒီယိုထဲမှာ ရှိသမျှ")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t(`${SECTIONS.length} rooms. Three jobs.`, `အခန်း ${SECTIONS.length} ခု။ အလုပ် ၃ မျိုး။`)}
          </motion.h2>
        </div>

        {groups.map((g, gi) => (
          <div key={g} className="fgroup">
            <motion.div className="fgroup__side" {...rise()}>
              <GroupNumber n={String(gi + 1).padStart(2, "0")} />
              <h3 className={cls("fgroup__name")}>{my ? GROUP_LABEL[g].labelMy : GROUP_LABEL[g].label}</h3>
              <p className={cls("fgroup__line")}>{t(GROUP_LINE[g].en, GROUP_LINE[g].my)}</p>
            </motion.div>
            <div className="fgroup__rooms">
              <Rail />
              {SECTIONS.filter((s) => s.group === g).map((s, i) => (
                <motion.article
                  key={s.id}
                  id={`room-${s.id}`}
                  className="room"
                  initial={{ opacity: 0, x: 80 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1, ease: EASE, delay: i * 0.04 }}
                >
                  <Icon d={s.icon} />
                  <div className="room__body">
                    <h4 className="room__name">
                      <span>{s.label}</span>
                      <span className="room__my my">{s.labelMy}</span>
                    </h4>
                    <p className={cls("room__blurb")}>{my ? s.blurbMy : s.blurb}</p>
                    <ul className="room__points">
                      {(my ? DETAILS[s.id].my : DETAILS[s.id].en).map((p) => (
                        <li key={p} className={cls()}>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <span className={cls(`room__tier room__tier--${s.tier} t-micro`)}>{t(TIER[s.tier].en, TIER[s.tier].my)}</span>
                </motion.article>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* -- underneath ------------------------------------------------------- */}
      <section className="lsec under">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("03 — Underneath every room", "၀၃ — အခန်းတိုင်းရဲ့ နောက်ကွယ်")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t("Built the way photographers work.", "ဓာတ်ပုံဆရာတွေ အလုပ်လုပ်သလို တည်ဆောက်ထားတယ်။")}
          </motion.h2>
        </div>
        <div className="under__grid">
          {UNDERNEATH.map((u, i) => (
            <motion.article
              key={u.en[0]}
              className="ucard"
              {...rise((i % 3) * 0.06)}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              <span className="ucard__n t-micro">{String(i + 1).padStart(2, "0")}</span>
              <h3 className={cls("ucard__title")}>{t(u.en[0], u.my[0])}</h3>
              <p className={cls("ucard__text")}>{t(u.en[1], u.my[1])}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* -- models ------------------------------------------------------------ */}
      <section className="lsec models">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("04 — Two image models", "၀၄ — Image model ၂ ခု")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t("Choose the hand for the job.", "အလုပ်နဲ့ ကိုက်တဲ့ model ကို ရွေး။")}
          </motion.h2>
        </div>
        <div className="models__grid">
          {MODELS.map((m) => (
            <TiltIn key={m.name} className="model">
              <span className="model__by t-micro">{m.by}</span>
              <h3 className="model__name">{m.name}</h3>
              <p className={cls("model__text")}>{t(m.en, m.my)}</p>
              <span className="model__ring" aria-hidden="true" />
            </TiltIn>
          ))}
        </div>
      </section>

      {/* -- how ---------------------------------------------------------------- */}
      <section id="how" className="lsec how">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("05 — How it goes", "၀၅ — ဘယ်လို လုပ်လဲ")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t("Three steps. No guessing.", "အဆင့် ၃ ဆင့်။ ခန့်မှန်းစရာ မလို။")}
          </motion.h2>
        </div>
        <PinnedSteps my={my} steps={STEPS.map((x) => ({ title: t(x.en[0], x.my[0]), text: t(x.en[1], x.my[1]) }))} />
      </section>

      {/* -- what it costs ------------------------------------------------------- */}
      <section className="lsec tiers">
        <div className="lsec__head">
          <motion.p {...rise()} className={cls("lsec__kicker t-micro")}>
            {t("06 — What it costs", "၀၆ — ဘယ်လောက် ကျလဲ")}
          </motion.p>
          <motion.h2 {...rise(0.05)} className={cls("lsec__title")}>
            {t("Most of it, nothing.", "အများစုက အခမဲ့။")}
          </motion.h2>
        </div>
        <div className="tiers__grid">
          {tiers.map(({ k, rooms }, i) => (
            <motion.article key={k} className={`tier tier--${k}`} {...rise(i * 0.08)}>
              <h3 className={cls("tier__name")}>{t(TIER[k].en, TIER[k].my)}</h3>
              <p className={cls("tier__line")}>
                {k === "free"
                  ? t("Prompts, the library and your public page — free, always.", "Prompt၊ စာကြည့်တိုက်၊ public page — အမြဲ အခမဲ့။")
                  : k === "device"
                    ? t("Runs on your own phone or laptop. No balance, no upload.", "ကိုယ့်ဖုန်း/laptop ပေါ်မှာ run တယ်။ Balance မလို၊ upload မလို။")
                    : t("The image models, on SHOW's servers. A failed result is never charged.", "SHOW server ပေါ်က image model တွေ။ မအောင်မြင်ရင် ငွေမဖြတ်။")}
              </p>
              <ul className="tier__rooms">
                {rooms.map((r) => (
                  <li key={r.id} className={cls()}>
                    {my ? r.labelMy : r.label}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </section>

      {/* -- the end ------------------------------------------------------------- */}
      <section className="finale">
        <motion.p {...rise()} className={cls("finale__line")}>
          {t("Bring the photograph you already have.", "ရှိပြီးသား ဓာတ်ပုံကို ယူလာခဲ့ပါ။")}
        </motion.p>
        <motion.div {...rise(0.08)}>
          <Link href="/app" className="lbtn lbtn--big">
            <span className={cls()}>{t("Open the studio — free", "စတူဒီယို ဖွင့်မည် — အခမဲ့")}</span>
            <span aria-hidden="true" className="lbtn__arrow">→</span>
          </Link>
        </motion.div>
        <RisingMark text="SHOW" />
      </section>

      <footer className="lfoot">
        <span className="t-micro">© 2026 SHOW</span>
        <span className={cls("lfoot__made")}>{t("Made for Myanmar's photographers.", "မြန်မာ ဓာတ်ပုံဆရာတွေအတွက်။")}</span>
        <Link href="/app" className="t-micro">
          {t("Studio →", "စတူဒီယို →")}
        </Link>
      </footer>
    </div>
  );
}
