//! The whole server, through its HTTP surface, on a temporary data folder.

use std::io::{Cursor, Write};

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use show_server::{AppState, app, auth, config::Config};
use tower::ServiceExt;

struct T {
    app: Router,
    _dir: tempfile::TempDir,
    db: std::path::PathBuf,
}

fn setup() -> T {
    let dir = tempfile::tempdir().unwrap();
    let st = AppState::new(Config::for_tests(dir.path().to_path_buf())).unwrap();
    T { app: app(st), db: dir.path().join("show.db"), _dir: dir }
}

async fn send(app: &Router, req: Request<Body>) -> (StatusCode, Vec<u8>, header::HeaderMap) {
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes().to_vec();
    (status, body, headers)
}

fn json_req(method: &str, uri: &str, token: Option<&str>, body: Value) -> Request<Body> {
    let mut b = Request::builder().method(method).uri(uri).header(header::CONTENT_TYPE, "application/json");
    if let Some(t) = token {
        b = b.header(header::AUTHORIZATION, format!("Bearer {t}"));
    }
    b.body(Body::from(body.to_string())).unwrap()
}

fn multipart(uri: &str, token: &str, parts: &[(&str, &str, Vec<u8>)]) -> Request<Body> {
    let boundary = "----showtest";
    let mut body = Vec::new();
    for (name, ctype, data) in parts {
        write!(body, "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{name}\"\r\nContent-Type: {ctype}\r\n\r\n").unwrap();
        body.extend_from_slice(data);
        body.extend_from_slice(b"\r\n");
    }
    write!(body, "--{boundary}--\r\n").unwrap();
    Request::builder()
        .method("POST")
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, format!("multipart/form-data; boundary={boundary}"))
        .body(Body::from(body))
        .unwrap()
}

fn jpeg(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_fn(w, h, |x, y| image::Rgb([(x % 255) as u8, (y % 255) as u8, 120]));
    let mut out = Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img).write_to(&mut out, image::ImageFormat::Jpeg).unwrap();
    out.into_inner()
}

async fn signup(t: &T, login: &str) -> String {
    let (s, b, h) = send(&t.app, json_req("POST", "/v1/auth/signup", None, json!({ "login": login, "password": "correct horse", "name": "Aung" }))).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    let cookie = h.get(header::SET_COOKIE).unwrap().to_str().unwrap();
    assert!(cookie.contains("HttpOnly") && cookie.contains("SameSite=Lax"), "{cookie}");
    serde_json::from_slice::<Value>(&b).unwrap()["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn accounts() {
    let t = setup();
    let token = signup(&t, "09 781 234 567").await;

    let (s, b, _) = send(&t.app, json_req("GET", "/v1/me", Some(&token), json!({}))).await;
    assert_eq!(s, StatusCode::OK);
    let me: Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(me["login"], "09781234567");
    assert_eq!(me["member"], false);

    /* the same person cannot sign up twice */
    let (s, _, _) = send(&t.app, json_req("POST", "/v1/auth/signup", None, json!({ "login": "09781234567", "password": "another pass" }))).await;
    assert_eq!(s, StatusCode::CONFLICT);

    let (s, _, _) = send(&t.app, json_req("POST", "/v1/auth/login", None, json!({ "login": "09781234567", "password": "wrong one" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, b, _) = send(&t.app, json_req("POST", "/v1/auth/login", None, json!({ "login": "+09781234567".trim_start_matches('+'), "password": "correct horse" }))).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));

    let (s, _, _) = send(&t.app, json_req("POST", "/v1/auth/logout", Some(&token), json!({}))).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _, _) = send(&t.app, json_req("GET", "/v1/me", Some(&token), json!({}))).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED, "a logged-out token is dead");

    let (s, _, _) = send(&t.app, json_req("POST", "/v1/auth/signup", None, json!({ "login": "09123456789", "password": "short" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn generation_is_for_members() {
    let t = setup();
    let request = json!({ "section": "background", "prompt": "Shwedagon at dusk", "negative": "watermark", "seed": 424242, "count": 4, "aspect": "4:5" });
    let parts = |img: Option<Vec<u8>>| {
        let mut p = vec![("request", "application/json", request.to_string().into_bytes())];
        if let Some(i) = img {
            p.push(("image", "image/jpeg", i));
        }
        p
    };

    /* signed out */
    let res = t.app.clone().oneshot(multipart("/v1/generate", "nobody", &parts(None))).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    /* signed in, not a member */
    let token = signup(&t, "aung@example.com").await;
    let (s, b, _) = send(&t.app, multipart("/v1/generate", &token, &parts(None))).await;
    assert_eq!(s, StatusCode::PAYMENT_REQUIRED);
    assert_eq!(serde_json::from_slice::<Value>(&b).unwrap()["error"], "membership");

    /* a member */
    auth::grant(&t.db, "aung@example.com", 30).unwrap();
    let (s, b, _) = send(&t.app, multipart("/v1/generate", &token, &parts(Some(jpeg(320, 400))))).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    let out: Value = serde_json::from_slice(&b).unwrap();
    let images = out["images"].as_array().unwrap();
    assert_eq!(images.len(), 4, "four results to choose from");
    assert_eq!(out["provider"], "dev");

    /* each result can be fetched without credentials */
    let path = images[0].as_str().unwrap().strip_prefix("http://show.test").unwrap().to_string();
    let (s, b, h) = send(&t.app, Request::get(&path).body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(h.get(header::CONTENT_TYPE).unwrap(), "image/png");
    let img = image::load_from_memory(&b).unwrap();
    assert_eq!((img.width(), img.height()), (320, 400), "an edit keeps the photograph's size");

    /* a bad request is refused before anything runs */
    let bad = json!({ "section": "x", "prompt": "", "seed": 1, "count": 9, "aspect": "1:1" });
    let (s, _, _) = send(&t.app, multipart("/v1/generate", &token, &[("request", "application/json", bad.to_string().into_bytes())])).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _, _) = send(&t.app, Request::get("/files/gen/..%2Fshow.db").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}

fn site_zip(extra: Option<&str>) -> Vec<u8> {
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let o = zip::write::SimpleFileOptions::default();
    w.start_file("index.html", o).unwrap();
    w.write_all(b"<!doctype html><meta property=\"og:image\" content=\"og.jpg\">\n<meta name=\"twitter:card\" content=\"summary_large_image\"><img src=\"images/001.jpg\">").unwrap();
    w.start_file("og.jpg", o).unwrap();
    w.write_all(&jpeg(120, 63)).unwrap();
    w.start_file("images/001.jpg", o).unwrap();
    w.write_all(&jpeg(200, 300)).unwrap();
    if let Some(name) = extra {
        w.start_file(name, o).unwrap();
        w.write_all(b"x").unwrap();
    }
    w.finish().unwrap().into_inner()
}

fn put_zip(uri: &str, token: &str, body: Vec<u8>) -> Request<Body> {
    Request::put(uri)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/zip")
        .body(Body::from(body))
        .unwrap()
}

#[tokio::test]
async fn portfolios() {
    let t = setup();
    let a = signup(&t, "09111111111").await;
    let b = signup(&t, "09222222222").await;

    let (s, body, _) = send(&t.app, put_zip("/v1/portfolio/aungmyat", &a, site_zip(None))).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    assert_eq!(serde_json::from_slice::<Value>(&body).unwrap()["url"], "http://show.test/@aungmyat/");

    /* the handle is taken */
    let (s, _, _) = send(&t.app, put_zip("/v1/portfolio/aungmyat", &b, site_zip(None))).await;
    assert_eq!(s, StatusCode::CONFLICT);

    /* nothing but the site's own files, and nothing that climbs out */
    for evil in ["../escape.jpg", "images/x.js", "run.sh"] {
        let (s, _, _) = send(&t.app, put_zip("/v1/portfolio/other", &b, site_zip(Some(evil)))).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{evil} must be refused");
    }
    let (s, _, _) = send(&t.app, put_zip("/v1/portfolio/admin", &b, site_zip(None))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "reserved handle");
    /* a refused upload does not claim the handle */
    let (s, _, _) = send(&t.app, put_zip("/v1/portfolio/other", &a, site_zip(None))).await;
    assert_eq!(s, StatusCode::OK, "\"other\" is still free after b's bad uploads");

    /* served publicly, with an absolute share image */
    let (s, _, h) = send(&t.app, Request::get("/@aungmyat").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::PERMANENT_REDIRECT);
    assert_eq!(h.get(header::LOCATION).unwrap(), "/@aungmyat/");
    let (s, html, _) = send(&t.app, Request::get("/@aungmyat/").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    let html = String::from_utf8(html).unwrap();
    assert!(html.contains("content=\"http://show.test/@aungmyat/og.jpg\""), "{html}");
    assert!(html.contains("og:url"));
    let (s, _, h) = send(&t.app, Request::get("/@aungmyat/images/001.jpg").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(h.get(header::CONTENT_TYPE).unwrap(), "image/jpeg");
    let (s, _, _) = send(&t.app, Request::get("/@nobody/").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _, _) = send(&t.app, Request::get("/not-a-handle/").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn event_galleries() {
    let t = setup();
    let owner = signup(&t, "09333333333").await;
    let stranger = signup(&t, "09444444444").await;
    let ev = json!({ "name": "Aung Myat & Thinzar", "nameMy": "အောင်မြတ် နှင့် သဉ္ဇာ", "date": "2026-12-12", "place": "Strand",
                     "guests": [{ "code": "L9AJ", "name": "ဒေါ်ခင်မာ" }, { "code": "XW7W", "name": "U Tun Tun" }] });
    let (s, _, _) = send(&t.app, json_req("PUT", "/v1/events/ev1abc", Some(&owner), ev.clone())).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _, _) = send(&t.app, json_req("PUT", "/v1/events/ev1abc", Some(&stranger), ev)).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "someone else's event");

    for (id, guests) in [("p1", json!(["L9AJ"])), ("p2", json!(["L9AJ", "XW7W"])), ("p3", json!([]))] {
        let meta = json!({ "id": id, "guests": guests }).to_string().into_bytes();
        let (s, b, _) = send(&t.app, multipart("/v1/events/ev1abc/photos", &owner, &[("meta", "application/json", meta), ("photo", "image/jpeg", jpeg(800, 600))])).await;
        assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    }

    /* a guest sees only their own photographs */
    let (s, html, _) = send(&t.app, Request::get("/e/ev1abc/L9AJ").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    let html = String::from_utf8(html).unwrap();
    assert!(html.contains("/p/p1.t.jpg") && html.contains("/p/p2.t.jpg") && !html.contains("/p/p3"), "{html}");
    assert!(html.contains("ဒေါ်ခင်မာ"));
    let (s, _, _) = send(&t.app, Request::get("/e/ev1abc/XW7W/p/p1.jpg").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::NOT_FOUND, "p1 is not XW7W's");
    let (s, _, _) = send(&t.app, Request::get("/e/ev1abc/XW7W/p/p2.jpg").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _, _) = send(&t.app, Request::get("/e/ev1abc/ZZZZ").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::NOT_FOUND);

    /* retagging moves a photograph between galleries */
    let (s, _, _) = send(&t.app, json_req("PUT", "/v1/events/ev1abc/photos/p3/guests", Some(&owner), json!({ "guests": ["XW7W"] }))).await;
    assert_eq!(s, StatusCode::OK);
    let (_, html, _) = send(&t.app, Request::get("/e/ev1abc/XW7W").body(Body::empty()).unwrap()).await;
    assert!(String::from_utf8(html).unwrap().contains("/p/p3.t.jpg"));

    /* save all */
    let (s, z, h) = send(&t.app, Request::get("/e/ev1abc/L9AJ/all.zip").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(h.get(header::CONTENT_TYPE).unwrap(), "application/zip");
    assert_eq!(zip::ZipArchive::new(Cursor::new(z)).unwrap().len(), 2);

    /* the landing page turns a typed code into the gallery */
    let (s, _, h) = send(&t.app, Request::get("/e/ev1abc?code=l9aj").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::SEE_OTHER);
    assert_eq!(h.get(header::LOCATION).unwrap(), "/e/ev1abc/L9AJ");
}

#[tokio::test]
async fn cors_allows_the_web_app_with_credentials() {
    let t = setup();
    let req = Request::builder()
        .method("OPTIONS")
        .uri("/v1/generate")
        .header(header::ORIGIN, "http://localhost:3000")
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
        .body(Body::empty())
        .unwrap();
    let (_, _, h) = send(&t.app, req).await;
    assert_eq!(h.get(header::ACCESS_CONTROL_ALLOW_ORIGIN).unwrap(), "http://localhost:3000");
    assert_eq!(h.get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS).unwrap(), "true");

    let req = Request::builder()
        .method("OPTIONS")
        .uri("/v1/generate")
        .header(header::ORIGIN, "https://evil.example")
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
        .body(Body::empty())
        .unwrap();
    let (_, _, h) = send(&t.app, req).await;
    assert!(h.get(header::ACCESS_CONTROL_ALLOW_ORIGIN).is_none());
}

#[tokio::test]
async fn models_and_refine() {
    let t = setup();
    let (s, b, _) = send(&t.app, Request::get("/v1/models").body(Body::empty()).unwrap()).await;
    assert_eq!(s, StatusCode::OK);
    let m: Value = serde_json::from_slice(&b).unwrap();
    let ids: Vec<&str> = m["models"].as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap()).collect();
    assert_eq!(ids, ["nano-banana-pro", "gpt-image-sunburst"]);
    assert!(m["models"][0].get("slug").is_none(), "provider slugs stay on the server");

    /* refining needs an account, not a membership */
    let body = json!({ "prompt": "gold light, gold light, a bride" });
    let (s, _, _) = send(&t.app, json_req("POST", "/v1/refine", None, body.clone())).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let token = signup(&t, "09555555555").await;
    let (s, b, _) = send(&t.app, json_req("POST", "/v1/refine", Some(&token), body.clone())).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    let r: Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(r["prompt"], "gold light, a bride");
    assert_eq!(r["model"], "dev");
    assert_eq!(r["left"], 4);

    let (s, _, _) = send(&t.app, json_req("POST", "/v1/refine", Some(&token), json!({ "prompt": "  " }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    /* a long prompt — every choice at once — comes back whole, never cut */
    let long = (0..3000).map(|i| format!("detail {i}")).collect::<Vec<_>>().join(", ");
    let (s, b, _) = send(&t.app, json_req("POST", "/v1/refine", Some(&token), json!({ "prompt": long }))).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    let r: Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(r["prompt"].as_str().unwrap(), long);

    /* the daily allowance (5 in tests) */
    for _ in 0..3 {
        let (s, _, _) = send(&t.app, json_req("POST", "/v1/refine", Some(&token), body.clone())).await;
        assert_eq!(s, StatusCode::OK);
    }
    let (s, _, _) = send(&t.app, json_req("POST", "/v1/refine", Some(&token), body)).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn choosing_a_model_and_editing_with_a_reference() {
    let t = setup();
    let token = signup(&t, "ma@example.com").await;
    auth::grant(&t.db, "ma@example.com", 1).unwrap();

    let req = |model: &str| json!({ "section": "create", "model": model, "prompt": "make the longyi emerald", "seed": 9, "count": 1, "aspect": "4:5" }).to_string().into_bytes();
    let (s, b, _) = send(&t.app, multipart("/v1/generate", &token, &[("request", "application/json", req("imaginary"))])).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{}", String::from_utf8_lossy(&b));

    let parts = [
        ("request", "application/json", req("gpt-image-sunburst")),
        ("image", "image/jpeg", jpeg(300, 375)),
        ("ref", "image/jpeg", jpeg(64, 64)),
    ];
    let (s, b, _) = send(&t.app, multipart("/v1/generate", &token, &parts)).await;
    assert_eq!(s, StatusCode::OK, "{}", String::from_utf8_lossy(&b));
    let out: Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(out["model"], "gpt-image-sunburst");
    assert_eq!(out["images"].as_array().unwrap().len(), 1);
}
