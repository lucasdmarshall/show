//! Who actually makes the photograph.
//!
//! The web app sends one request shape; each provider turns it into its
//! own API. `dev` needs nothing and returns deterministic images, so the
//! whole flow — membership, storage, the four results — can be built and
//! tested without a GPU or a key. `openrouter` is the production path —
//! Nano Banana Pro and GPT Image 2.5 Sunburst behind one key; `openai`
//! and `comfyui` remain for studios that bring their own.

use std::{io::Cursor, time::Duration};

use base64::{Engine, engine::general_purpose::STANDARD};
use image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use serde_json::{Value, json};

use crate::{
    config::ProviderKind,
    models::{Model, nearest_aspect},
};

#[derive(Clone, Debug)]
pub struct Job {
    /// already checked against what this server offers
    pub model: Model,
    pub prompt: String,
    pub negative: String,
    pub image: Option<Vec<u8>>,
    pub mask: Option<Vec<u8>>,
    /// photographs to take from — a face, a garment, a place
    pub refs: Vec<Vec<u8>>,
    pub seed: u64,
    pub count: u8,
    pub aspect: String,
    /// 0–1, how far an edit may move from the source
    pub strength: Option<f32>,
}

/// Each result, as PNG bytes.
pub type Output = Vec<Vec<u8>>;

pub struct Provider {
    kind: ProviderKind,
    http: reqwest::Client,
}

impl Provider {
    pub fn new(kind: ProviderKind) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("http client");
        Self { kind, http }
    }

    pub fn name(&self) -> &'static str {
        match self.kind {
            ProviderKind::Dev => "dev",
            ProviderKind::OpenAi { .. } => "openai",
            ProviderKind::Comfy { .. } => "comfyui",
            ProviderKind::OpenRouter { .. } => "openrouter",
        }
    }

    pub async fn run(&self, job: Job) -> anyhow::Result<Output> {
        match &self.kind {
            ProviderKind::Dev => {
                let job = job.clone();
                tokio::task::spawn_blocking(move || dev(&job)).await?
            }
            ProviderKind::OpenAi { key, model, base } => openai(&self.http, key, model, base, &job).await,
            ProviderKind::Comfy { url, checkpoint } => comfy(&self.http, url, checkpoint, &job).await,
            ProviderKind::OpenRouter { key, base, .. } => openrouter(&self.http, key, base, &job).await,
        }
    }
}

/// The long side is 1024; the aspect decides the short one, in multiples of 8.
pub fn dimensions(aspect: &str) -> (u32, u32) {
    let (w, h) = aspect
        .split_once(':')
        .and_then(|(a, b)| Some((a.trim().parse::<f32>().ok()?, b.trim().parse::<f32>().ok()?)))
        .filter(|(a, b)| *a > 0.0 && *b > 0.0)
        .unwrap_or((1.0, 1.0));
    let k = 1024.0 / w.max(h);
    let r8 = |v: f32| ((v * k / 8.0).round() as u32).max(8) * 8;
    (r8(w), r8(h))
}

fn png(img: &DynamicImage) -> anyhow::Result<Vec<u8>> {
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, ImageFormat::Png)?;
    Ok(out.into_inner())
}

fn has_transparency(img: &DynamicImage) -> bool {
    img.color().has_alpha() && img.pixels().any(|(_, _, p)| p.0[3] < 250)
}

/* -- dev --------------------------------------------------------- */

/// Deterministic stand-ins: the source (or a gradient) tinted by seed and
/// index, with a gold hairline so nobody mistakes one for a real result.
fn dev(job: &Job) -> anyhow::Result<Output> {
    let base = match &job.image {
        Some(bytes) => image::load_from_memory(bytes)?.to_rgba8(),
        None => {
            let (w, h) = dimensions(&job.aspect);
            RgbaImage::from_fn(w, h, |x, y| {
                let t = y as f32 / h as f32;
                let s = x as f32 / w as f32;
                Rgba([(40.0 + 160.0 * t) as u8, (30.0 + 90.0 * s) as u8, (60.0 + 80.0 * (1.0 - t)) as u8, 255])
            })
        }
    };
    let mut out = Vec::new();
    for i in 0..job.count.max(1) {
        let mut img = base.clone();
        let mut s = job.seed.wrapping_mul(6364136223846793005).wrapping_add(i as u64 * 1442695040888963407);
        let mut next = || {
            s ^= s << 13;
            s ^= s >> 7;
            s ^= s << 17;
            (s % 1000) as f32 / 1000.0
        };
        let (tr, tg, tb) = (0.85 + 0.3 * next(), 0.85 + 0.3 * next(), 0.85 + 0.3 * next());
        let (w, h) = img.dimensions();
        for (x, y, p) in img.enumerate_pixels_mut() {
            p.0[0] = (p.0[0] as f32 * tr).min(255.0) as u8;
            p.0[1] = (p.0[1] as f32 * tg).min(255.0) as u8;
            p.0[2] = (p.0[2] as f32 * tb).min(255.0) as u8;
            let edge = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
            if edge {
                *p = Rgba([212, 162, 47, 255]);
            }
        }
        out.push(png(&DynamicImage::ImageRgba8(img))?);
    }
    Ok(out)
}

/* -- OpenAI ------------------------------------------------------ */

fn openai_size(aspect: &str) -> &'static str {
    let (w, h) = dimensions(aspect);
    if w > h + h / 8 {
        "1536x1024"
    } else if h > w + w / 8 {
        "1024x1536"
    } else {
        "1024x1024"
    }
}

async fn openai(http: &reqwest::Client, key: &str, model: &str, base: &str, job: &Job) -> anyhow::Result<Output> {
    /* no negative prompt in this API: fold it into the instruction */
    let prompt = if job.negative.trim().is_empty() {
        job.prompt.clone()
    } else {
        format!("{}\n\nAvoid: {}.", job.prompt, job.negative)
    };
    let size = openai_size(&job.aspect);
    let res = match &job.image {
        None => {
            http.post(format!("{base}/images/generations"))
                .bearer_auth(key)
                .json(&json!({ "model": model, "prompt": prompt, "n": job.count, "size": size }))
                .send()
                .await?
        }
        Some(bytes) => {
            let img = image::load_from_memory(bytes)?;
            let mut form = reqwest::multipart::Form::new()
                .text("model", model.to_string())
                .text("prompt", prompt)
                .text("n", job.count.to_string())
                .text("size", size)
                .part("image", reqwest::multipart::Part::bytes(png(&img)?).file_name("image.png").mime_str("image/png")?);
            /* the transparent part of the mask is what may change; a cut-out
               subject with no mask is its own mask */
            let mask = match &job.mask {
                Some(m) => Some(png(&image::load_from_memory(m)?)?),
                None if has_transparency(&img) => Some(png(&img)?),
                None => None,
            };
            if let Some(m) = mask {
                form = form.part("mask", reqwest::multipart::Part::bytes(m).file_name("mask.png").mime_str("image/png")?);
            }
            http.post(format!("{base}/images/edits")).bearer_auth(key).multipart(form).send().await?
        }
    };
    let status = res.status();
    let body: Value = res.json().await?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().unwrap_or("request failed");
        anyhow::bail!("openai {status}: {msg}");
    }
    let mut out = Vec::new();
    for d in body["data"].as_array().cloned().unwrap_or_default() {
        if let Some(b64) = d["b64_json"].as_str() {
            out.push(STANDARD.decode(b64)?);
        } else if let Some(url) = d["url"].as_str() {
            out.push(http.get(url).send().await?.bytes().await?.to_vec());
        }
    }
    anyhow::ensure!(!out.is_empty(), "openai returned no images");
    Ok(out)
}

/* -- OpenRouter -------------------------------------------------- */

fn data_url(bytes: &[u8]) -> String {
    let mime = match image::guess_format(bytes) {
        Ok(ImageFormat::Jpeg) => "image/jpeg",
        Ok(ImageFormat::WebP) => "image/webp",
        _ => "image/png",
    };
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

/// What the Images API is told. An edit names its source as the first
/// input image, so every model reads the references the same way.
pub fn openrouter_body(job: &Job, n: u8) -> Value {
    /* a prompt crafted in Studio already numbers its images and says what
       each is for; framing it again would contradict it */
    let framed = job.prompt.to_lowercase().contains("image 1");
    let mut prompt = match (&job.image, job.refs.is_empty()) {
        _ if framed => job.prompt.clone(),
        (Some(_), true) => format!("Edit the first image: {}", job.prompt),
        (Some(_), false) => format!(
            "Edit the first image: {}\nThe other images are references — take from them only what the instruction asks for.",
            job.prompt
        ),
        (None, false) => format!("{}\nUse the attached images as references.", job.prompt),
        (None, true) => job.prompt.clone(),
    };
    if !job.negative.trim().is_empty() {
        prompt.push_str(&format!("\n\nAvoid: {}.", job.negative.trim()));
    }
    let mut body = json!({
        "model": job.model.slug,
        "prompt": prompt,
        "n": n,
        "aspect_ratio": nearest_aspect(&job.model, &job.aspect),
    });
    if let Some(r) = job.model.resolution {
        body["resolution"] = json!(r);
    }
    if let Some(q) = job.model.quality {
        body["quality"] = json!(q);
    }
    let refs: Vec<Value> = job
        .image
        .iter()
        .chain(job.refs.iter())
        .map(|b| json!({ "type": "image_url", "image_url": { "url": data_url(b) } }))
        .collect();
    if !refs.is_empty() {
        body["input_references"] = Value::Array(refs);
    }
    body
}

async fn openrouter_once(http: &reqwest::Client, key: &str, base: &str, body: Value) -> anyhow::Result<Output> {
    let res = http
        .post(format!("{base}/images"))
        .bearer_auth(key)
        .header("X-Title", "SHOW")
        .json(&body)
        .send()
        .await?;
    let status = res.status();
    let v: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let msg = v["error"]["message"].as_str().unwrap_or("request failed");
        anyhow::bail!("openrouter {status}: {msg}");
    }
    let mut out = Vec::new();
    for d in v["data"].as_array().cloned().unwrap_or_default() {
        if let Some(b64) = d["b64_json"].as_str() {
            out.push(STANDARD.decode(b64)?);
        } else if let Some(url) = d["url"].as_str() {
            out.push(http.get(url).send().await?.error_for_status()?.bytes().await?.to_vec());
        }
    }
    anyhow::ensure!(!out.is_empty(), "openrouter returned no images");
    Ok(out)
}

async fn openrouter(http: &reqwest::Client, key: &str, base: &str, job: &Job) -> anyhow::Result<Output> {
    if job.model.batch {
        return openrouter_once(http, key, base, openrouter_body(job, job.count)).await;
    }
    /* one image per call: ask for them side by side, keep what arrives */
    let mut set = tokio::task::JoinSet::new();
    for _ in 0..job.count.max(1) {
        let (http, key, base, body) = (http.clone(), key.to_string(), base.to_string(), openrouter_body(job, 1));
        set.spawn(async move { openrouter_once(&http, &key, &base, body).await });
    }
    let mut out = Vec::new();
    let mut last = None;
    while let Some(r) = set.join_next().await {
        match r? {
            Ok(mut imgs) => out.append(&mut imgs),
            Err(e) => last = Some(e),
        }
    }
    if out.is_empty() {
        return Err(last.unwrap_or_else(|| anyhow::anyhow!("no images")));
    }
    Ok(out)
}

/* -- ComfyUI ----------------------------------------------------- */

/// The same graph the web app hands out for ComfyUI, with the seed pinned
/// and the batch set, so a studio's own ComfyUI gives what SHOW's would.
pub fn comfy_graph(job: &Job, checkpoint: &str, uploaded: Option<(&str, bool)>) -> Value {
    let (w, h) = dimensions(&job.aspect);
    let mut g = json!({
        "3": { "class_type": "KSampler", "inputs": {
            "seed": job.seed, "steps": 28, "cfg": 4.5, "sampler_name": "dpmpp_2m", "scheduler": "karras",
            "denoise": uploaded.map(|_| job.strength.unwrap_or(0.6).clamp(0.05, 1.0)).unwrap_or(1.0),
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]
        }},
        "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": checkpoint } },
        "6": { "class_type": "CLIPTextEncode", "inputs": { "text": job.prompt, "clip": ["4", 1] } },
        "7": { "class_type": "CLIPTextEncode", "inputs": { "text": job.negative, "clip": ["4", 1] } },
        "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
        "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "SHOW", "images": ["8", 0] } }
    });
    match uploaded {
        None => {
            g["5"] = json!({ "class_type": "EmptyLatentImage", "inputs": { "width": w, "height": h, "batch_size": job.count } });
        }
        Some((name, inpaint)) => {
            g["10"] = json!({ "class_type": "LoadImage", "inputs": { "image": name } });
            g["11"] = if inpaint {
                json!({ "class_type": "VAEEncodeForInpaint", "inputs": { "pixels": ["10", 0], "vae": ["4", 2], "mask": ["10", 1], "grow_mask_by": 8 } })
            } else {
                json!({ "class_type": "VAEEncode", "inputs": { "pixels": ["10", 0], "vae": ["4", 2] } })
            };
            g["5"] = json!({ "class_type": "RepeatLatentBatch", "inputs": { "samples": ["11", 0], "amount": job.count } });
            if inpaint {
                g["3"]["inputs"]["denoise"] = json!(1.0);
            }
        }
    }
    g
}

async fn comfy(http: &reqwest::Client, url: &str, checkpoint: &str, job: &Job) -> anyhow::Result<Output> {
    let uploaded = match &job.image {
        None => None,
        Some(bytes) => {
            let img = image::load_from_memory(bytes)?;
            let inpaint = has_transparency(&img);
            let name = format!("show-{}.png", crate::db::new_id());
            let form = reqwest::multipart::Form::new()
                .text("overwrite", "true")
                .part("image", reqwest::multipart::Part::bytes(png(&img)?).file_name(name).mime_str("image/png")?);
            let r: Value = http.post(format!("{url}/upload/image")).multipart(form).send().await?.error_for_status()?.json().await?;
            let stored = r["name"].as_str().ok_or_else(|| anyhow::anyhow!("comfyui upload: no name"))?.to_string();
            Some((stored, inpaint))
        }
    };
    let graph = comfy_graph(job, checkpoint, uploaded.as_ref().map(|(n, i)| (n.as_str(), *i)));
    let r: Value = http
        .post(format!("{url}/prompt"))
        .json(&json!({ "prompt": graph, "client_id": "show-server" }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let id = r["prompt_id"].as_str().ok_or_else(|| anyhow::anyhow!("comfyui: {r}"))?.to_string();

    /* poll the history until the graph has run */
    for _ in 0..300 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let h: Value = http.get(format!("{url}/history/{id}")).send().await?.json().await?;
        let Some(entry) = h.get(&id) else { continue };
        if entry["status"]["status_str"] == "error" {
            anyhow::bail!("comfyui reported an error running the graph");
        }
        let images = entry["outputs"]["9"]["images"].as_array().cloned().unwrap_or_default();
        if images.is_empty() {
            continue;
        }
        let mut out = Vec::new();
        for im in images {
            let bytes = http
                .get(format!("{url}/view"))
                .query(&[
                    ("filename", im["filename"].as_str().unwrap_or_default()),
                    ("subfolder", im["subfolder"].as_str().unwrap_or_default()),
                    ("type", im["type"].as_str().unwrap_or("output")),
                ])
                .send()
                .await?
                .error_for_status()?
                .bytes()
                .await?;
            out.push(bytes.to_vec());
        }
        return Ok(out);
    }
    anyhow::bail!("comfyui did not finish within five minutes")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dims() {
        assert_eq!(dimensions("1:1"), (1024, 1024));
        assert_eq!(dimensions("3:2"), (1024, 680));
        assert_eq!(dimensions("4:5"), (816, 1024));
        assert_eq!(dimensions("junk"), (1024, 1024));
        assert_eq!(openai_size("16:9"), "1536x1024");
        assert_eq!(openai_size("2:3"), "1024x1536");
    }

    #[test]
    fn dev_is_deterministic() {
        let job = Job { model: crate::models::available(&crate::config::Config::for_tests("x".into()))[0].clone(), prompt: "x".into(), negative: "".into(), image: None, mask: None, refs: vec![], seed: 42, count: 2, aspect: "1:1".into(), strength: None };
        let a = dev(&job).unwrap();
        let b = dev(&job).unwrap();
        assert_eq!(a.len(), 2);
        assert_eq!(a, b, "same seed, same frames");
        assert_ne!(a[0], a[1], "each of the four differs");
    }

    #[test]
    fn comfy_edit_graph() {
        let job = Job { model: crate::models::available(&crate::config::Config::for_tests("x".into()))[0].clone(), prompt: "p".into(), negative: "n".into(), image: Some(vec![]), mask: None, refs: vec![], seed: 7, count: 4, aspect: "4:5".into(), strength: Some(0.4) };
        let g = comfy_graph(&job, "ck", Some(("in.png", false)));
        assert_eq!(g["10"]["inputs"]["image"], "in.png");
        assert_eq!(g["11"]["class_type"], "VAEEncode");
        assert_eq!(g["5"]["inputs"]["amount"], 4);
        assert_eq!(g["3"]["inputs"]["seed"], 7);
        let inpaint = comfy_graph(&job, "ck", Some(("in.png", true)));
        assert_eq!(inpaint["11"]["class_type"], "VAEEncodeForInpaint");
        let txt = comfy_graph(&Job { image: None, ..job }, "ck", None);
        assert_eq!(txt["5"]["class_type"], "EmptyLatentImage");
        assert_eq!(txt["5"]["inputs"]["batch_size"], 4);
    }

    #[test]
    fn openrouter_request_shape() {
        let models = crate::models::available(&crate::config::Config::for_tests("x".into()));
        let png = png(&DynamicImage::ImageRgba8(RgbaImage::new(4, 4))).unwrap();
        let edit = Job {
            model: models[1].clone(),
            prompt: "make the longyi emerald".into(),
            negative: "watermark".into(),
            image: Some(png.clone()),
            mask: None,
            refs: vec![png],
            seed: 1,
            count: 2,
            aspect: "4:5".into(),
            strength: None,
        };
        let b = openrouter_body(&edit, 2);
        assert_eq!(b["aspect_ratio"], "3:4", "Sunburst has no 4:5");
        assert_eq!(b["n"], 2);
        assert!(b.get("resolution").is_none(), "Sunburst takes quality, not resolution");
        assert_eq!(b["quality"], "high");
        let refs = b["input_references"].as_array().unwrap();
        assert_eq!(refs.len(), 2, "the source first, then the reference");
        assert!(refs[0]["image_url"]["url"].as_str().unwrap().starts_with("data:image/png;base64,"));
        let p = b["prompt"].as_str().unwrap();
        assert!(p.starts_with("Edit the first image: make the longyi emerald") && p.contains("references") && p.ends_with("Avoid: watermark."));
        let crafted = openrouter_body(&Job { prompt: "Edit image 1, the photograph provided. From image 2, take the outfit.".into(), ..edit.clone() }, 1);
        assert!(crafted["prompt"].as_str().unwrap().starts_with("Edit image 1, the photograph provided."), "a crafted prompt is not framed twice");
        let plain = openrouter_body(&Job { image: None, refs: vec![], model: models[0].clone(), ..edit }, 1);
        assert!(plain.get("input_references").is_none());
        assert_eq!(plain["aspect_ratio"], "4:5");
        assert_eq!(plain["resolution"], "2K");
    }
}
