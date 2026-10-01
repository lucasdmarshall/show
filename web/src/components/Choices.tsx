"use client";

import type { Group } from "@/lib/catalogue";
import type { Selection } from "@/lib/compile";

/* One room's decisions, drawn the way Studio draws them. */

export function Choices({
  groups,
  selection,
  onToggle,
  my,
}: {
  groups: Group[];
  selection: Selection;
  onToggle: (groupId: string, optionId: string) => void;
  my: boolean;
}) {
  return (
    <>
      {groups.map((group) => {
        const on = selection[group.id] ?? [];
        return (
          <section className="grp" key={group.id}>
            <header className="grp__head">
              <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
                {my ? group.labelMy : group.label}
              </h2>
              <span className="grp__count t-micro" aria-hidden="true">
                {group.multi ? `${on.length}` : on.length ? "1" : "—"}
              </span>
            </header>
            <div className="grp__opts" role="group">
              {group.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="chip"
                  aria-pressed={on.includes(opt.id)}
                  onClick={() => onToggle(group.id, opt.id)}
                  title={opt.descriptor}
                >
                  <span className={my ? "my" : undefined}>{my ? opt.labelMy : opt.label}</span>
                  {opt.mm ? <span className="chip__mm">MM</span> : null}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/** A labelled group holding anything — a slider, a picker, a note. */
export function Grp({
  title,
  titleMy,
  my,
  aside,
  children,
}: {
  title: string;
  titleMy: string;
  my: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grp">
      <header className="grp__head">
        <h2 className={my ? "my grp__title" : "t-micro grp__title"}>{my ? titleMy : title}</h2>
        {aside ? <span className="grp__count t-micro">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** A −/+ slider in the Grade dial's style, for any 0–1 or −1–1 amount. */
export function Amount({
  label,
  labelMy,
  value,
  onChange,
  my,
  min = 0,
  max = 1,
  step = 0.01,
  format,
}: {
  label: string;
  labelMy: string;
  value: number;
  onChange: (v: number) => void;
  my: boolean;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const zero = ((Math.max(min, Math.min(max, 0)) - min) / (max - min)) * 100;
  const moved = value !== Math.max(min, Math.min(max, 0));
  return (
    <div className="dial" data-moved={moved || undefined}>
      <div className="dial__row">
        <span className={`dial__label ${my ? "my" : ""}`}>{my ? labelMy : label}</span>
        <output className="dial__val">{format ? format(value) : `${Math.round(value * 100)}`}</output>
      </div>
      <input
        type="range"
        className="dial__range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={my ? labelMy : label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--from": `${Math.min(pct, zero)}%`,
            "--to": `${Math.max(pct, zero)}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
