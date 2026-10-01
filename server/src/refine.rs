//! POST /v1/refine — the crafted prompt, rewritten by a language model.
//!
//! SHOW's catalogue decides what the photograph is; the model only writes
//! it better, for the image models SHOW runs. It may not add or drop a
//! decision — and it may not shorten the prompt to fit a budget, because
//! there is none. Free for every signed-in account, within a daily
//! allowance.

use axum::{Json, extract::State};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::User,
    config::Refiner,
    db::now,
    error::{ApiError, ApiResult, bad},
    generate::MAX_PROMPT,
};

#[derive(Deserialize)]
pub struct RefineIn {
    pub prompt: String,
    #[serde(default)]
    pub negative: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct RefineOut {
    pub prompt: String,
    pub negative: String,
    pub notes: Vec<String>,
    pub model: String,
    /// refinements left today
    pub left: i64,
}

pub const SYSTEM_PROMPT: &str = "You refine image prompts for SHOW, a photography studio app in Myanmar.\n\
The prompt you receive was compiled from choices the photographer made. Rewrite it for a modern image model (Gemini / GPT Image): \
clear natural-language sentences describing one photograph, subject first, then setting, light, lens and finish.\n\
Rules:\n\
- Keep every decision: subject, wardrobe, pose, place, light, lens, framing, grade. Add nothing the photographer did not choose except craft (ordering, precise wording, photographic vocabulary).\n\
- Never shorten by dropping detail. There is no length limit: the result may be as long as it needs to be to keep everything.\n\
- If the prompt numbers images (image 1, image 2 …), keep every numbered sentence and what it says to take from or keep in each image, word for word in meaning.\n\
- Burmese garments and places are already translated into description — keep those descriptions, do not rename them to English brand-like terms.\n\
- Never ask for text, letters, captions or watermarks in the image.\n\
- Return the things to avoid as a short comma-separated list in \"negative\" (keep the one given, tidied); do not repeat them in the prompt.\n\
Reply with JSON only: {\"prompt\": string, \"negative\": string, \"notes\": [short strings, at most 3, on what you changed]}.";

/// The first JSON object in the reply — models wrap it in fences or prose.
pub fn parse_reply(text: &str) -> Option<(String, String, Vec<String>)> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    let v: Value = serde_json::from_str(&text[start..=end]).ok()?;
    let prompt = v["prompt"].as_str()?.trim().to_string();
    if prompt.is_empty() {
        return None;
    }
    let negative = v["negative"].as_str().unwrap_or_default().trim().to_string();
    let notes = v["notes"]
        .as_array()
        .map(|a| a.iter().filter_map(|n| n.as_str().map(|s| s.trim().to_string())).take(3).collect())
        .unwrap_or_default();
    Some((prompt, negative, notes))
}

/// Without a key: tidy the prompt locally and say so — repeated phrases
/// go, nothing else does.
fn dev_refine(prompt: &str, negative: &str) -> (String, String, Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    let out = prompt
        .split(',')
        .map(|p| p.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|p| !p.is_empty() && seen.insert(p.to_lowercase()))
        .collect::<Vec<_>>()
        .join(", ");
    (out, negative.trim().to_string(), vec!["Tidied on the server without a model — add an OpenRouter key for a real refinement.".into()])
}

pub async fn refine(State(st): State<AppState>, user: User, Json(req): Json<RefineIn>) -> ApiResult<Json<RefineOut>> {
    if req.prompt.trim().is_empty() || req.prompt.len() > MAX_PROMPT {
        return Err(bad("the prompt is empty or too long"));
    }

    /* the daily allowance, counted in a rolling day */
    let limit = st.cfg.refine_daily;
    let uid = user.id.clone();
    let used: i64 = st
        .db
        .run(move |c| Ok(c.query_row("SELECT COUNT(*) FROM refines WHERE user_id = ?1 AND created > ?2", params![uid, now() - 86_400], |r| r.get(0))?))
        .await?;
    if used >= limit {
        return Err(ApiError::Forbidden(format!("today's {limit} refinements are used — they come back tomorrow")));
    }

    let (prompt, negative, notes, model) = match &st.cfg.refiner {
        Refiner::Dev => {
            let (p, n, notes) = dev_refine(&req.prompt, &req.negative);
            (p, n, notes, "dev".to_string())
        }
        Refiner::OpenRouter { key, base, model } => {
            let body = json!({
                "model": model,
                "temperature": 0.4,
                "response_format": { "type": "json_object" },
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    { "role": "user", "content": json!({ "prompt": req.prompt, "negative": req.negative }).to_string() }
                ]
            });
            let res = st
                .http
                .post(format!("{base}/chat/completions"))
                .bearer_auth(key)
                .header("X-Title", "SHOW")
                .json(&body)
                .send()
                .await
                .map_err(|e| ApiError::Provider(format!("could not reach the refine model: {e}")))?;
            let status = res.status();
            let v: Value = res.json().await.unwrap_or(Value::Null);
            if !status.is_success() {
                tracing::warn!("refine {status}: {v}");
                return Err(ApiError::Provider("the refine model did not answer — try again".into()));
            }
            let text = v["choices"][0]["message"]["content"].as_str().unwrap_or_default();
            let (p, n, notes) = parse_reply(text).ok_or_else(|| ApiError::Provider("the refine model's answer could not be read".into()))?;
            (p, n, notes, model.clone())
        }
    };

    let uid = user.id.clone();
    st.db
        .run(move |c| {
            c.execute("INSERT INTO refines (user_id, target, created) VALUES (?1, 'image', ?2)", params![uid, now()])?;
            Ok(())
        })
        .await?;
    Ok(Json(RefineOut { prompt, negative, notes, model, left: (limit - used - 1).max(0) }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_fenced_json() {
        let r = parse_reply("Sure!\n```json\n{\"prompt\": \"a bride\", \"negative\": \"blur\", \"notes\": [\"a\", \"b\"]}\n```").unwrap();
        assert_eq!(r.0, "a bride");
        assert_eq!(r.1, "blur");
        assert_eq!(r.2.len(), 2);
        assert!(parse_reply("no json here").is_none());
        assert!(parse_reply("{\"prompt\": \"\"}").is_none());
    }

    #[test]
    fn dev_tidies_without_cutting() {
        let (p, _, notes) = dev_refine("gold light,  gold light, a bride ,, silk", "");
        assert_eq!(p, "gold light, a bride, silk");
        assert_eq!(notes.len(), 1);
        let long = (0..2000).map(|i| format!("detail {i}")).collect::<Vec<_>>().join(", ");
        assert_eq!(dev_refine(&long, "").0, long);
    }

    #[test]
    fn system_prompt_sets_no_budget() {
        assert!(SYSTEM_PROMPT.contains("no length limit"));
        assert!(SYSTEM_PROMPT.contains("image 1, image 2"));
        assert!(!SYSTEM_PROMPT.contains("tokens"));
    }
}
