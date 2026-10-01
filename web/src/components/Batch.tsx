"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUILT_IN,
  NEUTRAL,
  compilePipeline,
  renderFinal,
  useOwnLooks,
  type Look,
  type Settings,
} from "@/lib/grade";
import { centre, correction, cull, drift, measure, type Cull, type Drift, type Metrics } from "@/lib/series";
import { canvas, ctx2d, download, readImage, stem, toBlob } from "@/lib/image";
import { zip } from "@/lib/zip";
import { keep, persist } from "@/lib/vault";
import { DropZone } from "./DropZone";
import { Reveal } from "./Reveal";
import "./batch.css";

/* Thumbnails are graded at this size; export goes back to each file. */
const THUMB = 520;
/* Sharpness and duplicates need more pixels than a thumbnail has. */
const PROBE = 900;
/* Past this many frames, keeping every export in Work is opt-in. */
const KEEP_LIMIT = 60;

type Frame = {
  id: string;
  file: File;
  /** the untouched thumbnail, as a JPEG */
  base: Blob;
  baseUrl: string;
  /** after the look (and the match, when on) */
  url: string | null;
  /** measured once, on the original: focus, burst, clipping */
  probe: Pick<Metrics, "sharp" | "hash" | "clipLow" | "clipHigh">;
  /** measured after the look, before any match */
  tone: Metrics | null;
  excluded: boolean;
};

type Filter = "all" | "drift" | "cull";

const combine = (look: Settings, fix: ReturnType<typeof correction> | null): Settings =>
  fix
    ? {
        ...look,
        exposure: Math.max(-2, Math.min(2, look.exposure + fix.exposure)),
        temperature: Math.max(-1, Math.min(1, look.temperature + fix.temperature)),
        tint: Math.max(-1, Math.min(1, look.tint + fix.tint)),
        saturation: Math.max(-1, Math.min(1, look.saturation + fix.saturation)),
      }
    : look;

const tick = () => new Promise((r) => setTimeout(r, 0));

export function Batch({ my }: { my: boolean }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [ingest, setIngest] = useState<{ done: number; total: number } | null>(null);
  const [lookId, setLookId] = useState<string>("none");
  const [match, setMatch] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keepInWork, setKeepInWork] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ownLooks = useOwnLooks();
  const looks: Look[] = useMemo(
    () => [{ id: "none", name: "No look", nameMy: "Look မသုံး", settings: NEUTRAL }, ...ownLooks, ...BUILT_IN],
    [ownLooks],
  );
  const look = looks.find((l) => l.id === lookId) ?? looks[0];

  const measureGen = useRef(0);
  const paintGen = useRef(0);
  const urls = useRef(new Set<string>());
  const addInput = useRef<HTMLInputElement>(null);

  const track = (u: string) => {
    urls.current.add(u);
    return u;
  };
  const drop = (u: string | null) => {
    if (!u) return;
    URL.revokeObjectURL(u);
    urls.current.delete(u);
  };

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  /* -- ingest: thumbnail + probe per file, one at a time ----------- */
  const add = useCallback(async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setError(null);
    setIngest({ done: 0, total: list.length });
    const made: Frame[] = [];
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      try {
        const { data } = await readImage(f, PROBE);
        const m = measure(data.data, data.width, data.height);
        const t = canvas(1, 1);
        const k = Math.min(1, THUMB / Math.max(data.width, data.height));
        t.width = Math.round(data.width * k);
        t.height = Math.round(data.height * k);
        const src = canvas(data.width, data.height);
        ctx2d(src).putImageData(data, 0, 0);
        ctx2d(t).drawImage(src, 0, 0, t.width, t.height);
        const base = await toBlob(t, "image/jpeg", 0.86);
        made.push({
          id: `${f.name}-${f.size}-${f.lastModified}-${i}`,
          file: f,
          base,
          baseUrl: track(URL.createObjectURL(base)),
          url: null,
          probe: { sharp: m.sharp, hash: m.hash, clipLow: m.clipLow, clipHigh: m.clipHigh },
          tone: null,
          excluded: false,
        });
      } catch {
        failed++;
      }
      setIngest({ done: i + 1, total: list.length });
      if (i % 4 === 3) await tick();
    }
    setIngest(null);
    if (failed) setError(my ? `${failed} ပုံ ဖတ်လို့ မရပါ` : `${failed} could not be read`);
    setFrames((prev) => [...prev, ...made].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })));
  }, [my]);

  /* -- the series, measured after the look ------------------------ */
  const series = useMemo(() => {
    if (!frames.length || frames.some((f) => !f.tone)) return null;
    const ms = frames.map((f) => f.tone as Metrics);
    const c = centre(ms);
    const drifts = ms.map((m) => drift(m, c));
    const culls = cull(
      frames.map((f, i) => ({ ...ms[i], sharp: f.probe.sharp, hash: f.probe.hash, clipLow: f.probe.clipLow, clipHigh: f.probe.clipHigh })),
    );
    return { c, drifts, culls };
  }, [frames]);

  const settingsFor = useCallback(
    (i: number) => {
      const d = series?.drifts[i];
      return combine(look.settings, match && d && d.reasons.length ? correction(d) : null);
    },
    [series, look, match],
  );

  /* -- render every thumbnail through the look, then measure ------ */
  const lookKey = `${lookId}:${JSON.stringify(look.settings)}`;
  const frameKey = frames.map((f) => f.id).join("|");
  useEffect(() => {
    if (!frames.length) return;
    const gen = ++measureGen.current;
    const p = compilePipeline(look.settings);
    (async () => {
      /* a new look means a new series: forget the old measurements */
      setFrames((prev) => prev.map((x) => (x.tone ? { ...x, tone: null } : x)));
      for (const f of frames) {
        if (gen !== measureGen.current) return;
        const { data } = await readImage(f.base);
        renderFinal(data.data, p);
        const tone = measure(data.data, data.width, data.height);
        if (gen !== measureGen.current) return;
        setFrames((prev) => prev.map((x) => (x.id === f.id ? { ...x, tone } : x)));
        await tick();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, frameKey]);

  /* once measured: render the shown version, match included */
  const matchKey = series ? series.drifts.map((d) => d.score.toFixed(2)).join() : "";
  useEffect(() => {
    if (!series) return;
    const gen = ++paintGen.current;
    (async () => {
      for (let i = 0; i < frames.length; i++) {
        if (gen !== paintGen.current) return;
        const f = frames[i];
        const { data } = await readImage(f.base);
        renderFinal(data.data, compilePipeline(settingsFor(i)));
        const blob = await toBlob((() => {
          const c = canvas(data.width, data.height);
          ctx2d(c).putImageData(data, 0, 0);
          return c;
        })(), "image/jpeg", 0.86);
        if (gen !== paintGen.current) return;
        const u = track(URL.createObjectURL(blob));
        setFrames((prev) =>
          prev.map((x) => {
            if (x.id !== f.id) return x;
            const old = x.url;
            window.setTimeout(() => drop(old), 400);
            return { ...x, url: u };
          }),
        );
        if (i % 3 === 2) await tick();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey, match]);

  /* -- export: every kept frame, at full size, into one zip ------- */
  const exportAll = async () => {
    if (!series) return;
    const kept = frames.map((f, i) => ({ f, i })).filter(({ f }) => !f.excluded);
    if (!kept.length) return;
    setNotice(null);
    setExporting({ done: 0, total: kept.length });
    const toWork = keepInWork;
    if (toWork) void persist();
    const entries: { name: string; data: Blob }[] = [];
    let n = 0;
    try {
      for (const { f, i } of kept) {
        const { data } = await readImage(f.file);
        renderFinal(data.data, compilePipeline(settingsFor(i)));
        const c = canvas(data.width, data.height);
        ctx2d(c).putImageData(data, 0, 0);
        const blob = await toBlob(c, "image/jpeg", 0.93);
        const name = `${stem(f.file.name)}-show.jpg`;
        entries.push({ name, data: blob });
        if (toWork) await keep(blob, "batch", stem(f.file.name));
        setExporting({ done: ++n, total: kept.length });
        await tick();
      }
      const z = await zip(entries);
      download(z, `show-batch-${new Date().toLocaleDateString("en-CA")}.zip`);
      setNotice(
        my
          ? `${entries.length} ပုံ မူရင်းအရွယ်နဲ့ ထုတ်ပြီး${toWork ? " — Work ထဲမှာလည်း သိမ်းထား" : ""}`
          : `${entries.length} frames exported at full size${toWork ? " — also kept in Work" : ""}`,
      );
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ" : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  /* -- empty ------------------------------------------------------ */
  if (!frames.length) {
    return (
      <div className="batch batch--empty">
        <DropZone
          my={my}
          title="Bring in a whole shoot"
          titleMy="Shoot တစ်ခုလုံး ထည့်ပါ"
          sub="One look across every frame, then a check of which frames still do not match — with the fix for each. Soft frames, blown frames and burst duplicates are flagged too."
          subMy="ပုံတိုင်းပေါ် look တစ်ခုတည်း — ပြီးရင် ဘယ်ပုံတွေ မကိုက်သေးလဲ စစ်ပြီး တစ်ပုံချင်း ပြင်ပေးမယ်။ ဝါးနေတာ၊ ပြင်းလွန်းတာ၊ ထပ်နေတာတွေကိုလည်း ပြပေးမယ်။"
          busy={!!ingest}
          error={error}
          onFiles={(f) => void add(f)}
        >
          <FolderPick my={my} onFiles={(f) => void add(f)} />
        </DropZone>
        {ingest ? <Progress {...ingest} my={my} label="Reading" labelMy="ဖတ်နေသည်" /> : null}
      </div>
    );
  }

  const drifted = series ? series.drifts.filter((d) => d.reasons.length).length : 0;
  const culled = series ? series.culls.filter((c) => c.soft || c.clipped || c.duplicateOf !== null).length : 0;
  const shown = frames
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => {
      if (!series || filter === "all") return true;
      if (filter === "drift") return series.drifts[i].reasons.length > 0;
      const c = series.culls[i];
      return c.soft || c.clipped || c.duplicateOf !== null;
    });
  const openIdx = frames.findIndex((f) => f.id === open);
  const keptCount = frames.filter((f) => !f.excluded).length;

  return (
    <div className="batch">
      {/* ---------------- the look ---------------- */}
      <header className="batch__top">
        <div className="batch__looks" role="group" aria-label={my ? "Look" : "Look"}>
          {looks.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${my ? "my" : ""}`}
              aria-pressed={lookId === l.id}
              onClick={() => setLookId(l.id)}
            >
              {my ? l.nameMy : l.name}
            </button>
          ))}
        </div>

        <div className="batch__summary">
          {series ? (
            <>
              <p className={my ? "my" : "t-small"}>
                {drifted
                  ? my
                    ? `${frames.length} ပုံထဲက ${drifted} ပုံ ကျန်တာနဲ့ မကိုက်ဘူး`
                    : `${drifted} of ${frames.length} frames do not match the rest`
                  : my
                    ? `${frames.length} ပုံလုံး တစ်ဆက်တည်း ကိုက်တယ်`
                    : `All ${frames.length} frames sit together`}
              </p>
              <label className="batch__switch">
                <input type="checkbox" checked={match} onChange={(e) => setMatch(e.target.checked)} />
                <span className={my ? "my" : "t-small"}>
                  {my ? "ကွဲနေတဲ့ပုံတွေကို series နဲ့ ညှိမယ်" : "Pull drifted frames back to the series"}
                </span>
              </label>
            </>
          ) : (
            <p className={`batch__measuring ${my ? "my" : "t-small"}`}>
              {my ? "Look သက်ရောက်ပြီး တိုင်းနေသည်…" : "Applying the look and measuring…"}
            </p>
          )}
        </div>

        {series ? <Scatter frames={frames} series={series} match={match} onPick={setOpen} my={my} /> : null}

        <div className="batch__filters" role="tablist">
          {(
            [
              ["all", "All", "အားလုံး", frames.length],
              ["drift", "Drifted", "မကိုက်", drifted],
              ["cull", "Cull", "ဖယ်သင့်", culled],
            ] as [Filter, string, string, number][]
          ).map(([id, en, mm, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className="batch__filter"
              onClick={() => setFilter(id)}
            >
              <span className={my ? "my" : undefined}>{my ? mm : en}</span>
              <span className="batch__n">{n}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ---------------- the frames ---------------- */}
      {filter === "cull" ? (
        <p className={`batch__honest ${my ? "my" : "t-small"}`}>
          {my
            ? "မျက်လုံးမှိတ်နေတာကို စစ်ဖို့ model pass လိုတယ် — ဒီစက်ပေါ်မှာ မရသေးပါ။ ဝါးတာ၊ ပြင်းလွန်းတာ၊ ထပ်နေတာကိုတော့ တကယ်တိုင်းထားတယ်။"
            : "Closed eyes need a model pass, which does not run on the device yet. Focus, clipping and burst duplicates are measured for real."}
        </p>
      ) : null}

      <ul className="frames">
        {shown.map(({ f, i }) => {
          const d = series?.drifts[i];
          const c = series?.culls[i];
          return (
            <li key={f.id}>
              <Tile
                f={f}
                d={d}
                c={c}
                my={my}
                matched={match && !!d?.reasons.length}
                onOpen={() => setOpen(f.id)}
                onExclude={() =>
                  setFrames((prev) => prev.map((x) => (x.id === f.id ? { ...x, excluded: !x.excluded } : x)))
                }
                dupName={c?.duplicateOf != null ? frames[c.duplicateOf]?.file.name : undefined}
              />
            </li>
          );
        })}
      </ul>

      {/* ---------------- leave ---------------- */}
      <footer className="batch__acts">
        {exporting ? <Progress {...exporting} my={my} label="Exporting" labelMy="ထုတ်နေသည်" /> : null}
        {notice ? (
          <p className={`grade__notice ${my ? "my" : "t-small"}`} role="status">
            {notice}
          </p>
        ) : null}
        <div className="grade__row">
          <button type="button" className="btn" onClick={exportAll} disabled={!series || !!exporting || !keptCount}>
            {my ? `${keptCount} ပုံ ထုတ်မည် (.zip)` : `Export ${keptCount} (.zip)`}
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => addInput.current?.click()}>
            {my ? "ထပ်ထည့်" : "Add"}
          </button>
          <input
            ref={addInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void add([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="grade__row grade__row--quiet">
          <label className="batch__switch">
            <input type="checkbox" checked={keepInWork} onChange={(e) => setKeepInWork(e.target.checked)} />
            <span className={my ? "my" : "t-small"}>
              {my ? "Work ထဲမှာလည်း သိမ်းမယ်" : "Also keep in Work"}
              {keptCount > KEEP_LIMIT ? (my ? " — ပုံများလို့ နေရာယူမယ်" : " — a lot of storage at this size") : ""}
            </span>
          </label>
          {culled ? (
            <button
              type="button"
              className="lib__act"
              onClick={() =>
                setFrames((prev) =>
                  prev.map((x, i) => {
                    const c = series?.culls[i];
                    return c && (c.soft || c.duplicateOf !== null) ? { ...x, excluded: true } : x;
                  }),
                )
              }
            >
              {my ? "ဝါးတာ/ထပ်တာ ဖယ်မည်" : "Leave out soft & duplicates"}
            </button>
          ) : null}
          <button
            type="button"
            className="lib__act lib__act--warn"
            onClick={() => {
              frames.forEach((f) => {
                drop(f.baseUrl);
                drop(f.url);
              });
              setFrames([]);
              setNotice(null);
            }}
          >
            {my ? "အကုန် ဖယ်မည်" : "Clear"}
          </button>
        </div>
      </footer>

      {openIdx >= 0 ? (
        <Detail
          f={frames[openIdx]}
          d={series?.drifts[openIdx]}
          matched={match}
          my={my}
          onClose={() => setOpen(null)}
          onStep={(k) => {
            const j = (openIdx + k + frames.length) % frames.length;
            setOpen(frames[j].id);
          }}
        />
      ) : null}
    </div>
  );
}

/* -- pieces ------------------------------------------------------- */

function FolderPick({ my, onFiles }: { my: boolean; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("webkitdirectory", "");
  }, []);
  return (
    <>
      <button type="button" className="lib__act" onClick={() => ref.current?.click()}>
        {my ? "Folder တစ်ခုလုံး ရွေးမည်" : "Or choose a folder"}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function Progress({ done, total, my, label, labelMy }: { done: number; total: number; my: boolean; label: string; labelMy: string }) {
  return (
    <div className="batch__progress" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
      <span className={my ? "my" : "t-micro"}>
        {my ? labelMy : label} {done}/{total}
      </span>
      <div className="gen__wait">
        <span style={{ transform: `scaleX(${total ? done / total : 0})` }} />
      </div>
    </div>
  );
}

function Tile({
  f,
  d,
  c,
  my,
  matched,
  onOpen,
  onExclude,
  dupName,
}: {
  f: Frame;
  d?: Drift;
  c?: Cull;
  my: boolean;
  matched: boolean;
  onOpen: () => void;
  onExclude: () => void;
  dupName?: string;
}) {
  const flags: { en: string; my: string; kind: "drift" | "cull" }[] = [];
  if (d) for (const r of d.reasons) flags.push({ ...r, kind: "drift" });
  if (c?.soft) flags.push({ en: "soft", my: "ဝါး", kind: "cull" });
  if (c?.clipped) flags.push({ en: "clipped", my: "ပြင်းလွန်း", kind: "cull" });
  if (c && c.duplicateOf !== null) flags.push({ en: "duplicate", my: "ထပ်နေ", kind: "cull" });

  return (
    <div className="frame" data-excluded={f.excluded || undefined}>
      <button type="button" className="frame__img" onClick={onOpen} aria-label={f.file.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url ?? f.baseUrl} alt="" loading="lazy" />
        {matched ? <span className="frame__matched t-micro">{my ? "ညှိပြီး" : "matched"}</span> : null}
      </button>
      <div className="frame__meta">
        <span className="frame__name" title={dupName ? `≈ ${dupName}` : f.file.name}>
          {f.file.name}
        </span>
        <button
          type="button"
          className="frame__keep"
          aria-pressed={!f.excluded}
          onClick={onExclude}
          aria-label={f.excluded ? (my ? "ပြန်ထည့်" : "Include") : my ? "မထုတ်ဘူး" : "Leave out"}
        >
          {f.excluded ? "○" : "●"}
        </button>
      </div>
      {flags.length ? (
        <div className="frame__flags">
          {flags.map((x) => (
            <span key={x.en} data-kind={x.kind} className={my ? "my" : undefined}>
              {my ? x.my : x.en}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Every frame on two axes — exposure and warmth — with the box the series
   is allowed to sit inside. Drift is seen before it is read. */
function Scatter({
  frames,
  series,
  match,
  onPick,
  my,
}: {
  frames: Frame[];
  series: { drifts: Drift[] };
  match: boolean;
  onPick: (id: string) => void;
  my: boolean;
}) {
  const W = 320;
  const H = 120;
  const sx = (w: number) => W / 2 + (w / 0.035) * (W / 8);
  const sy = (s: number) => H / 2 - (s / 0.33) * (H / 6);
  return (
    <figure className="scatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={my ? "Series ရဲ့ အလင်းနဲ့ အပူချိန်" : "Series exposure against warmth"}>
        <rect className="scatter__box" x={sx(-0.035)} y={sy(0.33)} width={sx(0.035) - sx(-0.035)} height={sy(-0.33) - sy(0.33)} />
        <line className="scatter__axis" x1={0} x2={W} y1={H / 2} y2={H / 2} />
        <line className="scatter__axis" x1={W / 2} x2={W / 2} y1={0} y2={H} />
        {series.drifts.map((d, i) => {
          const off = d.reasons.length > 0;
          const x = Math.max(4, Math.min(W - 4, sx(match && off ? 0 : d.warm)));
          const y = Math.max(4, Math.min(H - 4, sy(match && off ? 0 : d.stops)));
          return (
            <circle
              key={frames[i].id}
              className="scatter__dot"
              data-off={off || undefined}
              cx={x}
              cy={y}
              r={off ? 4 : 3}
              onClick={() => onPick(frames[i].id)}
            >
              <title>{frames[i].file.name}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption className="t-micro">
        <span>{my ? "← အေး" : "← cooler"}</span>
        <span>{my ? "အလင်း ↑" : "brighter ↑"}</span>
        <span>{my ? "နွေး →" : "warmer →"}</span>
      </figcaption>
    </figure>
  );
}

function Detail({
  f,
  d,
  matched,
  my,
  onClose,
  onStep,
}: {
  f: Frame;
  d?: Drift;
  matched: boolean;
  my: boolean;
  onClose: () => void;
  onStep: (k: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  const [aspect, setAspect] = useState(1.5);
  useEffect(() => {
    let live = true;
    createImageBitmap(f.base).then((b) => {
      if (live) setAspect(b.width / b.height);
      b.close();
    });
    return () => {
      live = false;
    };
  }, [f.base]);

  return (
    <div className="bdetail" role="dialog" aria-modal="true" aria-label={f.file.name}>
      <div className="bdetail__bar">
        <span className="bdetail__name">{f.file.name}</span>
        <button type="button" className="lib__act" onClick={() => onStep(-1)} aria-label={my ? "ရှေ့" : "Previous"}>
          ←
        </button>
        <button type="button" className="lib__act" onClick={() => onStep(1)} aria-label={my ? "နောက်" : "Next"}>
          →
        </button>
        <button type="button" className="lib__act" onClick={onClose}>
          {my ? "ပိတ်" : "Close"}
        </button>
      </div>
      <div className="bdetail__frame" style={{ "--ar": aspect } as React.CSSProperties}>
        <Reveal
          key={f.id + (f.url ?? "")}
          src={f.baseUrl}
          alt={f.file.name}
          layers={[
            { id: "orig", label: "Original", labelMy: "မူရင်း", src: f.baseUrl },
            { id: "graded", label: matched && d?.reasons.length ? "Look + match" : "Look", labelMy: "Look", src: f.url ?? f.baseUrl },
          ]}
          my={my}
          fit="contain"
          aspect={aspect}
          initial={0.5}
        />
      </div>
      {d?.reasons.length ? (
        <p className={`bdetail__why ${my ? "my" : "t-small"}`}>
          {my ? "Series နဲ့ ယှဉ်ရင် — " : "Against the series — "}
          {d.reasons.map((r) => (my ? r.my : r.en)).join(", ")}
          {matched ? (my ? "။ ညှိပြီးသား။" : ". Corrected in the export.") : "."}
        </p>
      ) : null}
    </div>
  );
}
