"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   The hero: a photograph under water.

   A height field is simulated on the GPU (the wave equation, on two
   half-float textures read and written in turn); the photograph is
   drawn through it, bent by the slope of the surface, with a gold
   highlight where the surface catches the light. The pointer drags a
   wake through it, a tap drops a stone, and a slow rain keeps it alive
   when no one is touching.

   No WebGL2, or reduced motion asked for: the photograph, still.
   ------------------------------------------------------------------ */

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/* r = height, g = velocity */
const STEP = `#version 300 es
precision highp float;
uniform sampler2D state;
uniform vec2 texel;
in vec2 uv;
out vec4 o;
void main() {
  vec4 s = texture(state, uv);
  float avg = (
    texture(state, uv - vec2(texel.x, 0.0)).r +
    texture(state, uv + vec2(texel.x, 0.0)).r +
    texture(state, uv - vec2(0.0, texel.y)).r +
    texture(state, uv + vec2(0.0, texel.y)).r) * 0.25;
  s.g += (avg - s.r) * 2.0;
  s.g *= 0.993;
  s.r += s.g;
  s.r *= 0.998;
  o = s;
}`;

const DROP = `#version 300 es
precision highp float;
uniform sampler2D state;
uniform vec2 center;
uniform float radius;
uniform float strength;
uniform float aspect;
in vec2 uv;
out vec4 o;
void main() {
  vec4 s = texture(state, uv);
  vec2 d = uv - center;
  d.x *= aspect;
  float k = max(0.0, 1.0 - length(d) / radius);
  k = 0.5 - cos(k * 3.14159265) * 0.5;
  s.r += k * strength;
  o = s;
}`;

const SHOW = `#version 300 es
precision highp float;
uniform sampler2D state;
uniform sampler2D photo;
uniform vec2 texel;
uniform float refraction;
in vec2 uv;
out vec4 o;
void main() {
  float l = texture(state, uv - vec2(texel.x, 0.0)).r;
  float r = texture(state, uv + vec2(texel.x, 0.0)).r;
  float d = texture(state, uv - vec2(0.0, texel.y)).r;
  float u = texture(state, uv + vec2(0.0, texel.y)).r;
  vec2 slope = vec2(r - l, u - d);
  vec3 col = texture(photo, uv - slope * refraction).rgb;

  vec3 n = normalize(vec3(-slope * 9.0, 1.0));
  vec3 light = normalize(vec3(-0.45, 0.65, 0.9));
  float spec = pow(max(0.0, dot(reflect(-light, n), vec3(0.0, 0.0, 1.0))), 90.0);
  float sheen = pow(max(0.0, dot(n, light)), 3.0) - pow(light.z, 3.0);
  col += vec3(1.0, 0.82, 0.45) * spec * 0.85;
  col *= 1.0 + sheen * 0.35;
  o = vec4(col, 1.0);
}`;

/* -- the photograph, or SHOW's gold silk while there is none ------- */

function paintSilk(c: HTMLCanvasElement) {
  const x = c.getContext("2d")!;
  const { width: w, height: h } = c;
  x.fillStyle = "#050405";
  x.fillRect(0, 0, w, h);

  const glow = (cx: number, cy: number, r: number, stops: [number, string][]) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  };
  const m = Math.max(w, h);
  glow(w * 0.74, h * 0.6, m * 0.62, [
    [0, "rgba(240,199,94,0.55)"],
    [0.35, "rgba(212,162,47,0.22)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  glow(w * 0.12, h * 0.15, m * 0.45, [
    [0, "rgba(138,106,23,0.32)"],
    [1, "rgba(0,0,0,0)"],
  ]);

  /* folds of silk: long waves, each a little out of phase */
  const lines = 110;
  for (let i = 0; i < lines; i++) {
    const t = i / lines;
    const base = h * (-0.1 + t * 1.25);
    const amp = h * (0.05 + 0.09 * Math.sin(t * 3.1));
    const f = (Math.PI * 2) / (w * (0.9 + 0.5 * Math.cos(t * 5)));
    x.beginPath();
    for (let px = -20; px <= w + 20; px += 8) {
      const y = base + Math.sin(px * f + t * 7) * amp + Math.sin(px * f * 2.3 + t * 13) * amp * 0.25 - px * 0.18;
      if (px === -20) x.moveTo(px, y);
      else x.lineTo(px, y);
    }
    const g = x.createLinearGradient(0, 0, w, 0);
    const a = 0.05 + 0.2 * Math.pow(Math.sin(t * Math.PI), 2);
    g.addColorStop(0, `rgba(138,106,23,${a * 0.3})`);
    g.addColorStop(0.55, `rgba(240,199,94,${a})`);
    g.addColorStop(1, `rgba(212,162,47,${a * 0.5})`);
    x.strokeStyle = g;
    x.lineWidth = 1 + (i % 7 === 0 ? 1.5 : 0);
    x.stroke();
  }

  /* a soft vignette, so the type sits on dark */
  const v = x.createRadialGradient(w * 0.6, h * 0.5, m * 0.2, w * 0.5, h * 0.5, m * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.7)");
  x.fillStyle = v;
  x.fillRect(0, 0, w, h);
}

function paintPhoto(c: HTMLCanvasElement, img: HTMLImageElement) {
  const x = c.getContext("2d")!;
  const { width: w, height: h } = c;
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => ok(i);
    i.onerror = fail;
    i.src = src;
  });

/* -- GL helpers ------------------------------------------------------ */

function program(gl: WebGL2RenderingContext, frag: string) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, "p");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  const u = new Map<string, WebGLUniformLocation | null>();
  return {
    p,
    u: (name: string) => {
      if (!u.has(name)) u.set(name, gl.getUniformLocation(p, name));
      return u.get(name)!;
    },
  };
}

type Drop = { x: number; y: number; r: number; s: number };

export function WaterHero({ image }: { image: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [still, setStill] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const host = (canvas.closest("[data-water]") as HTMLElement | null) ?? canvas;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = reduce ? null : canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
    const art = document.createElement("canvas");
    let photo: HTMLImageElement | null = null;
    let disposed = false;

    const paint = () => {
      if (photo) paintPhoto(art, photo);
      else paintSilk(art);
    };

    /* no water: the same picture, still */
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      const paintStill = async () => {
        art.width = 1600;
        art.height = Math.round((1600 * host.clientHeight) / Math.max(1, host.clientWidth));
        if (image) photo = await loadImage(image).catch(() => null);
        if (disposed) return;
        paint();
        setStill(art.toDataURL("image/jpeg", 0.86));
      };
      void paintStill();
      return () => {
        disposed = true;
      };
    }

    let step: ReturnType<typeof program>, drop: ReturnType<typeof program>, show: ReturnType<typeof program>;
    try {
      step = program(gl, STEP);
      drop = program(gl, DROP);
      show = program(gl, SHOW);
    } catch {
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = (w: number, h: number, data: TexImageSource | null) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (data) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      }
      return t;
    };

    let sim = { w: 2, h: 2 };
    let states: WebGLTexture[] = [];
    let fbos: WebGLFramebuffer[] = [];
    let cur = 0;
    let photoTex: WebGLTexture | null = null;
    let aspect = 1;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(2, Math.round(host.clientWidth * dpr));
      const h = Math.max(2, Math.round(host.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      aspect = w / h;

      /* the simulation runs coarser than the screen: ripples are soft */
      const long = window.innerWidth < 700 ? 256 : 384;
      sim = aspect >= 1 ? { w: long, h: Math.max(2, Math.round(long / aspect)) } : { w: Math.max(2, Math.round(long * aspect)), h: long };
      states.forEach((t) => gl.deleteTexture(t));
      fbos.forEach((f) => gl.deleteFramebuffer(f));
      states = [tex(sim.w, sim.h, null), tex(sim.w, sim.h, null)];
      fbos = states.map((t) => {
        const f = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return f;
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const k = Math.min(1, 2048 / Math.max(w, h));
      art.width = Math.round(w * k);
      art.height = Math.round(h * k);
      paint();
      if (photoTex) gl.deleteTexture(photoTex);
      photoTex = tex(art.width, art.height, art);
    };

    /* one pass of `prog` over the state, into the other texture */
    const pass = (prog: ReturnType<typeof program>, set: () => void) => {
      gl.useProgram(prog.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, states[cur]);
      gl.uniform1i(prog.u("state"), 0);
      set();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[1 - cur]);
      gl.viewport(0, 0, sim.w, sim.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      cur = 1 - cur;
    };

    const queue: Drop[] = [];
    const add = (d: Drop) => {
      if (queue.length < 12) queue.push(d);
    };

    /* -- the pointer: a wake while moving, a stone on a tap ------------ */
    let last: { x: number; y: number } | null = null;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    const onMove = (e: PointerEvent) => {
      const p = at(e);
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
      const dist = last ? Math.hypot((p.x - last.x) * aspect, p.y - last.y) : 0;
      if (!last || dist > 0.006) {
        add({ ...p, r: 0.022, s: Math.min(0.05, 0.012 + dist * 1.2) });
        last = p;
      }
    };
    const onDown = (e: PointerEvent) => add({ ...at(e), r: 0.05, s: -0.7 });
    const onLeave = () => (last = null);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerleave", onLeave);

    /* -- pause off screen ---------------------------------------------- */
    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 });
    io.observe(host);
    const ro = new ResizeObserver(() => size());
    ro.observe(host);
    size();

    if (image) {
      void loadImage(image)
        .then((img) => {
          if (disposed) return;
          photo = img;
          size();
        })
        .catch(() => {
          /* the silk stays */
        });
    }

    /* an opening stone, so the water announces itself */
    const opening = window.setTimeout(() => add({ x: 0.68, y: 0.42, r: 0.09, s: -0.9 }), 700);

    let raf = 0;
    let nextRain = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;

      if (t > nextRain) {
        add({ x: Math.random(), y: Math.random(), r: 0.012 + Math.random() * 0.02, s: (Math.random() - 0.5) * 0.12 });
        nextRain = t + 380 + Math.random() * 900;
      }
      for (const d of queue.splice(0, 6)) {
        pass(drop, () => {
          gl.uniform2f(drop.u("center"), d.x, d.y);
          gl.uniform1f(drop.u("radius"), d.r);
          gl.uniform1f(drop.u("strength"), d.s);
          gl.uniform1f(drop.u("aspect"), aspect);
        });
      }
      for (let i = 0; i < 2; i++) {
        pass(step, () => gl.uniform2f(step.u("texel"), 1 / sim.w, 1 / sim.h));
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(show.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, states[cur]);
      gl.uniform1i(show.u("state"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, photoTex);
      gl.uniform1i(show.u("photo"), 1);
      gl.uniform2f(show.u("texel"), 1 / sim.w, 1 / sim.h);
      gl.uniform1f(show.u("refraction"), 1.6);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(opening);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerleave", onLeave);
      states.forEach((t) => gl.deleteTexture(t));
      fbos.forEach((f) => gl.deleteFramebuffer(f));
      if (photoTex) gl.deleteTexture(photoTex);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      [step, drop, show].forEach((x) => gl.deleteProgram(x.p));
    };
  }, [image]);

  return (
    <div className="water" aria-hidden="true">
      <canvas ref={ref} className="water__gl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {still ? <img className="water__still" src={still} alt="" /> : null}
    </div>
  );
}
