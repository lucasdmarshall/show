//! Event galleries — the other end of the QR code on every guest card.
//!
//! The studio's desk uploads the event, its guests, and each photograph
//! once it is guest-ready. A guest scanning `/e/{event}/{code}` sees only
//! the photographs tagged with their code, and can save them all at once.

use std::io::{Cursor, Write};

use axum::{
    Json,
    extract::{Multipart, Path, Query, State},
    http::header,
    response::{Html, IntoResponse, Redirect, Response},
};
use rusqlite::{OptionalExtension, params};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    auth::User,
    db::now,
    error::{ApiError, ApiResult, bad},
    generate::safe_name,
};

#[derive(Deserialize)]
pub struct GuestIn {
    pub code: String,
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventIn {
    pub name: String,
    #[serde(default)]
    pub name_my: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub place: String,
    #[serde(default)]
    pub guests: Vec<GuestIn>,
}

fn valid_code(c: &str) -> bool {
    (3..=8).contains(&c.len()) && c.chars().all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit())
}

fn clip(s: &str, n: usize) -> String {
    s.trim().chars().take(n).collect()
}

/// The event must be new, or already ours.
async fn own(st: &AppState, user: &User, event: &str) -> ApiResult<bool> {
    let (e, u) = (event.to_string(), user.id.clone());
    st.db
        .run(move |c| {
            let owner: Option<String> = c.query_row("SELECT user_id FROM events WHERE id = ?1", [&e], |r| r.get(0)).optional()?;
            match owner {
                Some(o) if o != u => Err(ApiError::Forbidden("this event belongs to another account".into())),
                Some(_) => Ok(true),
                None => Ok(false),
            }
        })
        .await
}

pub async fn put_event(State(st): State<AppState>, user: User, Path(id): Path<String>, Json(ev): Json<EventIn>) -> ApiResult<Json<serde_json::Value>> {
    if !safe_name(&id) {
        return Err(bad("bad event id"));
    }
    if ev.guests.iter().any(|g| !valid_code(&g.code)) {
        return Err(bad("a guest code must be 3–8 of A–Z and 0–9"));
    }
    own(&st, &user, &id).await?;
    let uid = user.id.clone();
    let eid = id.clone();
    st.db
        .run(move |c| {
            let tx = c.transaction()?;
            tx.execute(
                "INSERT INTO events (id, user_id, name, name_my, date, place, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_my = excluded.name_my, date = excluded.date,
                   place = excluded.place, updated = excluded.updated",
                params![eid, uid, clip(&ev.name, 120), clip(&ev.name_my, 120), clip(&ev.date, 20), clip(&ev.place, 120), now()],
            )?;
            tx.execute("DELETE FROM guests WHERE event_id = ?1", [&eid])?;
            for g in &ev.guests {
                tx.execute("INSERT OR REPLACE INTO guests (event_id, code, name) VALUES (?1, ?2, ?3)", params![eid, g.code, clip(&g.name, 80)])?;
            }
            tx.commit()?;
            Ok(())
        })
        .await?;
    Ok(Json(json!({ "url": format!("{}/e/{id}", st.cfg.public_url) })))
}

#[derive(Deserialize)]
pub struct PhotoMeta {
    pub id: String,
    #[serde(default)]
    pub guests: Vec<String>,
}

async fn set_guests(st: &AppState, event: &str, photo: &str, guests: Vec<String>) -> ApiResult<()> {
    let (e, p) = (event.to_string(), photo.to_string());
    st.db
        .run(move |c| {
            let tx = c.transaction()?;
            tx.execute("DELETE FROM photo_guests WHERE event_id = ?1 AND photo_id = ?2", params![e, p])?;
            for g in guests.iter().filter(|g| valid_code(g)) {
                tx.execute("INSERT OR IGNORE INTO photo_guests (event_id, photo_id, code) VALUES (?1, ?2, ?3)", params![e, p, g])?;
            }
            tx.commit()?;
            Ok(())
        })
        .await
}

pub async fn post_photo(State(st): State<AppState>, user: User, Path(event): Path<String>, mut form: Multipart) -> ApiResult<Json<serde_json::Value>> {
    if !own(&st, &user, &event).await? {
        return Err(bad("publish the event before its photographs"));
    }
    let mut meta: Option<PhotoMeta> = None;
    let mut photo: Option<Vec<u8>> = None;
    while let Some(f) = form.next_field().await.map_err(|e| bad(e.to_string()))? {
        let name = f.name().unwrap_or_default().to_string();
        let bytes = f.bytes().await.map_err(|e| bad(e.to_string()))?;
        match name.as_str() {
            "meta" => meta = Some(serde_json::from_slice(&bytes).map_err(|e| bad(format!("meta: {e}")))?),
            "photo" => photo = Some(bytes.to_vec()),
            _ => {}
        }
    }
    let meta = meta.ok_or_else(|| bad("missing meta"))?;
    let photo = photo.ok_or_else(|| bad("missing photo"))?;
    if !safe_name(&meta.id) {
        return Err(bad("bad photo id"));
    }
    if image::guess_format(&photo).map(|f| f != image::ImageFormat::Jpeg).unwrap_or(true) {
        return Err(bad("the photograph must be a JPEG"));
    }

    /* a thumbnail for the gallery grid, made here once */
    let (w, h, thumb) = tokio::task::spawn_blocking({
        let photo = photo.clone();
        move || -> anyhow::Result<(u32, u32, Vec<u8>)> {
            let img = image::load_from_memory(&photo)?;
            let t = img.thumbnail(720, 720).to_rgb8();
            let mut out = Cursor::new(Vec::new());
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 82).encode_image(&t)?;
            Ok((img.width(), img.height(), out.into_inner()))
        }
    })
    .await
    .map_err(|e| ApiError::Internal(e.into()))?
    .map_err(|_| bad("that photograph could not be read"))?;

    let dir = st.cfg.data.join("events").join(&event);
    tokio::fs::create_dir_all(&dir).await?;
    tokio::fs::write(dir.join(format!("{}.jpg", meta.id)), &photo).await?;
    tokio::fs::write(dir.join(format!("{}.t.jpg", meta.id)), &thumb).await?;

    let (e, p) = (event.clone(), meta.id.clone());
    st.db
        .run(move |c| {
            c.execute(
                "INSERT INTO event_photos (id, event_id, w, h, created) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(event_id, id) DO UPDATE SET w = excluded.w, h = excluded.h",
                params![p, e, w, h, now()],
            )?;
            Ok(())
        })
        .await?;
    set_guests(&st, &event, &meta.id, meta.guests).await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct Guests {
    pub guests: Vec<String>,
}

pub async fn put_photo_guests(State(st): State<AppState>, user: User, Path((event, photo)): Path<(String, String)>, Json(g): Json<Guests>) -> ApiResult<Json<serde_json::Value>> {
    if !own(&st, &user, &event).await? {
        return Err(ApiError::NotFound);
    }
    set_guests(&st, &event, &photo, g.guests).await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_photo(State(st): State<AppState>, user: User, Path((event, photo)): Path<(String, String)>) -> ApiResult<Json<serde_json::Value>> {
    if !own(&st, &user, &event).await? || !safe_name(&photo) {
        return Err(ApiError::NotFound);
    }
    let (e, p) = (event.clone(), photo.clone());
    st.db
        .run(move |c| {
            c.execute("DELETE FROM event_photos WHERE event_id = ?1 AND id = ?2", params![e, p])?;
            Ok(())
        })
        .await?;
    let dir = st.cfg.data.join("events").join(&event);
    let _ = tokio::fs::remove_file(dir.join(format!("{photo}.jpg"))).await;
    let _ = tokio::fs::remove_file(dir.join(format!("{photo}.t.jpg"))).await;
    Ok(Json(json!({ "ok": true })))
}

/* -- the public side ---------------------------------------------- */

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

fn page(title: &str, body: &str) -> Html<String> {
    Html(format!(
        r#"<!doctype html><html lang="my"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Plus+Jakarta+Sans:wght@200;500;800&display=swap">
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#08080a;color:#f2efe9;font:500 16px/1.7 "Plus Jakarta Sans","Padauk",system-ui,sans-serif}}
.my{{font-family:"Padauk",sans-serif;line-height:1.9}}header{{padding:28px 16px 8px;text-align:center}}
.k{{font-weight:800;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#d4a22f}}
h1{{font-weight:700;font-size:clamp(24px,6vw,44px);margin:6px 0 0;color:#f0c75e}}
.sub{{color:#9c978e;margin:4px 0 0}}
main{{max-width:1200px;margin:0 auto;padding:16px;columns:2 150px;column-gap:10px}}
figure{{margin:0 0 10px;break-inside:avoid}}figure img{{display:block;width:100%;height:auto;border-radius:4px;background:#111}}
figure a{{display:block;font-size:12px;color:#9c978e;text-decoration:none;padding:6px 0}}
.all{{display:block;max-width:360px;margin:8px auto 0;text-align:center;padding:14px;border-radius:6px;background:#d4a22f;color:#08080a;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;font-size:13px}}
form{{display:flex;gap:8px;max-width:360px;margin:24px auto;padding:0 16px}}
input{{flex:1;font:700 20px monospace;letter-spacing:.3em;text-transform:uppercase;padding:12px;border-radius:6px;border:1px solid #d4a22f55;background:#000;color:#f2efe9;text-align:center}}
button{{font:800 13px "Plus Jakarta Sans";letter-spacing:.1em;padding:0 18px;border:0;border-radius:6px;background:#d4a22f;color:#08080a}}
footer{{text-align:center;color:#625e58;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding:32px 16px}}
@media(min-width:900px){{main{{columns:4 240px;column-gap:14px}}}}
</style></head><body>{body}<footer>Made with SHOW</footer></body></html>"#,
        t = esc(title)
    ))
}

struct EventRow {
    name: String,
    name_my: String,
    date: String,
    place: String,
}

async fn event_row(st: &AppState, id: &str) -> ApiResult<EventRow> {
    let id = id.to_string();
    st.db
        .run(move |c| {
            Ok(c.query_row("SELECT name, name_my, date, place FROM events WHERE id = ?1", [&id], |r| {
                Ok(EventRow { name: r.get(0)?, name_my: r.get(1)?, date: r.get(2)?, place: r.get(3)? })
            })
            .optional()?)
        })
        .await?
        .ok_or(ApiError::NotFound)
}

fn head(ev: &EventRow) -> String {
    format!(
        r#"<header><div class="k">{d}{p}</div><h1 class="my">{n}</h1>{en}</header>"#,
        d = esc(&ev.date),
        p = if ev.place.is_empty() { String::new() } else { format!(" · {}", esc(&ev.place)) },
        n = esc(if ev.name_my.is_empty() { &ev.name } else { &ev.name_my }),
        en = if ev.name_my.is_empty() { String::new() } else { format!(r#"<p class="sub">{}</p>"#, esc(&ev.name)) },
    )
}

#[derive(Deserialize)]
pub struct CodeQuery {
    pub code: Option<String>,
}

pub async fn landing(State(st): State<AppState>, Path(id): Path<String>, Query(q): Query<CodeQuery>) -> ApiResult<Response> {
    if let Some(code) = q.code.map(|c| c.trim().to_uppercase()).filter(|c| valid_code(c)) {
        return Ok(Redirect::to(&format!("/e/{id}/{code}")).into_response());
    }
    let ev = event_row(&st, &id).await?;
    let body = format!(
        r#"{h}<p class="sub my" style="text-align:center">ကိုယ့်ကတ်ပေါ်က code ကို ရိုက်ထည့်ပါ</p>
<form method="get"><input name="code" maxlength="8" autocomplete="off" autocapitalize="characters" aria-label="Code"><button>OPEN</button></form>"#,
        h = head(&ev)
    );
    Ok(page(&ev.name, &body).into_response())
}

async fn guest_photos(st: &AppState, event: &str, code: &str) -> ApiResult<(String, Vec<(String, u32, u32)>)> {
    let (e, c) = (event.to_string(), code.to_string());
    st.db
        .run(move |conn| {
            let name: Option<String> = conn.query_row("SELECT name FROM guests WHERE event_id = ?1 AND code = ?2", params![e, c], |r| r.get(0)).optional()?;
            let name = name.ok_or(ApiError::NotFound)?;
            let mut s = conn.prepare(
                "SELECT p.id, p.w, p.h FROM event_photos p JOIN photo_guests g ON g.event_id = p.event_id AND g.photo_id = p.id
                 WHERE p.event_id = ?1 AND g.code = ?2 ORDER BY p.created",
            )?;
            let rows = s.query_map(params![e, c], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<Vec<_>, _>>()?;
            Ok((name, rows))
        })
        .await
}

pub async fn gallery(State(st): State<AppState>, Path((id, code)): Path<(String, String)>) -> ApiResult<Html<String>> {
    let code = code.to_uppercase();
    let ev = event_row(&st, &id).await?;
    let (guest, photos) = guest_photos(&st, &id, &code).await?;
    let figs: String = photos
        .iter()
        .map(|(p, w, h)| {
            format!(
                r#"<figure><a href="{p}.jpg" download><img src="{p}.t.jpg" width="{w}" height="{h}" loading="lazy" alt=""></a></figure>"#,
                p = format!("/e/{id}/{code}/p/{p}"),
            )
        })
        .collect();
    let body = format!(
        r#"{h}<p class="sub my" style="text-align:center">{g} · ပုံ {n}</p>{all}<main>{figs}</main>{empty}"#,
        h = head(&ev),
        g = esc(&guest),
        n = photos.len(),
        all = if photos.is_empty() { String::new() } else { format!(r#"<a class="all" href="/e/{id}/{code}/all.zip">Save all · အကုန်သိမ်း</a>"#) },
        empty = if photos.is_empty() { r#"<p class="sub my" style="text-align:center">ပုံတွေ မကြာခင် ရောက်လာပါမယ်</p>"#.to_string() } else { String::new() },
    );
    Ok(page(&format!("{} · {}", ev.name, guest), &body))
}

async fn tagged(st: &AppState, event: &str, code: &str, photo: &str) -> ApiResult<()> {
    let (e, c, p) = (event.to_string(), code.to_uppercase(), photo.to_string());
    let ok = st
        .db
        .run(move |conn| {
            Ok(conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM photo_guests WHERE event_id = ?1 AND code = ?2 AND photo_id = ?3)",
                params![e, c, p],
                |r| r.get::<_, bool>(0),
            )?)
        })
        .await?;
    if ok { Ok(()) } else { Err(ApiError::NotFound) }
}

pub async fn photo(State(st): State<AppState>, Path((id, code, file)): Path<(String, String, String)>) -> ApiResult<impl IntoResponse> {
    let pid = file.strip_suffix(".t.jpg").or_else(|| file.strip_suffix(".jpg")).ok_or(ApiError::NotFound)?;
    if !safe_name(pid) || !safe_name(&id) {
        return Err(ApiError::NotFound);
    }
    tagged(&st, &id, &code, pid).await?;
    let bytes = tokio::fs::read(st.cfg.data.join("events").join(&id).join(&file)).await.map_err(|_| ApiError::NotFound)?;
    Ok(([(header::CONTENT_TYPE, "image/jpeg"), (header::CACHE_CONTROL, "private, max-age=3600")], bytes))
}

pub async fn all_zip(State(st): State<AppState>, Path((id, code)): Path<(String, String)>) -> ApiResult<impl IntoResponse> {
    let code = code.to_uppercase();
    let ev = event_row(&st, &id).await?;
    let (_, photos) = guest_photos(&st, &id, &code).await?;
    let dir = st.cfg.data.join("events").join(&id);
    let bytes = tokio::task::spawn_blocking(move || -> anyhow::Result<Vec<u8>> {
        let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
        /* already JPEG: store, do not deflate */
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (i, (p, _, _)) in photos.iter().enumerate() {
            let data = std::fs::read(dir.join(format!("{p}.jpg")))?;
            w.start_file(format!("{:03}.jpg", i + 1), opts)?;
            w.write_all(&data)?;
        }
        Ok(w.finish()?.into_inner())
    })
    .await
    .map_err(|e| ApiError::Internal(e.into()))??;
    let name: String = ev.name.chars().filter(|c| c.is_ascii_alphanumeric()).take(40).collect();
    Ok((
        [
            (header::CONTENT_TYPE, "application/zip".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}-{code}.zip\"", if name.is_empty() { "photos" } else { &name })),
        ],
        bytes,
    ))
}
