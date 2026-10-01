"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSite, cleanHandle, pageHtml, saveProfile, shareCard, useProfile, type Profile } from "@/lib/portfolio";
import { urlOf, useWork, work, type WorkItem } from "@/lib/vault";
import { download } from "@/lib/image";
import { API, connected } from "@/lib/premium";
import { askSignIn } from "@/lib/account";
import type { SectionId } from "@/lib/sections";
import { Grp } from "./Choices";
import "./portfolio.css";

function fontsNow() {
  const css = getComputedStyle(document.body);
  return {
    sans: css.getPropertyValue("--font-jakarta").trim() || "sans-serif",
    my: css.getPropertyValue("--font-padauk").trim() || "sans-serif",
  };
}

export function Portfolio({ my, onGo }: { my: boolean; onGo?: (id: SectionId) => void }) {
  const profile = useProfile();
  const all = useWork();
  const shown = useMemo(
    () => all.filter((w) => w.exhibit && !w.trashed).sort((a, b) => a.exhibit!.order - b.exhibit!.order),
    [all],
  );
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [card, setCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);

  const set = (change: Partial<Profile>) => saveProfile({ ...profile, ...change });

  const cover = shown.find((w) => w.id === profile.cover) ?? shown[0] ?? null;

  const html = useMemo(
    () =>
      pageHtml(
        profile,
        shown.map((w) => ({ src: urlOf(w.thumb), w: w.w, h: w.h, caption: w.exhibit?.caption ?? "", captionMy: w.exhibit?.captionMy ?? "" })),
        cover ? urlOf(cover.thumb) : null,
        "og.jpg",
      ),
    [profile, shown, cover],
  );

  /* the share card, redrawn as the profile changes */
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(async () => {
      const b = await shareCard(profile, cover?.thumb ?? null, fontsNow());
      if (!live) return;
      setCard((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(b);
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [profile, cover]);

  const move = async (w: WorkItem, dir: -1 | 1) => {
    const i = shown.findIndex((x) => x.id === w.id);
    const j = i + dir;
    if (j < 0 || j >= shown.length) return;
    const other = shown[j];
    await work.patch(w.id, { exhibit: { ...w.exhibit!, order: other.exhibit!.order } });
    await work.patch(other.id, { exhibit: { ...other.exhibit!, order: w.exhibit!.order } });
  };

  const site = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const z = await buildSite(profile, shown, fontsNow());
      download(z, `${profile.handle || "portfolio"}-site.zip`);
      setNotice(
        my
          ? "Site ဖိုင် ထုတ်ပြီး — ဘယ် hosting မှာမဆို (Netlify Drop, GitHub Pages…) ဆွဲချလိုက်ရုံနဲ့ တကယ့် public စာမျက်နှာ ဖြစ်သွားမယ်"
          : "Site exported — drop the folder on any host (Netlify Drop, GitHub Pages…) and it is a real public page",
      );
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ" : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!connected()) {
      setNotice(
        my
          ? `show.mm/@${profile.handle || "…"} လိပ်စာက SHOW server ချိတ်ပြီးမှ ရမယ်။ လောလောဆယ် site ဖိုင်ကို ကိုယ့် hosting မှာ တင်လို့ ရတယ်။`
          : `show.mm/@${profile.handle || "…"} goes live once this build is connected to SHOW's server. Until then the site export is the real thing.`,
      );
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const z = await buildSite(profile, shown, fontsNow());
      const res = await fetch(`${API}/v1/portfolio/${profile.handle}`, {
        method: "PUT",
        body: z,
        credentials: "include",
        headers: { "Content-Type": "application/zip" },
      });
      if (res.status === 401) {
        askSignIn();
        setNotice(my ? "တင်ဖို့ အရင် ဝင်ပါ" : "Sign in to publish");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (res.ok && j.url) {
        setLive(j.url);
        setNotice(my ? "တင်ပြီးပြီ — link ကို share လုပ်လို့ရပြီ" : "Published — the link is ready to share");
      } else {
        setNotice(j.message ?? (my ? "မအောင်မြင်ပါ" : `Publish failed (${res.status})`));
      }
    } catch {
      setNotice(my ? "Server နဲ့ ဆက်သွယ်လို့ မရပါ" : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const host = connected() ? API.replace(/^https?:\/\//, "") : "show.mm";
  const address = profile.address || `${host}/@${profile.handle || "yourname"}`;

  return (
    <div className="port">
      <section className="port__edit" aria-label={my ? "ပြင်ဆင်ရန်" : "Edit"}>
        <Grp title="You" titleMy="ကိုယ့်အကြောင်း" my={my}>
          <div className="port__form">
            <label className="afield">
              <span className="afield__label t-micro">{my ? "လိပ်စာ နာမည်" : "Handle"}</span>
              <span className="port__handle">
                <span>@</span>
                <input className="field" value={profile.handle} placeholder="yourname" onChange={(e) => set({ handle: cleanHandle(e.target.value) })} />
              </span>
            </label>
            <label className="afield">
              <span className="afield__label t-micro">{my ? "အမည် (English)" : "Name"}</span>
              <input className="field" value={profile.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="afield">
              <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "အမည် (မြန်မာ)" : "Name in Burmese"}</span>
              <input className="field my" value={profile.nameMy} onChange={(e) => set({ nameMy: e.target.value })} />
            </label>
            <label className="afield">
              <span className="afield__label t-micro">{my ? "အကြောင်း (English)" : "About"}</span>
              <textarea className="field" rows={2} value={profile.bio} onChange={(e) => set({ bio: e.target.value })} />
            </label>
            <label className="afield">
              <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "အကြောင်း (မြန်မာ)" : "About, in Burmese"}</span>
              <textarea className="field my" rows={2} value={profile.bioMy} onChange={(e) => set({ bioMy: e.target.value })} />
            </label>
            <div className="port__row">
              <label className="afield">
                <span className="afield__label t-micro">{my ? "မြို့" : "City"}</span>
                <input className="field" value={profile.city} onChange={(e) => set({ city: e.target.value })} />
              </label>
              <label className="afield">
                <span className="afield__label t-micro">{my ? "ဖုန်း" : "Phone"}</span>
                <input className="field" inputMode="tel" value={profile.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
            </div>
            <div className="port__row">
              <label className="afield">
                <span className="afield__label t-micro">Messenger</span>
                <input className="field" value={profile.messenger} placeholder="page name" onChange={(e) => set({ messenger: e.target.value })} />
              </label>
              <label className="afield">
                <span className="afield__label t-micro">Viber</span>
                <input className="field" inputMode="tel" value={profile.viber} onChange={(e) => set({ viber: e.target.value })} />
              </label>
            </div>
            <label className="afield">
              <span className="afield__label t-micro">{my ? "ကိုယ်ပိုင် domain (ရှိရင်)" : "Your own address, if you have one"}</span>
              <input className="field" value={profile.address} placeholder="https://yourname.com" onChange={(e) => set({ address: e.target.value.trim() })} />
            </label>
            <div className="grp__opts">
              {(["black", "ivory"] as const).map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={profile.theme === t} onClick={() => set({ theme: t })}>
                  <span className={my ? "my" : undefined}>{t === "black" ? (my ? "အနက်နဲ့ ရွှေ" : "Black & gold") : my ? "ဆင်စွယ်ရောင်" : "Ivory"}</span>
                </button>
              ))}
            </div>
          </div>
        </Grp>

        <Grp title="On the page" titleMy="စာမျက်နှာပေါ်မှာ" my={my} aside={`${shown.length}`}>
          {shown.length ? (
            <ul className="port__works">
              {shown.map((w, i) => (
                <li key={w.id} className="pwork">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlOf(w.thumb)} alt="" />
                  <div className="pwork__text">
                    <input
                      className="field"
                      value={w.exhibit!.caption}
                      aria-label="Caption"
                      onChange={(e) => void work.patch(w.id, { exhibit: { ...w.exhibit!, caption: e.target.value } })}
                    />
                    <input
                      className="field my"
                      value={w.exhibit!.captionMy}
                      placeholder="မြန်မာ စာတန်း"
                      aria-label="Burmese caption"
                      onChange={(e) => void work.patch(w.id, { exhibit: { ...w.exhibit!, captionMy: e.target.value } })}
                    />
                  </div>
                  <div className="pwork__acts">
                    <button type="button" className="lib__act" onClick={() => void move(w, -1)} disabled={i === 0} aria-label={my ? "အပေါ်" : "Up"}>
                      ↑
                    </button>
                    <button type="button" className="lib__act" onClick={() => void move(w, 1)} disabled={i === shown.length - 1} aria-label={my ? "အောက်" : "Down"}>
                      ↓
                    </button>
                    <button type="button" className="lib__act" aria-pressed={cover?.id === w.id} onClick={() => set({ cover: w.id })}>
                      {cover?.id === w.id ? (my ? "မျက်နှာဖုံး ✓" : "Cover ✓") : my ? "မျက်နှာဖုံး" : "Cover"}
                    </button>
                    <button type="button" className="lib__act lib__act--warn" onClick={() => void work.patch(w.id, { exhibit: null })}>
                      {my ? "ဖယ်" : "Remove"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`room__hint ${my ? "my" : "t-small"}`}>
              {my ? "Work ထဲက ပုံတွေကို “ပြခန်းထဲ ထည့်” နှိပ်ရင် ဒီမှာ ပေါ်လာမယ်။" : "Pick photographs in Work with “Add to portfolio” and they appear here."}
            </p>
          )}
          {onGo ? (
            <button type="button" className="rev__again" onClick={() => onGo("work")}>
              {my ? "Work ကနေ ရွေးမယ် →" : "Choose from Work →"}
            </button>
          ) : null}
        </Grp>

        <div className="album__acts">
          {notice ? (
            <p className={`grade__notice ${my ? "my" : "t-small"}`} role="status">
              {notice}
            </p>
          ) : null}
          {live ? (
            <a className="port__live" href={live} target="_blank" rel="noreferrer">
              {live}
            </a>
          ) : null}
          <div className="grade__row">
            <button type="button" className="btn" onClick={() => void publish()} disabled={busy || !profile.handle}>
              {my ? "တင်မည်" : "Publish"}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => void site()} disabled={busy || !shown.length}>
              {busy ? (my ? "ပြင်ဆင်နေသည်…" : "Building…") : my ? "Site ဖိုင် (.zip)" : "Site (.zip)"}
            </button>
          </div>
        </div>
      </section>

      <section className="port__view" aria-label={my ? "အစမ်းကြည့်" : "Preview"}>
        <div className="port__bar">
          <span className="port__url">{address}</span>
          <div className="seg" role="group" aria-label="Device">
            <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>
              {my ? "ဖုန်း" : "Phone"}
            </button>
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
              {my ? "ကွန်ပျူတာ" : "Desktop"}
            </button>
          </div>
        </div>
        <div className="port__frame" data-device={device}>
          <iframe title={my ? "Portfolio အစမ်း" : "Portfolio preview"} srcDoc={html} />
        </div>

        <div className="port__card">
          <span className="t-micro">{my ? "Facebook မှာ share လုပ်ရင် ဒီလိုပေါ်မယ်" : "How it looks shared on Facebook"}</span>
          <div className="fbcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {card ? <img src={card} alt="" /> : <span className="fbcard__ph" />}
            <div className="fbcard__meta">
              <span className="fbcard__host">{(profile.address || "show.mm").replace(/^https?:\/\//, "").split("/")[0].toUpperCase()}</span>
              <span className="fbcard__title">{profile.name || "Your name"}{profile.nameMy ? ` · ${profile.nameMy}` : ""}</span>
              <span className="fbcard__desc">{profile.bio || profile.bioMy || "Photography"}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
