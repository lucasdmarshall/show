//! POST /v1/generate — the premium half of every room.
//!
//! Multipart: `request` (JSON), and optionally `image` and `mask`. Members
//! only. Every attempt is recorded; a failure is recorded as failed and
//! returns 502 — nothing is charged for it, whatever pricing becomes.

use axum::{
    Json,
    extract::{Multipart, Path, State},
    http::header,
    response::IntoResponse,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    auth::User,
    db::{new_id, now},
    error::{ApiError, ApiResult, bad},
    provider::Job,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenRequest {
    pub section: String,
    /// one of GET /v1/models; the first on offer when absent
    #[serde(default)]
    pub model: Option<String>,
    pub prompt: String,
    #[serde(default)]
    pub negative: String,
    pub seed: u64,
    pub count: u8,
    pub aspect: String,
    #[serde(default)]
    pub strength: Option<f32>,
}

#[derive(Serialize)]
pub struct GenResponse {
    pub id: String,
    pub images: Vec<String>,
    pub provider: &'static str,
    pub model: String,
    pub seed: u64,
}

const MAX_IMAGE: usize = 25 * 1024 * 1024;
/// A guard against abuse, not a budget: every option in the catalogue
/// chosen at once still fits, and nothing below it is ever shortened.
pub const MAX_PROMPT: usize = 64 * 1024;

pub async fn generate(State(st): State<AppState>, user: User, mut form: Multipart) -> ApiResult<Json<GenResponse>> {
    if !user.is_member() {
        return Err(ApiError::Membership);
    }

    let mut req: Option<GenRequest> = None;
    let mut image = None;
    let mut mask = None;
    let mut refs: Vec<Vec<u8>> = Vec::new();
    while let Some(field) = form.next_field().await.map_err(|e| bad(e.to_string()))? {
        let name = field.name().unwrap_or_default().to_string();
        let bytes = field.bytes().await.map_err(|e| bad(e.to_string()))?;
        match name.as_str() {
            "request" => req = Some(serde_json::from_slice(&bytes).map_err(|e| bad(format!("request: {e}")))?),
            "image" | "mask" | "ref" => {
                if bytes.len() > MAX_IMAGE {
                    return Err(bad("the photograph is larger than 25 MB"));
                }
                if image::guess_format(&bytes).is_err() {
                    return Err(bad(format!("{name} is not an image")));
                }
                match name.as_str() {
                    "image" => image = Some(bytes.to_vec()),
                    "mask" => mask = Some(bytes.to_vec()),
                    _ => refs.push(bytes.to_vec()),
                }
            }
            _ => {}
        }
    }
    let req = req.ok_or_else(|| bad("missing the request part"))?;
    if req.prompt.trim().is_empty() || req.prompt.len() > MAX_PROMPT {
        return Err(bad("the prompt is empty or too long"));
    }
    if !(1..=4).contains(&req.count) {
        return Err(bad("count must be 1 to 4"));
    }
    let model = match &req.model {
        Some(id) => st.models.iter().find(|m| &m.id == id).cloned().ok_or_else(|| bad(format!("no model called {id}")))?,
        None => st.models.first().cloned().ok_or_else(|| bad("no image model is configured"))?,
    };
    if refs.len() > model.refs as usize {
        return Err(bad(format!("{} reads at most {} reference photographs", model.label, model.refs)));
    }
    let section: String = req.section.chars().filter(|c| c.is_ascii_alphanumeric()).take(24).collect();

    let id = new_id();
    let provider = st.provider.name();
    {
        let (id, uid, section, prompt, negative, aspect, model_id) =
            (id.clone(), user.id.clone(), section.clone(), req.prompt.clone(), req.negative.clone(), req.aspect.clone(), model.id.clone());
        let (seed, count) = (req.seed as i64, req.count as i64);
        st.db
            .run(move |c| {
                c.execute(
                    "INSERT INTO generations (id, user_id, section, prompt, negative, seed, count, aspect, provider, model, status, created)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'running', ?11)",
                    params![id, uid, section, prompt, negative, seed, count, aspect, provider, model_id, now()],
                )?;
                Ok(())
            })
            .await?;
    }

    let model_id = model.id.clone();
    let job = Job {
        model,
        refs,
        prompt: req.prompt,
        negative: req.negative,
        image,
        mask,
        seed: req.seed,
        count: req.count,
        aspect: req.aspect,
        strength: req.strength,
    };
    let result = st.provider.run(job).await;

    let finish = |status: &'static str, error: Option<String>| {
        let id = id.clone();
        let db = st.db.clone();
        async move {
            db.run(move |c| {
                c.execute(
                    "UPDATE generations SET status = ?1, error = ?2, finished = ?3 WHERE id = ?4",
                    params![status, error, now(), id],
                )?;
                Ok(())
            })
            .await
        }
    };

    let outputs = match result {
        Ok(o) => o,
        Err(e) => {
            tracing::warn!("generation {id} failed: {e:#}");
            finish("failed", Some(format!("{e:#}"))).await?;
            /* the upstream account, not the member, is out of credit */
            let text = format!("{e:#}");
            let msg = if text.contains("402") {
                "the image service is out of credit on SHOW's side — nothing was charged; try again later"
            } else if text.contains("429") {
                "the image service is busy — nothing was charged; try again in a minute"
            } else {
                "the image engine did not return a result — nothing was charged"
            };
            return Err(ApiError::Provider(msg.into()));
        }
    };

    let dir = st.cfg.data.join("gen");
    tokio::fs::create_dir_all(&dir).await?;
    let mut images = Vec::new();
    for (i, bytes) in outputs.iter().enumerate() {
        let ext = match image::guess_format(bytes) {
            Ok(image::ImageFormat::Jpeg) => "jpg",
            Ok(image::ImageFormat::WebP) => "webp",
            _ => "png",
        };
        /* unguessable, because the results are fetched without credentials */
        let file = format!("{id}-{i}-{}.{ext}", new_id());
        tokio::fs::write(dir.join(&file), bytes).await?;
        images.push(format!("{}/files/gen/{file}", st.cfg.public_url));
    }
    finish("done", None).await?;
    Ok(Json(GenResponse { id, images, provider, model: model_id, seed: req.seed }))
}

pub fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("html") => "text/html; charset=utf-8",
        Some("zip") => "application/zip",
        _ => "application/octet-stream",
    }
}

/// A file name that cannot climb out of its folder.
pub fn safe_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 120 && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')) && !name.starts_with('.')
}

pub async fn file(State(st): State<AppState>, Path(name): Path<String>) -> ApiResult<impl IntoResponse> {
    if !safe_name(&name) {
        return Err(ApiError::NotFound);
    }
    let bytes = tokio::fs::read(st.cfg.data.join("gen").join(&name)).await.map_err(|_| ApiError::NotFound)?;
    Ok((
        [(header::CONTENT_TYPE, content_type(&name)), (header::CACHE_CONTROL, "public, max-age=31536000, immutable")],
        bytes,
    ))
}
