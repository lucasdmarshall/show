//! SHOW's server. The web app does everything it can on the device; this
//! is the part that cannot be: accounts and membership, making photographs
//! on real image engines, and the public addresses — portfolios at
//! /@handle/ and every guest's gallery at /e/{event}/{code}.

pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod events;
pub mod firebase;
pub mod generate;
pub mod models;
pub mod portfolio;
pub mod provider;
pub mod refine;

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderValue, Method, header},
    response::Response,
    routing::{delete, get, post, put},
};
use serde_json::json;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{config::Config, db::Db, error::ApiResult, provider::Provider};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub db: Db,
    pub provider: Arc<Provider>,
    /// the image models on offer, in picker order
    pub models: Arc<Vec<models::Model>>,
    /// for calls that are not image generation (the refine model)
    pub http: reqwest::Client,
    /// checks Firebase ID tokens, when a Firebase project is configured
    pub firebase: Option<Arc<firebase::Verifier>>,
}

impl AppState {
    pub fn new(cfg: Config) -> anyhow::Result<Self> {
        std::fs::create_dir_all(&cfg.data)?;
        let db = Db::open(&cfg.data.join("show.db"))?;
        let provider = Arc::new(Provider::new(cfg.provider.clone()));
        let models = Arc::new(models::available(&cfg));
        let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(90)).build()?;
        let firebase = cfg.firebase_project.clone().map(|p| Arc::new(firebase::Verifier::google(p, http.clone())));
        Ok(Self { cfg: Arc::new(cfg), db, provider, models, http, firebase })
    }

    /// Swap in a verifier — tests sign their own tokens.
    pub fn with_firebase(mut self, v: firebase::Verifier) -> Self {
        self.firebase = Some(Arc::new(v));
        self
    }
}

async fn health(State(st): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "ok": true, "provider": st.provider.name(), "firebase": st.firebase.is_some(), "version": env!("CARGO_PKG_VERSION") }))
}

/// The image models this server offers, and whether refinement is a real model.
async fn list_models(State(st): State<AppState>) -> Json<serde_json::Value> {
    let refine = match &st.cfg.refiner {
        config::Refiner::Dev => "dev".to_string(),
        config::Refiner::OpenRouter { model, .. } => model.clone(),
    };
    Json(json!({ "provider": st.provider.name(), "models": *st.models, "refine": refine }))
}

async fn at_handle(State(st): State<AppState>, Path(seg): Path<String>) -> ApiResult<Response> {
    portfolio::serve(&st, &seg, None).await
}

async fn at_handle_file(State(st): State<AppState>, Path((seg, rest)): Path<(String, String)>) -> ApiResult<Response> {
    portfolio::serve(&st, &seg, Some(&rest)).await
}

async fn at_handle_root(State(st): State<AppState>, Path(seg): Path<String>) -> ApiResult<Response> {
    portfolio::serve(&st, &seg, Some("")).await
}

pub fn app(st: AppState) -> Router {
    /* the web app calls with credentials, so origins are listed, never "*" */
    let origins: Vec<HeaderValue> = st.cfg.origins.iter().filter_map(|o| o.parse().ok()).collect();
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let api = Router::new()
        .route("/v1/auth/signup", post(auth::signup))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/auth/firebase", post(auth::firebase_signin))
        .route("/v1/me", get(auth::me))
        .route("/v1/models", get(list_models))
        .route("/v1/refine", post(refine::refine))
        .route("/v1/generate", post(generate::generate).layer(DefaultBodyLimit::max(60 * 1024 * 1024)))
        .route("/v1/portfolio/{handle}", put(portfolio::publish).layer(DefaultBodyLimit::max(620 * 1024 * 1024)))
        .route("/v1/events/{id}", put(events::put_event))
        .route("/v1/events/{id}/photos", post(events::post_photo).layer(DefaultBodyLimit::max(40 * 1024 * 1024)))
        .route("/v1/events/{id}/photos/{photo}", delete(events::delete_photo))
        .route("/v1/events/{id}/photos/{photo}/guests", put(events::put_photo_guests));

    let public = Router::new()
        .route("/health", get(health))
        .route("/files/gen/{name}", get(generate::file))
        .route("/e/{id}", get(events::landing))
        .route("/e/{id}/{code}", get(events::gallery))
        .route("/e/{id}/{code}/all.zip", get(events::all_zip))
        .route("/e/{id}/{code}/p/{file}", get(events::photo))
        /* /@handle — the router matches whole segments, so these catch any
           single segment and the handler insists on the @ */
        .route("/{seg}", get(at_handle))
        .route("/{seg}/", get(at_handle_root))
        .route("/{seg}/{*rest}", get(at_handle_file));

    api.merge(public).layer(cors).layer(TraceLayer::new_for_http()).with_state(st)
}
