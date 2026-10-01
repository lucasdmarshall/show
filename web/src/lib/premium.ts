/* ------------------------------------------------------------------
   Generation — the premium half.

   Every room builds its prompt for free, and that prompt can always be
   taken to the person's own engine. Generating on SHOW's servers is for
   members. This is the one seam between the app and that server: the
   Rust service answers POST /v1/generate, and until it is configured
   the app says so plainly rather than pretending.
   ------------------------------------------------------------------ */

export const API = process.env.NEXT_PUBLIC_SHOW_API ?? "";
export const connected = () => API.length > 0;

export type GenRequest = {
  /** which room is asking — the server prices and routes by it */
  section: string;
  /** an id from GET /v1/models; the member's chosen model when absent */
  model?: string;
  /** photographs to take from — a face, a garment, a place */
  refs?: Blob[];
  prompt: string;
  negative?: string;
  /** the photograph being edited, when there is one */
  image?: Blob | null;
  /** white = may change, black = keep; alpha of `image` when omitted */
  mask?: Blob | null;
  /** pinned so the same request gives the same frame next month */
  seed: number;
  count: number;
  aspect: string;
  /** 0–1, how far an edit may move from the source */
  strength?: number;
};

export class NotConnected extends Error {}

/** Resolves to one blob per result, in the order the server returned them. */
export async function generate(req: GenRequest, signal?: AbortSignal): Promise<Blob[]> {
  if (!connected()) throw new NotConnected("generation server not configured");
  const body = new FormData();
  const { image, mask, refs, ...meta } = req;
  body.set("request", JSON.stringify({ ...meta, model: meta.model ?? preferredModel() ?? undefined }));
  if (image) body.set("image", image, "image");
  if (mask) body.set("mask", mask, "mask");
  refs?.forEach((r, i) => body.append("ref", r, `ref-${i}`));

  const res = await fetch(`${API}/v1/generate`, { method: "POST", body, credentials: "include", signal });
  if (res.status === 401) throw new Error("login");
  if (res.status === 402) throw new Error("membership");
  if (!res.ok) {
    /* the server says what went wrong in words a person can read */
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `server ${res.status}`);
  }
  const { images } = (await res.json()) as { images: string[] };
  return Promise.all(images.map(async (u) => (await fetch(u)).blob()));
}

/* The model the member last chose in Create — every room uses it. */
const MODEL_KEY = "show.model";
export function preferredModel(): string | null {
  try {
    return localStorage.getItem(MODEL_KEY);
  } catch {
    return null;
  }
}
export function setPreferredModel(id: string) {
  try {
    localStorage.setItem(MODEL_KEY, id);
  } catch {
    /* kept for this visit only */
  }
}

/** A seed the person can read aloud and type back in. */
export const newSeed = () => Math.floor(Math.random() * 900_000) + 100_000;
