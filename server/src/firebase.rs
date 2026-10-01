//! Sign-in through Firebase Auth — Google, phone OTP, email.
//!
//! The web app signs the person in with Firebase and sends the ID token
//! here once. The token is checked against Google's published signing
//! keys (RS256, this project's audience and issuer, not expired), and the
//! person gets an ordinary SHOW session. Membership, generations and
//! everything else stay in SHOW's own database.

use std::{
    collections::HashMap,
    sync::RwLock,
    time::{Duration, Instant},
};

use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::Deserialize;

const JWKS: &str = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

#[derive(Debug, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(default)]
    pub phone_number: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    pub auth_time: i64,
}

enum Keys {
    /// fetched from Google and refreshed when they expire
    Google(RwLock<(Instant, HashMap<String, DecodingKey>)>),
    /// fixed keys, for tests
    Fixed(HashMap<String, DecodingKey>),
}

pub struct Verifier {
    project: String,
    keys: Keys,
    http: reqwest::Client,
}

#[derive(Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

impl Verifier {
    pub fn google(project: String, http: reqwest::Client) -> Self {
        Self { project, keys: Keys::Google(RwLock::new((Instant::now(), HashMap::new()))), http }
    }

    pub fn fixed(project: String, keys: HashMap<String, DecodingKey>) -> Self {
        Self { project, keys: Keys::Fixed(keys), http: reqwest::Client::new() }
    }

    pub fn project(&self) -> &str {
        &self.project
    }

    async fn key(&self, kid: &str) -> anyhow::Result<DecodingKey> {
        let lock = match &self.keys {
            Keys::Fixed(map) => return map.get(kid).cloned().ok_or_else(|| anyhow::anyhow!("unknown key id")),
            Keys::Google(lock) => lock,
        };
        {
            let (until, map) = &*lock.read().map_err(|_| anyhow::anyhow!("key cache poisoned"))?;
            if Instant::now() < *until
                && let Some(k) = map.get(kid)
            {
                return Ok(k.clone());
            }
        }
        /* refresh: Google rotates the keys and says for how long each set holds */
        let res = self.http.get(JWKS).send().await?.error_for_status()?;
        let max_age = res
            .headers()
            .get("cache-control")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.split(',').find_map(|p| p.trim().strip_prefix("max-age=")?.parse::<u64>().ok()))
            .unwrap_or(3600);
        #[derive(Deserialize)]
        struct Set {
            keys: Vec<Jwk>,
        }
        let set: Set = res.json().await?;
        let mut map = HashMap::new();
        for k in set.keys {
            map.insert(k.kid, DecodingKey::from_rsa_components(&k.n, &k.e)?);
        }
        let found = map.get(kid).cloned();
        *lock.write().map_err(|_| anyhow::anyhow!("key cache poisoned"))? = (Instant::now() + Duration::from_secs(max_age), map);
        found.ok_or_else(|| anyhow::anyhow!("unknown key id"))
    }

    /// The token's claims, if it is a genuine, current ID token for this project.
    pub async fn verify(&self, token: &str) -> anyhow::Result<Claims> {
        let header = decode_header(token)?;
        anyhow::ensure!(header.alg == Algorithm::RS256, "not RS256");
        let kid = header.kid.ok_or_else(|| anyhow::anyhow!("no key id"))?;
        let key = self.key(&kid).await?;
        let mut v = Validation::new(Algorithm::RS256);
        v.set_audience(&[&self.project]);
        v.set_issuer(&[format!("https://securetoken.google.com/{}", self.project)]);
        v.set_required_spec_claims(&["exp", "iat", "aud", "iss", "sub"]);
        v.leeway = 60;
        let claims = decode::<Claims>(token, &key, &v)?.claims;
        anyhow::ensure!(!claims.sub.is_empty() && claims.sub.len() <= 128, "bad subject");
        anyhow::ensure!(claims.auth_time <= crate::db::now() + 60, "signed in in the future");
        Ok(claims)
    }
}
