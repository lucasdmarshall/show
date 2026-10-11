//! Everything the server is told from outside, read once at start.

use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug)]
pub enum ProviderKind {
    /// Deterministic local images, for building and testing without a GPU or a key.
    Dev,
    /// OpenAI's image models — generations, and edits with a mask.
    OpenAi { key: String, model: String, base: String },
    /// A ComfyUI the studio runs itself.
    Comfy { url: String, checkpoint: String },
    /// OpenRouter — one key, both image models (Nano Banana Pro, GPT Image
    /// 2.5 Sunburst) through its unified Images API.
    OpenRouter { key: String, base: String, nano: String, sunburst: String },
}

/// The text model that refines a crafted prompt. Without a key, a local
/// tidy-up stands in so the button still does something honest.
#[derive(Clone, Debug)]
pub enum Refiner {
    Dev,
    OpenRouter { key: String, base: String, model: String },
}

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: SocketAddr,
    /// How the outside world reaches this server — used for every URL it hands out.
    pub public_url: String,
    pub data: PathBuf,
    /// Web origins allowed to call with credentials.
    pub origins: Vec<String>,
    pub provider: ProviderKind,
    pub refiner: Refiner,
    /// refinements per account per day — they are free, but not unlimited
    pub refine_daily: i64,
    /// most images one request may make — each one is paid for upstream
    pub max_images: u8,
    /// Every signed-in account counts as a member. Local development only.
    pub dev_premium: bool,
    /// Firebase project whose ID tokens sign people in; None = passwords only
    pub firebase_project: Option<String>,
}

fn var(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let bind: SocketAddr = var("SHOW_BIND", "127.0.0.1:8080").parse()?;
        let router_key = env::var("OPENROUTER_API_KEY").ok().filter(|k| !k.trim().is_empty());
        let router_base = var("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");
        let default_provider = if router_key.is_some() { "openrouter" } else { "dev" };
        let provider = match var("SHOW_PROVIDER", default_provider).as_str() {
            "openrouter" => ProviderKind::OpenRouter {
                key: router_key.clone().ok_or_else(|| anyhow::anyhow!("SHOW_PROVIDER=openrouter needs OPENROUTER_API_KEY"))?,
                base: router_base.clone(),
                nano: var("SHOW_MODEL_NANO", "google/gemini-3-pro-image"),
                sunburst: var("SHOW_MODEL_SUNBURST", "openai/gpt-image-2.5-sunburst"),
            },
            "openai" => ProviderKind::OpenAi {
                key: env::var("OPENAI_API_KEY").map_err(|_| anyhow::anyhow!("SHOW_PROVIDER=openai needs OPENAI_API_KEY"))?,
                model: var("SHOW_OPENAI_MODEL", "gpt-image-1"),
                base: var("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            },
            "comfyui" => ProviderKind::Comfy {
                url: var("COMFYUI_URL", "http://127.0.0.1:8188"),
                checkpoint: var("COMFYUI_CKPT", "sdxl_base_1.0.safetensors"),
            },
            "dev" => ProviderKind::Dev,
            other => anyhow::bail!("unknown SHOW_PROVIDER {other:?} — use openrouter, dev, openai or comfyui"),
        };
        let refiner = match router_key {
            Some(key) => Refiner::OpenRouter { key, base: router_base, model: var("SHOW_REFINE_MODEL", "openai/gpt-4.1") },
            None => Refiner::Dev,
        };
        Ok(Self {
            bind,
            public_url: var("SHOW_PUBLIC_URL", &format!("http://localhost:{}", bind.port()))
                .trim_end_matches('/')
                .to_string(),
            data: PathBuf::from(var("SHOW_DATA", "data")),
            origins: var("SHOW_ORIGINS", "http://localhost:3000")
                .split(',')
                .map(|s| s.trim().trim_end_matches('/').to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            provider,
            refiner,
            refine_daily: var("SHOW_REFINE_DAILY", "120").parse().unwrap_or(120),
            max_images: var("SHOW_MAX_IMAGES", "1").parse::<u8>().unwrap_or(1).clamp(1, 4),
            dev_premium: var("SHOW_DEV_PREMIUM", "0") == "1",
            firebase_project: env::var("FIREBASE_PROJECT_ID").ok().filter(|p| !p.trim().is_empty()),
        })
    }

    /// A configuration for tests: a temporary data folder, the dev provider.
    pub fn for_tests(data: PathBuf) -> Self {
        Self {
            bind: "127.0.0.1:0".parse().unwrap(),
            public_url: "http://show.test".into(),
            data,
            origins: vec!["http://localhost:3000".into()],
            provider: ProviderKind::Dev,
            refiner: Refiner::Dev,
            refine_daily: 5,
            max_images: 1,
            dev_premium: false,
            firebase_project: None,
        }
    }

    pub fn secure_cookies(&self) -> bool {
        self.public_url.starts_with("https://")
    }
}
