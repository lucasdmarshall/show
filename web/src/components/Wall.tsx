"use client";

import { useState } from "react";
import "./wall.css";

/* A browsable wall of cards — places, themes — each drawn from its own
   three colours, so it can be judged by eye before anything is made. */

export type WallItem = {
  id: string;
  label: string;
  labelMy: string;
  palette: [string, string, string];
  cat: string;
  /** shown in the drawer: what to expect */
  detail?: string;
  detailMy?: string;
};

export function Wall({
  items,
  cats,
  value,
  onPick,
  my,
}: {
  items: WallItem[];
  cats: { id: string; label: string; labelMy: string }[];
  value: string | null;
  onPick: (id: string) => void;
  my: boolean;
}) {
  const [cat, setCat] = useState<string>("all");
  const shown = cat === "all" ? items : items.filter((i) => i.cat === cat);
  const current = items.find((i) => i.id === value);

  return (
    <div className="wall">
      <div className="wall__cats" role="tablist">
        {[{ id: "all", label: "All", labelMy: "အားလုံး" }, ...cats].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`wall__cat ${my ? "my" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {my ? c.labelMy : c.label}
            <span className="wall__n">{c.id === "all" ? items.length : items.filter((i) => i.cat === c.id).length}</span>
          </button>
        ))}
      </div>
      <ul className="wall__grid">
        {shown.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className="wcard"
              aria-pressed={value === i.id}
              onClick={() => onPick(i.id)}
              style={
                {
                  "--c1": i.palette[0],
                  "--c2": i.palette[1],
                  "--c3": i.palette[2],
                } as React.CSSProperties
              }
            >
              <span className="wcard__swatch" aria-hidden="true" />
              <span className={`wcard__name ${my ? "my" : ""}`}>{my ? i.labelMy : i.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {current?.detail ? (
        <div className="wall__drawer" role="status">
          <span className="t-micro">{my ? "မျှော်လင့်ရမယ့် ရလဒ်" : "What to expect"}</span>
          <p className={my ? "my" : "t-small"}>{my ? (current.detailMy ?? current.detail) : current.detail}</p>
        </div>
      ) : null}
    </div>
  );
}
