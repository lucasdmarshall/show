//! Portfolios — the static site the web app builds, served at /@handle/.
//!
//! The upload is exactly the zip the app hands people to host themselves:
//! index.html, og.jpg, images/*.jpg. Nothing else is accepted, no path can
//! leave the site's folder, and a handle belongs to whoever claimed it.

use std::{
    io::{Cursor, Read},
    path::PathBuf,
};

use axum::{
    Json,
    body::Bytes,
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Redirect, Response},
};
use rusqlite::{OptionalExtension, params};
use serde_json::json;

use crate::{
    AppState,
    auth::User,
    db::now,
    error::{ApiError, ApiResult, bad},
    generate::{content_type, safe_name},
};

const RESERVED: &[&str] = &["admin", "api", "e", "files", "health", "show", "v1", "www", "help", "login", "signup"];
const MAX_FILES: usize = 1200;
const MAX_TOTAL: u64 = 600 * 1024 * 1024;

pub fn valid_handle(h: &str) -> bool {
    (2..=30).contains(&h.len())
        && h.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '_' | '-'))
        && !h.starts_with('.')
        && !RESERVED.contains(&h)
}

/// Which paths a portfolio zip may contain.
fn allowed(path: &str) -> bool {
    match path {
        "index.html" | "og.jpg" => true,
        p => p.strip_prefix("images/").is_some_and(|f| safe_name(f) && f.to_ascii_lowercase().ends_with(".jpg")),
    }
}

fn site_dir(st: &AppState, handle: &str) -> PathBuf {
    st.cfg.data.join("sites").join(handle)
}

pub async fn publish(State(st): State<AppState>, user: User, Path(handle): Path<String>, body: Bytes) -> ApiResult<Json<serde_json::Value>> {
    let handle = handle.to_lowercase();
    if !valid_handle(&handle) {
        return Err(bad("that handle is not allowed — 2 to 30 of a–z, 0–9, dot, dash, underscore"));
    }

    /* someone else's handle is refused before anything is unpacked */
    {
        let (h, uid) = (handle.clone(), user.id.clone());
        st.db
            .run(move |c| {
                let owner: Option<String> = c.query_row("SELECT user_id FROM handles WHERE handle = ?1", [&h], |r| r.get(0)).optional()?;
                match owner {
                    Some(o) if o != uid => Err(ApiError::Conflict("someone else already has that handle".into())),
                    _ => Ok(()),
                }
            })
            .await?;
    }

    /* unpack into a fresh folder, then swap it in */
    let root = st.cfg.data.join("sites");
    let final_dir = site_dir(&st, &handle);
    let staging = root.join(format!(".{handle}-{}", crate::db::new_id()));
    let count = tokio::task::spawn_blocking({
        let staging = staging.clone();
        move || -> ApiResult<usize> {
            let mut zip = zip::ZipArchive::new(Cursor::new(body)).map_err(|_| bad("that is not a zip file"))?;
            if zip.len() > MAX_FILES {
                return Err(bad("too many files in the site"));
            }
            std::fs::create_dir_all(staging.join("images"))?;
            let mut total = 0u64;
            let mut has_index = false;
            for i in 0..zip.len() {
                let mut f = zip.by_index(i).map_err(|e| bad(e.to_string()))?;
                if f.is_dir() {
                    continue;
                }
                let name = f.name().replace('\\', "/");
                if !allowed(&name) || f.enclosed_name().is_none() {
                    return Err(bad(format!("{name} does not belong in a portfolio")));
                }
                total += f.size();
                if total > MAX_TOTAL {
                    return Err(bad("the site is larger than 600 MB"));
                }
                let mut buf = Vec::with_capacity(f.size() as usize);
                f.read_to_end(&mut buf)?;
                if name.ends_with(".jpg") && image::guess_format(&buf).map(|f| f != image::ImageFormat::Jpeg).unwrap_or(true) {
                    return Err(bad(format!("{name} is not a JPEG")));
                }
                has_index |= name == "index.html";
                std::fs::write(staging.join(&name), buf)?;
            }
            if !has_index {
                return Err(bad("the site has no index.html"));
            }
            Ok(zip.len())
        }
    })
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let count = match count {
        Ok(n) => n,
        Err(e) => {
            let _ = tokio::fs::remove_dir_all(&staging).await;
            return Err(e);
        }
    };
    let old = root.join(format!(".{handle}-old-{}", crate::db::new_id()));
    if tokio::fs::metadata(&final_dir).await.is_ok() {
        tokio::fs::rename(&final_dir, &old).await?;
    }
    tokio::fs::rename(&staging, &final_dir).await?;
    let _ = tokio::fs::remove_dir_all(&old).await;

    /* the site is in place: now the handle is claimed */
    {
        let (h, uid) = (handle.clone(), user.id.clone());
        st.db
            .run(move |c| {
                let owner: Option<String> = c.query_row("SELECT user_id FROM handles WHERE handle = ?1", [&h], |r| r.get(0)).optional()?;
                match owner {
                    Some(o) if o != uid => Err(ApiError::Conflict("someone else already has that handle".into())),
                    Some(_) => {
                        c.execute("UPDATE handles SET updated = ?1 WHERE handle = ?2", params![now(), h])?;
                        Ok(())
                    }
                    None => {
                        c.execute("INSERT INTO handles (handle, user_id, updated) VALUES (?1, ?2, ?3)", params![h, uid, now()])?;
                        Ok(())
                    }
                }
            })
            .await?;
    }


    Ok(Json(json!({ "url": format!("{}/@{handle}/", st.cfg.public_url), "files": count })))
}

/// The page, with the share card's image made absolute — Facebook will not
/// follow a relative og:image.
fn rewrite_index(html: &str, base: &str) -> String {
    let mut out = html.replace(
        r#"<meta property="og:image" content="og.jpg">"#,
        &format!(r#"<meta property="og:image" content="{base}og.jpg">"#),
    );
    if !out.contains(r#"property="og:url""#) {
        out = out.replacen("<meta name=\"twitter:card\"", &format!("<meta property=\"og:url\" content=\"{base}\">\n<meta name=\"twitter:card\""), 1);
    }
    out
}

/// GET /@handle and /@handle/…  — routed from `/{seg}` because the path
/// router matches whole segments only.
pub async fn serve(st: &AppState, seg: &str, rest: Option<&str>) -> ApiResult<Response> {
    let Some(handle) = seg.strip_prefix('@').map(str::to_lowercase) else {
        return Err(ApiError::NotFound);
    };
    if !valid_handle(&handle) {
        return Err(ApiError::NotFound);
    }
    let dir = site_dir(st, &handle);
    let Some(rest) = rest else {
        /* relative image paths need the trailing slash */
        return Ok(Redirect::permanent(&format!("/@{handle}/")).into_response());
    };
    let path = if rest.is_empty() { "index.html" } else { rest };
    if !allowed(path) {
        return Err(ApiError::NotFound);
    }
    let bytes = tokio::fs::read(dir.join(path)).await.map_err(|_| ApiError::NotFound)?;
    if path == "index.html" {
        let base = format!("{}/@{handle}/", st.cfg.public_url);
        let html = rewrite_index(&String::from_utf8_lossy(&bytes), &base);
        return Ok(([(header::CONTENT_TYPE, "text/html; charset=utf-8"), (header::CACHE_CONTROL, "public, max-age=60")], html).into_response());
    }
    Ok((StatusCode::OK, [(header::CONTENT_TYPE, content_type(path)), (header::CACHE_CONTROL, "public, max-age=3600")], bytes).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles() {
        assert!(valid_handle("aungmyat"));
        assert!(valid_handle("aung.myat_studio-2"));
        assert!(!valid_handle("a"));
        assert!(!valid_handle("Aung"));
        assert!(!valid_handle("../etc"));
        assert!(!valid_handle("admin"));
    }

    #[test]
    fn paths() {
        assert!(allowed("index.html"));
        assert!(allowed("images/001.jpg"));
        assert!(!allowed("images/../../x.jpg"));
        assert!(!allowed("script.js"));
        assert!(!allowed("images/a.png"));
        assert!(!allowed("images/sub/a.jpg"));
    }

    #[test]
    fn og_rewrite() {
        let html = "<meta property=\"og:image\" content=\"og.jpg\">\n<meta name=\"twitter:card\" content=\"x\">";
        let out = rewrite_index(html, "https://show.mm/@a/");
        assert!(out.contains("content=\"https://show.mm/@a/og.jpg\""));
        assert!(out.contains("og:url"));
    }
}
