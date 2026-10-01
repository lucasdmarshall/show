import * as G from "../src/lib/grade.ts";

let fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!cond) fail++;
};

// 1. identity curve
const id = G.curveLUT([[0, 0], [1, 1]]);
ok("identity curve", id.every((v, i) => v === i));

// 2. neutral pipeline is identity on every value
const p0 = G.compilePipeline(G.NEUTRAL);
const px = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i++) { px[i*4]=i; px[i*4+1]=255-i; px[i*4+2]=(i*7)%256; px[i*4+3]=255; }
const copy = px.slice();
G.renderFinal(copy, p0);
let maxDelta = 0;
for (let i = 0; i < px.length; i++) maxDelta = Math.max(maxDelta, Math.abs(px[i] - copy[i]));
ok("neutral settings leave pixels untouched", maxDelta === 0, `max Δ ${maxDelta}`);

// 3. monotone: a steep S never goes backwards or overshoots
const s = G.curveLUT([[0,0],[0.25,0.05],[0.3,0.9],[1,1]]);
let mono = true; for (let i = 1; i < 256; i++) if (s[i] < s[i-1]) mono = false;
ok("monotone curve never reverses", mono);

// 4. exposure +1 EV brightens a mid-grey, and never exceeds 255
const up = G.compilePipeline({ ...G.NEUTRAL, exposure: 1 });
ok("+1 EV lifts mid-grey", up.tone[118] > 150, `118 -> ${up.tone[118]}`);
ok("+1 EV clamps at white", up.tone[255] === 255);

// 5. contrast keeps endpoints and the midpoint pivot
const c = G.compilePipeline({ ...G.NEUTRAL, contrast: 1 });
ok("contrast keeps black/white", c.tone[0] === 0 && c.tone[255] === 255);
ok("contrast pivots near mid", Math.abs(c.tone[128] - 128) <= 1, `128 -> ${c.tone[128]}`);
ok("contrast darkens a shadow", c.tone[64] < 64, `64 -> ${c.tone[64]}`);

// 6. saturation −1 is exactly monochrome
const mono2 = G.compilePipeline({ ...G.NEUTRAL, saturation: -1 });
const col = new Uint8ClampedArray([200, 40, 90, 255]);
G.renderFinal(col, mono2);
ok("saturation −1 is grey", col[0] === col[1] && col[1] === col[2], `${col[0]},${col[1]},${col[2]}`);

// 7. warm temperature pushes red up, blue down
const warm = G.compilePipeline({ ...G.NEUTRAL, temperature: 1 });
ok("warm: R up, B down", warm.gainR[128] > 128 && warm.gainB[128] < 128, `R ${warm.gainR[128]} B ${warm.gainB[128]}`);

// 8. stages are consistent with the final render
const look = G.BUILT_IN[0].settings;
const pl = G.compilePipeline(look);
const src = px.slice();
const out = { tone: new Uint8ClampedArray(src.length), colour: new Uint8ClampedArray(src.length), curves: new Uint8ClampedArray(src.length) };
G.renderStages(src, pl, out);
const fin = px.slice(); G.renderFinal(fin, pl);
let d8 = 0; for (let i = 0; i < fin.length; i++) d8 = Math.max(d8, Math.abs(fin[i] - out.curves[i]));
ok("stage render == final render", d8 <= 1, `max Δ ${d8}`);

// 9. histogram counts every pixel
const h = G.histogram(px);
ok("histogram sums to pixel count", h.l.reduce((a, b) => a + b, 0) === 256);

// 10. .cube format
const cube = G.toCube(G.NEUTRAL, "Neutral", 17);
const lines = cube.trim().split("\n");
const data = lines.filter(l => /^[0-9.]+ [0-9.]+ [0-9.]+$/.test(l));
ok(".cube has size³ rows", data.length === 17 ** 3, `${data.length}`);
ok(".cube header", lines.includes("LUT_3D_SIZE 17"));
ok(".cube red varies fastest", data[1].startsWith("0.062") && data[1].endsWith("0.000000 0.000000"), data[1]);
ok(".cube neutral last row is white", data[data.length-1] === "1.000000 1.000000 1.000000");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
