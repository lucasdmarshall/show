"use client";

import { useEffect, useRef, useState } from "react";
import {
  canWatch,
  events,
  flags,
  galleryUrl,
  guestCode,
  newEvent,
  photos,
  needsSync,
  prepare,
  pullPhoto,
  pushEvent,
  pushPhoto,
  qr,
  SignInNeeded,
  watchFolder,
  type EventDoc,
  type Guest,
  type WallStyle,
} from "@/lib/event";
import { BUILT_IN, useOwnLooks } from "@/lib/grade";
import { download, uid } from "@/lib/image";
import { urlOf } from "@/lib/vault";
import { zip } from "@/lib/zip";
import { connected } from "@/lib/premium";
import { askSignIn } from "@/lib/account";
import { Grp } from "./Choices";
import { EventWall, WALLS } from "./EventWall";
import "./event.css";

type Tab = "desk" | "guests" | "wall" | "print";

function Create({ my, onMade, onCancel }: { my: boolean; onMade: (e: EventDoc) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [nameMy, setNameMy] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [place, setPlace] = useState("");
  return (
    <form
      className="ev-new"
      onSubmit={async (e) => {
        e.preventDefault();
        const ev = newEvent(name.trim() || "Event", nameMy.trim(), date, place.trim());
        await events.put(ev);
        onMade(ev);
      }}
    >
      <p className="t-micro">{my ? "ပွဲအသစ်" : "New event"}</p>
      <h2 className={my ? "my" : "t-h3"}>{my ? "ဧည့်သည်တွေ မပြန်ခင် ပုံရအောင်" : "Photographs in guests' hands before they leave"}</h2>
      <label className="afield">
        <span className="afield__label t-micro">{my ? "ပွဲ အမည် (English)" : "Event name"}</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aung Myat & Thinzar" required />
      </label>
      <label className="afield">
        <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "ပွဲ အမည် (မြန်မာ)" : "Name in Burmese — shown on the wall"}</span>
        <input className="field my" value={nameMy} onChange={(e) => setNameMy(e.target.value)} placeholder="အောင်မြတ် နှင့် သဉ္ဇာ မင်္ဂလာပွဲ" />
      </label>
      <div className="port__row">
        <label className="afield">
          <span className="afield__label t-micro">{my ? "ရက်" : "Date"}</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="afield">
          <span className="afield__label t-micro">{my ? "နေရာ" : "Place"}</span>
          <input className="field" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Strand Hotel" />
        </label>
      </div>
      <div className="grade__row">
        <button type="submit" className="btn">
          {my ? "ပွဲ စမည်" : "Start the event"}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn--quiet" onClick={onCancel}>
            {my ? "မလုပ်တော့" : "Cancel"}
          </button>
        ) : null}
      </div>
      <p className={`room__hint ${my ? "my" : "t-small"}`}>
        {my
          ? "အားလုံး ဒီစက်ထဲမှာ ချက်ချင်း သိမ်းတယ် — refresh လုပ်လည်း၊ tab ပိတ်မိလည်း ဘာမှ မပျောက်ဘူး။"
          : "Everything is saved on this device as it happens — a refresh or a closed tab loses nothing."}
      </p>
    </form>
  );
}

function QR({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    qr(text).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [text]);
  /* eslint-disable-next-line @next/next/no-img-element */
  return src ? <img className="qr" src={src} alt={label} /> : <span className="qr qr--ph" />;
}

/* Print through a hidden frame: one photograph per 4×6 page, or a
   sheet of QR cards. The browser's own dialog picks the printer. */
function printHtml(body: string, page: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page{${page};margin:0}body{margin:0;font-family:Padauk,system-ui,sans-serif}img{display:block}</style></head><body>${body}</body></html>`);
  d.close();
  const imgs = [...d.images];
  Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => ((i.onload = r), (i.onerror = r)))))).then(() => {
    f.contentWindow!.focus();
    f.contentWindow!.print();
    window.setTimeout(() => f.remove(), 60_000);
  });
}

export function Event({ my }: { my: boolean }) {
  const all = events.use();
  const allPhotos = photos.use();
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("desk");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ingest, setIngest] = useState<{ done: number; total: number } | null>(null);
  const [watching, setWatching] = useState<{ stop: () => void; name: string } | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sync, setSync] = useState<{ done: number; total: number } | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const queue = useRef<File[]>([]);
  const running = useRef(false);
  const ownLooks = useOwnLooks();

  const ev = all.find((e) => e.id === id) ?? all[0] ?? null;
  const pics = allPhotos.filter((p) => p.eventId === ev?.id);
  const fl = flags(pics);

  useEffect(() => () => watching?.stop(), [watching]);

  /* ingest runs one photograph at a time; new arrivals join the queue */
  const take = async (files: File[]) => {
    if (!ev) return;
    const known = new Set(pics.map((p) => p.name));
    const fresh = files.filter((f) => f.type.startsWith("image/") && !known.has(f.name));
    queue.current.push(...fresh);
    if (running.current) return;
    running.current = true;
    let done = 0;
    while (queue.current.length) {
      const f = queue.current.shift()!;
      setIngest({ done, total: done + queue.current.length + 1 });
      try {
        await photos.put(await prepare(ev, f));
      } catch {
        /* a file that will not decode is skipped */
      }
      done++;
    }
    setIngest(null);
    running.current = false;
  };

  const saveEv = (change: Partial<EventDoc>) => ev && void events.put({ ...ev, ...change });

  /* -- the server's galleries follow the desk ------------------------ */
  const syncing = useRef(false);
  const again = useRef(false);
  const runSync = async (e: EventDoc) => {
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        again.current = false;
        await pushEvent(e);
        const need = photos.list().filter((p) => p.eventId === e.id && needsSync(p));
        for (let i = 0; i < need.length; i++) {
          setSync({ done: i, total: need.length });
          await pushPhoto(e, need[i]);
        }
      } while (again.current);
      setSync(null);
      setNotice(my ? "Gallery တွေ live ဖြစ်နေပြီ — ပုံအသစ်နဲ့ ပြင်ဆင်မှုတွေ အလိုအလျောက် လိုက်တင်မယ်" : "Galleries are live — new photographs and changes follow automatically");
    } catch (err) {
      setSync(null);
      if (err instanceof SignInNeeded) {
        askSignIn();
        setNotice(my ? "Gallery တင်ဖို့ အရင် ဝင်ပါ" : "Sign in to publish the galleries");
      } else {
        setNotice(my ? `တင်လို့ မရသေးပါ — ${(err as Error).message}` : `Could not publish yet — ${(err as Error).message}`);
      }
    } finally {
      syncing.current = false;
    }
  };

  const pending = ev?.published ? pics.filter(needsSync).length : 0;
  const evSig = ev ? JSON.stringify([ev.name, ev.nameMy, ev.date, ev.place, ev.guests]) : "";
  useEffect(() => {
    if (!ev?.published || !connected()) return;
    const t = window.setTimeout(() => void runSync(ev), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evSig, pending, ev?.published]);

  if (creating || !ev) {
    return (
      <div className="ev">
        <Create
          my={my}
          onMade={(e) => {
            setId(e.id);
            setCreating(false);
            setTab("desk");
          }}
          onCancel={all.length ? () => setCreating(false) : undefined}
        />
      </div>
    );
  }

  const guestOf = (gid: string) => ev.guests.find((g) => g.id === gid);
  const assigned = pics.filter((p) => p.guests.length).length;
  const review = pics.filter((p) => p.review || fl.get(p.id)?.soft || fl.get(p.id)?.clipped).length;
  const queued = pics.filter((p) => p.queued);

  const toggleSel = (pid: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });

  const assign = async (g: Guest) => {
    const list = pics.filter((p) => sel.has(p.id));
    const every = list.every((p) => p.guests.includes(g.id));
    for (const p of list) {
      await photos.patch(p.id, { guests: every ? p.guests.filter((x) => x !== g.id) : [...new Set([...p.guests, g.id])] });
    }
  };

  const addGuest = async () => {
    const n = guestName.trim();
    if (!n) return;
    const code = guestCode(new Set(ev.guests.map((g) => g.code)));
    await events.put({ ...ev, guests: [...ev.guests, { id: uid(), name: n, code }] });
    setGuestName("");
  };

  const pack = async (g: Guest) => {
    const mine = pics.filter((p) => p.guests.includes(g.id));
    const z = await zip(mine.map((p, i) => ({ name: `${ev.name}-${String(i + 1).padStart(3, "0")}.jpg`, data: p.blob })));
    download(z, `${ev.name}-${g.name}-${g.code}.zip`.replace(/\s+/g, "-"));
  };

  const printQueue = () => {
    if (!queued.length) return;
    const body = queued
      .map((p) => {
        const land = p.w > p.h;
        return `<div style="width:4in;height:6in;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden"><img src="${urlOf(p.blob)}" style="${land ? "width:6in;height:4in;transform:rotate(90deg)" : "width:4in;height:6in"};object-fit:cover"></div>`;
      })
      .join("");
    printHtml(body, "size:4in 6in");
    queued.forEach((p) => void photos.patch(p.id, { queued: false, printed: p.printed + 1 }));
  };

  const printCards = async () => {
    const cards = await Promise.all(
      ev.guests.map(async (g) => {
        const src = await qr(galleryUrl(ev, g));
        return `<div style="width:2.5in;height:3.5in;box-sizing:border-box;padding:.2in;border:1px dashed #bbb;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.08in;text-align:center;vertical-align:top"><div style="font-size:9pt;letter-spacing:.2em;color:#8a6a17">${ev.nameMy || ev.name}</div><img src="${src}" style="width:1.8in;height:1.8in"><div style="font-size:13pt;font-weight:700">${g.name.replace(/</g, "&lt;")}</div><div style="font:700 16pt monospace;letter-spacing:.3em">${g.code}</div><div style="font-size:8pt;color:#666">ကိုယ့်ပုံတွေ ကြည့်ဖို့ scan ဖတ်ပါ</div></div>`;
      }),
    );
    printHtml(`<div style="padding:.25in">${cards.join("")}</div>`, "size:A4");
  };

  const publish = async () => {
    if (!connected()) {
      setNotice(
        my
          ? "QR link တွေက SHOW server ချိတ်ပြီးမှ ပွင့်မယ်။ လောလောဆယ် ဧည့်သည်တစ်ယောက်ချင်းအတွက် .zip ထုတ်ပြီး Messenger/Viber နဲ့ ပို့လို့ ရတယ်။"
          : "The QR links open once this build is connected to SHOW's server. Until then, each guest's pack (.zip) can go out by Messenger or Viber.",
      );
      return;
    }
    const live = { ...ev, published: true };
    await events.put(live);
    await runSync(live);
  };

  return (
    <div className="ev">
      <header className="ev__head">
        <div className="ev__title">
          <span className="t-micro">{ev.date}{ev.place ? ` · ${ev.place}` : ""}</span>
          <h2 className={ev.nameMy ? "my" : "t-h3"}>{ev.nameMy || ev.name}</h2>
        </div>
        <div className="ev__switch">
          {all.length > 1 ? (
            <select className="field" value={ev.id} onChange={(e) => setId(e.target.value)} aria-label={my ? "ပွဲ ရွေး" : "Choose event"}>
              {all.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.date}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="lib__act" onClick={() => setCreating(true)}>
            + {my ? "ပွဲအသစ်" : "New event"}
          </button>
        </div>
        <div className="ev__stats">
          <span>
            <b>{pics.length}</b> {my ? "ပုံ" : "photos"}
          </span>
          <span>
            <b>{ev.guests.length}</b> {my ? "ဧည့်သည်" : "guests"}
          </span>
          <span>
            <b>{assigned}</b> {my ? "ခွဲပြီး" : "assigned"}
          </span>
          <span data-warn={review || undefined}>
            <b>{review}</b> {my ? "စစ်ရန်" : "to review"}
          </span>
        </div>
        <div className="batch__filters" role="tablist">
          {(
            [
              ["desk", "Desk", "ပုံများ"],
              ["guests", "Guests & QR", "ဧည့်သည် & QR"],
              ["wall", "Live wall", "Live wall"],
              ["print", "Print", "Print"],
            ] as [Tab, string, string][]
          ).map(([t, en, mm]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="batch__filter" onClick={() => setTab(t)}>
              <span className={my ? "my" : undefined}>{my ? mm : en}</span>
              {t === "print" && queued.length ? <span className="batch__n">{queued.length}</span> : null}
            </button>
          ))}
        </div>
      </header>

      {tab === "desk" ? (
        <section className="ev__body">
          <div className="ev__tools">
            <button type="button" className="btn" onClick={() => addRef.current?.click()} disabled={!!ingest}>
              {ingest ? `${ingest.done}/${ingest.total}` : my ? "ပုံ ထည့်မည်" : "Add photos"}
            </button>
            {canWatch() ? (
              watching ? (
                <button
                  type="button"
                  className="btn btn--quiet ev__watching"
                  onClick={() => {
                    watching.stop();
                    setWatching(null);
                  }}
                >
                  ● {my ? `${watching.name} ကို စောင့်ကြည့်နေ` : `Watching ${watching.name}`}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={async () => {
                    try {
                      setWatching(await watchFolder((f) => void take(f)));
                    } catch {
                      /* the person closed the picker */
                    }
                  }}
                >
                  {my ? "Folder စောင့်ကြည့်မည်" : "Watch a folder"}
                </button>
              )
            ) : (
              <span className={`room__hint ${my ? "my" : "t-small"}`}>
                {my ? "Folder စောင့်ကြည့်တာက Chrome/Edge မှာပဲ ရတယ်" : "Watch folder needs Chrome or Edge"}
              </span>
            )}
            <input
              ref={addRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void take([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="ev__ready">
            <Grp title="Guest-ready, automatically" titleMy="ဧည့်သည်အတွက် အလိုအလျောက်" my={my}>
              <div className="batch__looks">
                {[{ id: "none", name: "No look", nameMy: "Look မသုံး", settings: null }, ...ownLooks, ...BUILT_IN].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`chip ${my ? "my" : ""}`}
                    aria-pressed={(ev.lookName ?? "none") === (l.settings ? l.name : "none")}
                    onClick={() => saveEv({ look: l.settings, lookName: l.settings ? l.name : null })}
                  >
                    {my ? l.nameMy : l.name}
                  </button>
                ))}
              </div>
              <div className="ev__logo">
                {ev.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={urlOf(ev.logo)} alt="" />
                ) : null}
                <button type="button" className="lib__act" onClick={() => logoRef.current?.click()}>
                  {ev.logo ? (my ? "Logo ပြောင်း" : "Change logo") : my ? "Logo ထည့် (PNG)" : "Add logo (PNG)"}
                </button>
                {ev.logo ? (
                  <button type="button" className="lib__act lib__act--warn" onClick={() => saveEv({ logo: null })}>
                    {my ? "ဖယ်" : "Remove"}
                  </button>
                ) : null}
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) saveEv({ logo: f });
                    e.target.value = "";
                  }}
                />
              </div>
              <p className={`room__hint ${my ? "my" : "t-small"}`}>
                {my
                  ? "ရောက်လာတဲ့ ပုံတိုင်းကို look နဲ့ logo တပ်ပြီးသား ဖြစ်စေမယ်။ ဖိုင်နာမည်ထဲမှာ ဧည့်သည် code ပါရင် အဲဒီလူ့ gallery ထဲ အလိုလို ရောက်မယ်။"
                  : "Every arriving photograph gets the look and the logo. A filename containing a guest's code files it to their gallery by itself."}
              </p>
            </Grp>
          </div>

          {sel.size ? (
            <div className="work__bulk ev__assign">
              <span className="t-small">{my ? `${sel.size} ပုံ —` : `${sel.size} selected —`}</span>
              {ev.guests.map((g) => (
                <button key={g.id} type="button" className="chip" onClick={() => void assign(g)}>
                  {g.name}
                </button>
              ))}
              {!ev.guests.length ? (
                <button type="button" className="lib__act" onClick={() => setTab("guests")}>
                  {my ? "ဧည့်သည် အရင်ထည့်ပါ →" : "Add guests first →"}
                </button>
              ) : null}
              <button
                type="button"
                className="lib__act"
                onClick={() => {
                  sel.forEach((pid) => void photos.patch(pid, { queued: true }));
                  setSel(new Set());
                }}
              >
                {my ? "Print ထဲ" : "Queue print"}
              </button>
              <button
                type="button"
                className="lib__act lib__act--warn"
                onClick={() => {
                  sel.forEach((pid) => {
                    void photos.remove(pid);
                    void pullPhoto(ev, pid);
                  });
                  setSel(new Set());
                }}
              >
                {my ? "ဖယ်" : "Remove"}
              </button>
              <button type="button" className="lib__act" onClick={() => setSel(new Set())}>
                {my ? "မရွေးတော့" : "Clear"}
              </button>
            </div>
          ) : null}

          {pics.length ? (
            <ul className="ev__grid">
              {[...pics].reverse().map((p) => {
                const f = fl.get(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" className="evp" aria-pressed={sel.has(p.id)} onClick={() => toggleSel(p.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlOf(p.thumb)} alt={p.name} loading="lazy" />
                      <span className="evp__guests">
                        {p.guests.map((gid) => guestOf(gid)?.name).filter(Boolean).join(", ")}
                      </span>
                      {f?.soft || f?.clipped || p.review ? (
                        <span className="evp__flag">{f?.soft ? (my ? "ဝါး" : "soft") : f?.clipped ? (my ? "ပြင်းလွန်း" : "clipped") : my ? "စစ်" : "review"}</span>
                      ) : null}
                      {p.printed ? <span className="evp__printed">×{p.printed}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`ev__empty ${my ? "my" : "t-small"}`}>
              {my ? "ပုံတွေ ထည့်ပါ — ဒါမှမဟုတ် camera ရေးတဲ့ folder ကို စောင့်ကြည့်ခိုင်းပါ။" : "Add photographs — or point SHOW at the folder the camera writes into."}
            </p>
          )}
        </section>
      ) : null}

      {tab === "guests" ? (
        <section className="ev__body">
          <form
            className="ev__addguest"
            onSubmit={(e) => {
              e.preventDefault();
              void addGuest();
            }}
          >
            <input className="field my" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={my ? "ဧည့်သည် အမည်" : "Guest's name"} />
            <button type="submit" className="btn">
              {my ? "ထည့်" : "Add"}
            </button>
          </form>
          <div className="ev__tools">
            <button type="button" className="btn btn--quiet" onClick={() => void printCards()} disabled={!ev.guests.length}>
              {my ? "QR ကတ်များ Print" : "Print QR cards"}
            </button>
            <button type="button" className={`btn btn--quiet ${ev.published ? "ev__watching" : ""}`} onClick={() => void publish()} disabled={!!sync}>
              {sync
                ? `${sync.done}/${sync.total}`
                : ev.published
                  ? my
                    ? `● Live${pending ? ` · ${pending} စောင့်ဆဲ` : ""}`
                    : `● Live${pending ? ` · ${pending} waiting` : ""}`
                  : my
                    ? "Gallery တင်မည်"
                    : "Publish galleries"}
            </button>
          </div>
          {notice ? <p className={`gen__msg ${my ? "my" : "t-small"}`}>{notice}</p> : null}
          <ul className="ev__guests">
            {ev.guests.map((g) => {
              const n = pics.filter((p) => p.guests.includes(g.id)).length;
              return (
                <li key={g.id} className="evg">
                  <QR text={galleryUrl(ev, g)} label={`${g.name} QR`} />
                  <div className="evg__text">
                    <span className="evg__name my">{g.name}</span>
                    <span className="evg__code">{g.code}</span>
                    <span className="t-small evg__n">{my ? `ပုံ ${n}` : `${n} photographs`}</span>
                  </div>
                  <div className="evg__acts">
                    <button type="button" className="lib__act" onClick={() => void pack(g)} disabled={!n}>
                      {my ? ".zip ထုတ်" : "Pack .zip"}
                    </button>
                    <button type="button" className="lib__act lib__act--warn" onClick={() => saveEv({ guests: ev.guests.filter((x) => x.id !== g.id) })}>
                      {my ? "ဖယ်" : "Remove"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my
              ? "Messenger ပို့ပေးတာနဲ့ selfie နဲ့ ကိုယ့်ပုံရှာတာက server နဲ့ model လိုတယ် — ချိတ်ပြီးမှ ရမယ်။"
              : "Messenger delivery and selfie face search need the server and a model — they arrive once it is connected."}
          </p>
        </section>
      ) : null}

      {tab === "wall" ? (
        <section className="ev__body">
          <Grp title="Wall style" titleMy="Wall ပုံစံ" my={my}>
            <div className="grp__opts">
              {WALLS.map((w) => (
                <button key={w.id} type="button" className="chip" aria-pressed={ev.wall === w.id} onClick={() => saveEv({ wall: w.id as WallStyle })}>
                  <span className={my ? "my" : undefined}>{my ? w.labelMy : w.label}</span>
                </button>
              ))}
            </div>
          </Grp>
          <button type="button" className="btn" onClick={() => setWallOpen(true)} disabled={!pics.length}>
            {my ? "Venue TV မှာ ဖွင့်မည်" : "Open on the venue screen"}
          </button>
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my ? "ပုံအသစ် ရောက်တာနဲ့ wall ပေါ် ချက်ချင်း တက်လာမယ်။ Esc နှိပ်ရင် ပိတ်မယ်။" : "New photographs join the wall the moment they arrive. Esc closes it."}
          </p>
        </section>
      ) : null}

      {tab === "print" ? (
        <section className="ev__body">
          <div className="ev__tools">
            <button type="button" className="btn" onClick={printQueue} disabled={!queued.length}>
              {my ? `${queued.length} ပုံ Print (4×6)` : `Print ${queued.length} (4×6)`}
            </button>
          </div>
          {queued.length ? (
            <ul className="ev__grid">
              {queued.map((p) => (
                <li key={p.id}>
                  <button type="button" className="evp" onClick={() => void photos.patch(p.id, { queued: false })} title={my ? "Queue ထဲက ဖယ်" : "Take out of the queue"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlOf(p.thumb)} alt={p.name} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`ev__empty ${my ? "my" : "t-small"}`}>
              {my ? "Desk မှာ ပုံတွေ ရွေးပြီး “Print ထဲ” နှိပ်ပါ။" : "Select photographs on the Desk and queue them."}
            </p>
          )}
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my
              ? "Browser ရဲ့ print dialog က ချိတ်ထားတဲ့ printer ကို သုံးမယ်။ Lab နဲ့ အိမ်အရောက် ပို့တာ (Print-to-door) က server ချိတ်ပြီးမှ ရမယ်။"
              : "The browser's own print dialog uses whichever printer is attached. Print-to-door through a lab arrives with the server."}
          </p>
        </section>
      ) : null}

      {wallOpen ? <EventWall ev={ev} pics={pics} my={my} onClose={() => setWallOpen(false)} /> : null}
    </div>
  );
}
