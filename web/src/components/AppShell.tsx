"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme, type ThemeChoice } from "@/lib/useTheme";
import {
  GROUP_LABEL,
  PRIMARY,
  SECTIONS,
  getSection,
  type GroupId,
  type SectionId,
} from "@/lib/sections";
import { Account } from "./Account";
import "./app-shell.css";

const THEMES: ThemeChoice[] = ["system", "light", "dark"];
const MORE_ICON = "M4 7h16M4 12h16M4 17h16";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tier({ tier, my }: { tier: "free" | "device" | "premium"; my: boolean }) {
  if (tier === "free") return null;
  return (
    <span className="tier" data-tier={tier}>
      {tier === "device" ? (my ? "ဖုန်းပေါ်" : "On device") : my ? "Premium" : "Premium"}
    </span>
  );
}

type Props = {
  section: SectionId;
  onSection: (s: SectionId) => void;
  my: boolean;
  onMy: (v: boolean) => void;
  children: React.ReactNode;
};

export function AppShell({ section, onSection, my, onMy, children }: Props) {
  const { choice, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = getSection(section);

  /* Escape closes the map, and the page underneath must not scroll. */
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  const go = (id: SectionId) => {
    onSection(id);
    setMoreOpen(false);
  };

  const grouped = (["direct", "fix", "deliver"] as GroupId[]).map((g) => ({
    g,
    items: SECTIONS.filter((s) => s.group === g),
  }));

  return (
    <div className="app">
      <header className="app__bar">
        <Link href="/" className="app__mark" aria-label="SHOW — home">SHOW</Link>
        <span className={`app__where ${my ? "my" : "t-micro"}`} aria-live="polite">
          {my ? current.labelMy : current.label}
        </span>

        <div className="app__tools">
          <Account my={my} />
          <div className="seg" role="group" aria-label="Language">
            <button type="button" aria-pressed={!my} onClick={() => onMy(false)}>
              EN
            </button>
            <button type="button" aria-pressed={my} onClick={() => onMy(true)} className="my">
              မြန်မာ
            </button>
          </div>
          <div className="seg seg--icon" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={choice === t}
                aria-label={t}
                onClick={() => setTheme(t)}
                title={t}
              >
                {t === "system" ? "A" : t === "light" ? "L" : "D"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* phone: four, then everything else */}
      <nav className="app__nav" aria-label="Sections">
        {PRIMARY.map((id) => {
          const s = getSection(id);
          return (
            <button
              key={id}
              type="button"
              className="app__navbtn"
              aria-current={section === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon d={s.icon} />
              <span className={my ? "my" : undefined}>{my ? s.labelMy : s.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="app__navbtn"
          aria-expanded={moreOpen}
          aria-current={
            !PRIMARY.includes(section) && !moreOpen ? "page" : undefined
          }
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon d={MORE_ICON} />
          <span className={my ? "my" : undefined}>{my ? "အားလုံး" : "All"}</span>
        </button>
      </nav>

      {/* tablet and up: the full map in a rail */}
      <nav className="app__rail" aria-label="All sections">
        {grouped.map(({ g, items }) => (
          <div className="rail__grp" key={g}>
            <p className={`rail__label ${my ? "my" : "t-micro"}`}>
              {my ? GROUP_LABEL[g].labelMy : GROUP_LABEL[g].label}
            </p>
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                className="rail__btn"
                aria-current={section === s.id ? "page" : undefined}
                onClick={() => go(s.id)}
                title={my ? s.blurbMy : s.blurb}
              >
                <Icon d={s.icon} />
                <span className={my ? "my" : undefined}>{my ? s.labelMy : s.label}</span>
                {s.built ? null : <span className="rail__dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <main className="app__main">{children}</main>

      {/* the whole map, on a phone */}
      {moreOpen ? (
        <div className="map" role="dialog" aria-modal="true" aria-label={my ? "အားလုံး" : "All sections"}>
          <div className="map__sheet">
            <button
              type="button"
              className="map__close"
              onClick={() => setMoreOpen(false)}
              aria-label={my ? "ပိတ်မည်" : "Close"}
            >
              <span aria-hidden="true" />
            </button>
            <div className="map__scroll">
              {grouped.map(({ g, items }) => (
                <section className="map__grp" key={g}>
                  <h2 className={`map__label ${my ? "my" : "t-micro"}`}>
                    {my ? GROUP_LABEL[g].labelMy : GROUP_LABEL[g].label}
                  </h2>
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="map__item"
                      aria-current={section === s.id ? "page" : undefined}
                      onClick={() => go(s.id)}
                    >
                      <Icon d={s.icon} />
                      <span className="map__text">
                        <span className={`map__name ${my ? "my" : ""}`}>
                          {my ? s.labelMy : s.label}
                          <Tier tier={s.tier} my={my} />
                          {s.built ? null : (
                            <span className="tier" data-tier="soon">
                              {my ? "မပြီးသေး" : "Building"}
                            </span>
                          )}
                        </span>
                        <span className={`map__blurb ${my ? "my" : "t-small"}`}>
                          {my ? s.blurbMy : s.blurb}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
