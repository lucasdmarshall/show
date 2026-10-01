//! The image models a member can choose between.
//!
//! Each entry says what the web app needs in order to draw its picker
//! honestly: the vendor, which frame shapes it takes, whether it edits,
//! how many reference photographs it reads, and whether it can return
//! several results in one call.

use serde::Serialize;

use crate::config::{Config, ProviderKind};

#[derive(Clone, Debug, Serialize)]
pub struct Model {
    /// what the web app sends back
    pub id: String,
    /// the id at the provider (an OpenRouter slug, an OpenAI model name…)
    #[serde(skip)]
    pub slug: String,
    pub label: String,
    pub vendor: &'static str,
    /// one line on what it is good at, in English and in Burmese
    pub note: &'static str,
    pub note_my: &'static str,
    pub aspects: Vec<&'static str>,
    /// reference photographs it will read alongside the prompt
    pub refs: u8,
    /// can return several images from one call; otherwise SHOW fans out
    #[serde(skip)]
    pub batch: bool,
    /// sent only to models that take it — OpenRouter rejects unknown parameters
    #[serde(skip)]
    pub resolution: Option<&'static str>,
    #[serde(skip)]
    pub quality: Option<&'static str>,
}

pub const NANO: &str = "nano-banana-pro";
pub const SUNBURST: &str = "gpt-image-sunburst";

const NANO_ASPECTS: &[&str] = &["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"];
const SUNBURST_ASPECTS: &[&str] = &["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];

fn nano(slug: &str) -> Model {
    Model {
        id: NANO.into(),
        slug: slug.into(),
        label: "Nano Banana Pro".into(),
        vendor: "Google",
        note: "Composes from up to 14 references; holds faces across edits; 4K",
        note_my: "Reference ပုံ ၁၄ ပုံအထိ ပေါင်းလို့ရ · edit လုပ်လည်း မျက်နှာမပြောင်း · 4K",
        aspects: NANO_ASPECTS.to_vec(),
        refs: 14,
        batch: false,
        resolution: Some("2K"),
        quality: None,
    }
}

fn sunburst(slug: &str) -> Model {
    Model {
        id: SUNBURST.into(),
        slug: slug.into(),
        label: "GPT Image 2.5 Sunburst".into(),
        vendor: "OpenAI",
        note: "Precision edits and fine detail; slower, sharper",
        note_my: "Edit ကို တိကျစွာ · အသေးစိတ် ကြည်လင် · နည်းနည်းကြာ",
        aspects: SUNBURST_ASPECTS.to_vec(),
        refs: 16,
        batch: true,
        resolution: None,
        quality: Some("high"),
    }
}

/// The models this server can run, in the order the picker shows them.
pub fn available(cfg: &Config) -> Vec<Model> {
    match &cfg.provider {
        ProviderKind::OpenRouter { nano: n, sunburst: s, .. } => vec![nano(n), sunburst(s)],
        /* dev stands in for both, so the picker can be built without a key */
        ProviderKind::Dev => vec![nano("dev"), sunburst("dev")],
        ProviderKind::OpenAi { model, .. } => vec![Model { label: model.clone(), ..sunburst(model) }],
        ProviderKind::Comfy { checkpoint, .. } => vec![Model {
            id: "comfyui".into(),
            label: format!("ComfyUI · {checkpoint}"),
            vendor: "ComfyUI",
            note: "Your own ComfyUI, the same graph SHOW hands out",
            note_my: "ကိုယ်ပိုင် ComfyUI — SHOW ပေးတဲ့ graph အတိုင်း",
            refs: 1,
            batch: true,
            ..nano(checkpoint)
        }],
    }
}

/// The nearest frame the model accepts, by ratio.
pub fn nearest_aspect(model: &Model, aspect: &str) -> String {
    let ratio = |a: &str| {
        a.split_once(':')
            .and_then(|(w, h)| Some(w.trim().parse::<f32>().ok()? / h.trim().parse::<f32>().ok()?))
            .unwrap_or(1.0)
    };
    let want = ratio(aspect).ln();
    model
        .aspects
        .iter()
        .min_by(|a, b| (ratio(a).ln() - want).abs().total_cmp(&(ratio(b).ln() - want).abs()))
        .unwrap_or(&"1:1")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aspects_snap_to_what_the_model_takes() {
        let s = sunburst("x");
        assert_eq!(nearest_aspect(&s, "4:5"), "3:4");
        assert_eq!(nearest_aspect(&s, "16:9"), "16:9");
        let n = nano("x");
        assert_eq!(nearest_aspect(&n, "4:5"), "4:5");
        assert_eq!(nearest_aspect(&n, "junk"), "1:1");
    }
}
