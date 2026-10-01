import type { Group, Option } from "./catalogue";
import { compileParts, type Compiled, type Edit, type Selection } from "./compile";

/* ------------------------------------------------------------------
   The fix and deliver rooms decide things the same way Studio does —
   groups of options, each carrying what the model is actually told —
   but each room owns its own catalogue. This is the shared half.
   ------------------------------------------------------------------ */

export const opt = (
  id: string,
  label: string,
  labelMy: string,
  descriptor: string,
  extra: Partial<Option> = {},
): Option => ({ id, label, labelMy, descriptor, ...extra });

export function picked(groups: Group[], sel: Selection): Option[] {
  const out: Option[] = [];
  for (const g of [...groups].sort((a, b) => a.order - b.order)) {
    for (const id of sel[g.id] ?? []) {
      const o = g.options.find((x) => x.id === id);
      if (o) out.push(o);
    }
  }
  return out;
}

export function toggle(groups: Group[], sel: Selection, groupId: string, optionId: string): Selection {
  const g = groups.find((x) => x.id === groupId);
  const cur = sel[groupId] ?? [];
  const next = g?.multi
    ? cur.includes(optionId)
      ? cur.filter((x) => x !== optionId)
      : [...cur, optionId]
    : cur[0] === optionId
      ? []
      : [optionId];
  return { ...sel, [groupId]: next };
}

/** Options, then free text, then anything the room adds, as one prompt. */
export function compileRoom(
  groups: Group[],
  sel: Selection,
  aspect: string,
  o: {
    lead?: string[];
    tail?: string[];
    negatives?: string[];
    edit?: Edit;
    photographic?: boolean;
  } = {},
): Compiled {
  const picks = picked(groups, sel);
  const parts = [
    ...(o.lead ?? []),
    ...picks.map((p) => p.descriptor),
    ...(o.tail ?? []).filter(Boolean),
  ];
  const negatives = [
    ...(o.negatives ?? []),
    "watermark",
    "signature",
    "garbled text",
    "jpeg artifacts",
    ...picks.flatMap((p) => (p.negative ? [p.negative] : [])),
  ];
  const out = compileParts(parts, negatives, aspect, {
    edit: o.edit,
    photographic: o.photographic,
  });
  const mm = picks.filter((p) => p.mm).length;
  if (mm) {
    out.notes.push(`${mm} Burmese ${mm === 1 ? "concept" : "concepts"} translated — no model knows these by name.`);
  }
  return out;
}
