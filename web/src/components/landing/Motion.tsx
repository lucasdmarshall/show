"use client";

import { useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
  type MotionValue,
} from "motion/react";

/* ------------------------------------------------------------------
   The landing page's scroll choreography. Every piece reads the
   scroll position; none of them hijack it — the page always scrolls
   at the reader's speed, and reduced motion gets the still version.
   ------------------------------------------------------------------ */

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * `value` mapped from [a, b] to [from, to], clamped — through a function,
 * so motion keeps it on its own frame loop. (Mapped by range, it may hand
 * the work to a native scroll timeline, which measures the animated
 * element rather than the section that was asked for.)
 */
function useRange(value: MotionValue<number>, [a, b]: [number, number], [from, to]: [number, number]) {
  return useTransform(value, (v) => from + (to - from) * Math.min(1, Math.max(0, (v - a) / (b - a))));
}

/** A gold hairline across the top: how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  return <motion.div className="lprogress" style={{ scaleX: x }} aria-hidden="true" />;
}

/**
 * Words that drift along, faster and leaning as the page is scrolled
 * faster, and turning round when the scroll does.
 */
export function VelocityMarquee({ children, base = 2.4 }: { children: React.ReactNode; base?: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const v = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(v, [-2000, 0, 2000], [-5, 0, 5], { clamp: false });
  const skew = useTransform(v, [-2500, 2500], [8, -8]);
  const dir = useRef(1);
  const pos = useTransform(x, (n) => `${wrap(-50, 0, n)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const b = boost.get();
    if (b < -0.05) dir.current = -1;
    else if (b > 0.05) dir.current = 1;
    x.set(x.get() - dir.current * base * (delta / 1000) * (1 + Math.abs(b)));
  });

  return (
    <div className="marquee" aria-hidden="true">
      <motion.div className="marquee__track" style={{ x: pos, skewX: reduce ? 0 : skew }}>
        {children}
        {children}
      </motion.div>
    </div>
  );
}

function Word({ p, range, children }: { p: MotionValue<number>; range: [number, number]; children: string }) {
  /* through a function, so it stays on motion's own frame loop rather
     than a native scroll timeline that measures the word, not the section */
  const k = useTransform(p, (v) => Math.min(1, Math.max(0, (v - range[0]) / (range[1] - range[0]))));
  const opacity = useTransform(k, (v) => 0.12 + v * 0.88);
  const y = useTransform(k, (v) => (1 - v) * 8);
  const blur = useTransform(k, (v) => `blur(${(1 - v) * 6}px)`);
  return (
    <motion.span className="words__w" style={{ opacity, y, filter: blur }}>
      {children}
    </motion.span>
  );
}

/** A statement pinned in place while its words light up, one by one. */
export function ScrollWords({ text, my, gold = [] }: { text: string; my: boolean; gold?: string[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const words = text.split(" ");
  return (
    <section ref={ref} className="words" style={{ height: reduce ? "auto" : `${Math.max(220, words.length * 9)}vh` }}>
      <div className="words__pin">
        <p className={`words__text ${my ? "my" : ""}`}>
          {words.map((w, i) => {
            const at = i / words.length;
            const node = reduce ? (
              <span className="words__w">{w}</span>
            ) : (
              <Word p={scrollYProgress} range={[at * 0.85, at * 0.85 + 0.12]}>
                {w}
              </Word>
            );
            return (
              <span key={i} className={gold.includes(w.replace(/[.,—]/g, "")) ? "words__gold" : undefined}>
                {node}{" "}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}

/** Drifts against the scroll — a different depth for each `speed`. */
export function Parallax({ speed, children, className }: { speed: number; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useRange(scrollYProgress, [0, 1], [speed * 90, -speed * 90]);
  return (
    <motion.div ref={ref} className={className} style={{ y: reduce ? 0 : y }}>
      {children}
    </motion.div>
  );
}

/**
 * Uncovered from the bottom edge, the picture settling as it comes.
 * The clip lives on the child: clipping the observed element itself
 * makes its intersection ratio 0, so the reveal never starts.
 */
export function ClipReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="clipreveal">{children}</div>;
  return (
    <motion.div className="clipreveal" initial="closed" whileInView="open" viewport={{ once: true, amount: 0.2 }}>
      <motion.div
        variants={{
          closed: { clipPath: "inset(100% 0% 0% 0%)", scale: 1.18 },
          open: { clipPath: "inset(0% 0% 0% 0%)", scale: 1 },
        }}
        transition={{ duration: 1.6, ease: EASE, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Tips up out of the page as it scrolls in. */
export function TiltIn({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useRange(scrollYProgress, [0, 1], [28, 0]);
  const scale = useRange(scrollYProgress, [0, 1], [0.86, 1]);
  const opacity = useRange(scrollYProgress, [0, 0.5], [0, 1]);
  return (
    <div className="tilt" ref={ref}>
      <motion.div className={className} style={reduce ? undefined : { rotateX, scale, opacity, transformPerspective: 1200 }}>
        {children}
      </motion.div>
    </div>
  );
}

/** A sticky number that grows and turns as its group scrolls past. */
export function GroupNumber({ n }: { n: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useRange(scrollYProgress, [0, 0.5], [0.55, 1]);
  const rotate = useRange(scrollYProgress, [0, 0.5], [-12, 0]);
  return (
    <motion.span ref={ref} className="fgroup__n" style={reduce ? undefined : { scale, rotate, originX: 0, originY: 1 }}>
      {n}
    </motion.span>
  );
}

/** A gold line beside a group, drawn down as the group is read. */
export function Rail() {
  const ref = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  return <motion.span ref={ref} className="rail" style={{ scaleY: scrollYProgress }} aria-hidden="true" />;
}

/** The three steps, held on screen; scrolling moves through them. */
export function PinnedSteps({ steps, my }: { steps: { title: string; text: string }[]; my: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(steps.length - 1, Math.floor(v * steps.length * 0.999))));
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  if (reduce) {
    return (
      <ol className="how__steps">
        {steps.map((s, i) => (
          <li key={s.title} className="step">
            <span className="step__n">{i + 1}</span>
            <h3 className={`step__title ${my ? "my" : ""}`}>{s.title}</h3>
            <p className={`step__text ${my ? "my" : ""}`}>{s.text}</p>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div ref={ref} className="pin" style={{ height: `${steps.length * 90 + 40}vh` }}>
      <div className="pin__stage">
        <div className="pin__big" aria-hidden="true">
          {steps.map((_, i) => (
            <motion.span
              key={i}
              className="pin__n"
              animate={{ opacity: active === i ? 1 : 0, y: active === i ? "0%" : active > i ? "-40%" : "40%", scale: active === i ? 1 : 0.8 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              {i + 1}
            </motion.span>
          ))}
        </div>
        <ol className="pin__list">
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              className="pin__step"
              animate={{ opacity: active === i ? 1 : 0.22, x: active === i ? 0 : 18 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <span className="pin__idx t-micro">0{i + 1}</span>
              <h3 className={`step__title ${my ? "my" : ""}`}>{s.title}</h3>
              <motion.p
                className={`step__text ${my ? "my" : ""}`}
                animate={{ height: active === i ? "auto" : 0, opacity: active === i ? 1 : 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                style={{ overflow: "hidden" }}
              >
                {s.text}
              </motion.p>
            </motion.li>
          ))}
        </ol>
        <div className="pin__track" aria-hidden="true">
          <motion.span style={{ scaleX: line }} />
        </div>
      </div>
    </div>
  );
}

function Letter({ p, i, n, ch }: { p: MotionValue<number>; i: number; n: number; ch: string }) {
  const start = (i / n) * 0.45;
  const k = useRange(p, [start, start + 0.55], [0, 1]);
  const y = useTransform(k, (v) => `${(1 - v) * 105}%`);
  const rotate = useTransform(k, (v) => (1 - v) * 12);
  return (
    <span className="finale__mask">
      <motion.span className="finale__ch" style={{ y, rotate }}>
        {ch}
      </motion.span>
    </span>
  );
}

/** SHOW, rising out of the floor one letter at a time. */
export function RisingMark({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const spacing = useTransform(useRange(scrollYProgress, [0, 1], [0.3, 0.06]), (v) => `${v}em`);
  const chars = [...text];
  return (
    <motion.p ref={ref} className="finale__mark" aria-label={text} style={reduce ? undefined : { letterSpacing: spacing }}>
      {chars.map((c, i) =>
        reduce ? (
          <span key={i} className="finale__ch">
            {c}
          </span>
        ) : (
          <Letter key={i} p={scrollYProgress} i={i} n={chars.length} ch={c} />
        ),
      )}
    </motion.p>
  );
}

/** The hero, leaving: the water shrinks into a card while the headline parts. */
export function useHeroExit(target: React.RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.3 });
  const stage = {
    scale: useTransform(p, [0, 1], [1, 0.82]),
    borderRadius: useTransform(p, [0, 1], [0, 40]),
    filter: useTransform(p, [0, 1], ["brightness(1)", "brightness(0.45)"]),
  };
  const left = useTransform(p, [0, 1], ["0%", "-22%"]);
  const right = useTransform(p, [0, 1], ["0%", "22%"]);
  const fade = useTransform(p, [0, 0.7], [1, 0]);
  const lift = useTransform(p, [0, 1], [0, 140]);
  return reduce
    ? { stage: undefined, lines: [undefined, undefined], text: undefined }
    : { stage, lines: [left, right] as MotionValue<string>[], text: { opacity: fade, y: lift } };
}
