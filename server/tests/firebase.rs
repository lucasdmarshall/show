//! Firebase sign-in, with ID tokens the test signs itself.

use std::collections::HashMap;

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, encode};
use serde_json::{Value, json};
use show_server::{AppState, app, config::Config, firebase::Verifier};
use tower::ServiceExt;

const PROJECT: &str = "show-test";
const PRIVATE: &[u8] = include_bytes!("fixtures/firebase-test.key");
const PUBLIC: &[u8] = include_bytes!("fixtures/firebase-test.pub");

fn now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64
}

fn setup(with_firebase: bool) -> (Router, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let mut st = AppState::new(Config::for_tests(dir.path().to_path_buf())).unwrap();
    if with_firebase {
        let keys = HashMap::from([("k1".to_string(), DecodingKey::from_rsa_pem(PUBLIC).unwrap())]);
        st = st.with_firebase(Verifier::fixed(PROJECT.into(), keys));
    }
    (app(st), dir)
}

fn token(claims: Value) -> String {
    let mut h = Header::new(Algorithm::RS256);
    h.kid = Some("k1".into());
    encode(&h, &claims, &EncodingKey::from_rsa_pem(PRIVATE).unwrap()).unwrap()
}

fn claims(sub: &str, extra: Value) -> Value {
    let mut c = json!({
        "iss": format!("https://securetoken.google.com/{PROJECT}"),
        "aud": PROJECT,
        "sub": sub,
        "iat": now() - 10,
        "exp": now() + 3600,
        "auth_time": now() - 10,
    });
    c.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
    c
}

async fn post(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let req = Request::post(uri).header(header::CONTENT_TYPE, "application/json").body(Body::from(body.to_string())).unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let s = res.status();
    let b = res.into_body().collect().await.unwrap().to_bytes();
    (s, serde_json::from_slice(&b).unwrap_or(Value::Null))
}

#[tokio::test]
async fn phone_sign_in_makes_one_account() {
    let (app, _d) = setup(true);
    let t = token(claims("uid-phone", json!({ "phone_number": "+959781234567" })));
    let (s, me) = post(&app, "/v1/auth/firebase", json!({ "idToken": t, "name": "မမြတ်" })).await;
    assert_eq!(s, StatusCode::OK, "{me}");
    assert_eq!(me["login"], "+959781234567");
    assert_eq!(me["name"], "မမြတ်");
    assert_eq!(me["member"], false);

    /* again: the same account, not a second one */
    let (s, again) = post(&app, "/v1/auth/firebase", json!({ "idToken": token(claims("uid-phone", json!({ "phone_number": "+959781234567" }))) })).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(again["id"], me["id"]);

    /* the session works like any other */
    let req = Request::get("/v1/me").header(header::AUTHORIZATION, format!("Bearer {}", again["token"].as_str().unwrap())).body(Body::empty()).unwrap();
    assert_eq!(app.clone().oneshot(req).await.unwrap().status(), StatusCode::OK);
}

#[tokio::test]
async fn only_verified_identities_link_to_existing_accounts() {
    let (app, _d) = setup(true);
    let (s, existing) = post(&app, "/v1/auth/signup", json!({ "login": "ma@example.com", "password": "correct horse" })).await;
    assert_eq!(s, StatusCode::OK);

    /* an unverified email must not take over the password account */
    let (s, other) = post(&app, "/v1/auth/firebase", json!({ "idToken": token(claims("uid-x", json!({ "email": "ma@example.com", "email_verified": false }))) })).await;
    assert_eq!(s, StatusCode::OK);
    assert_ne!(other["id"], existing["id"]);
    assert_eq!(other["login"], "firebase:uid-x");

    /* a verified one (Google) links to it */
    let (s, linked) = post(&app, "/v1/auth/firebase", json!({ "idToken": token(claims("uid-g", json!({ "email": "Ma@Example.com", "email_verified": true, "name": "Ma" }))) })).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(linked["id"], existing["id"]);

    /* and a Firebase-made account has no password to guess */
    let (s, _) = post(&app, "/v1/auth/login", json!({ "login": "firebase:uid-x", "password": "" })).await;
    assert_ne!(s, StatusCode::OK);
}

#[tokio::test]
async fn bad_tokens_are_refused() {
    let (app, _d) = setup(true);
    let cases = [
        ("wrong project", token(json!({ "iss": "https://securetoken.google.com/someone-else", "aud": "someone-else", "sub": "u", "iat": now(), "exp": now() + 600, "auth_time": now() }))),
        ("expired", token(claims("u", json!({ "exp": now() - 600, "iat": now() - 4000 })))),
        ("garbage", "not.a.token".to_string()),
    ];
    for (what, t) in cases {
        let (s, _) = post(&app, "/v1/auth/firebase", json!({ "idToken": t })).await;
        assert_eq!(s, StatusCode::FORBIDDEN, "{what}");
    }
    /* signed by someone else's key */
    let mut h = Header::new(Algorithm::HS256);
    h.kid = Some("k1".into());
    let forged = encode(&h, &claims("u", json!({})), &EncodingKey::from_secret(b"guess")).unwrap();
    let (s, _) = post(&app, "/v1/auth/firebase", json!({ "idToken": forged })).await;
    assert_eq!(s, StatusCode::FORBIDDEN, "HS256 forgery");
}

#[tokio::test]
async fn without_a_project_firebase_is_off() {
    let (app, _d) = setup(false);
    let (s, _) = post(&app, "/v1/auth/firebase", json!({ "idToken": token(claims("u", json!({}))) })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}
