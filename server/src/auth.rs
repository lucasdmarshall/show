//! Accounts and sessions.
//!
//! A login is a phone number or an email — in Myanmar most people have the
//! first and many do not use the second. Passwords are argon2id. A session
//! is a random token in an HttpOnly cookie (or a Bearer header, for tools),
//! stored only as its SHA-256 so a leaked database holds no live sessions.

use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::{FromRef, FromRequestParts, State},
    http::{HeaderMap, request::Parts},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngCore;
use rusqlite::{OptionalExtension, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    AppState,
    db::{new_id, now},
    error::{ApiError, ApiResult, bad},
};

pub const COOKIE: &str = "show_session";
const SESSION_DAYS: i64 = 30;

#[derive(Clone, Debug, Serialize)]
pub struct User {
    pub id: String,
    pub login: String,
    pub name: String,
    #[serde(skip)]
    pub premium_until: i64,
    /// Filled in from config: dev mode makes everyone a member.
    #[serde(skip)]
    pub dev_premium: bool,
}

impl User {
    pub fn is_member(&self) -> bool {
        self.dev_premium || self.premium_until > now()
    }
}

/// A phone number keeps only its digits (and a leading +); an email is
/// lower-cased. Anything else is not a login.
pub fn normalize_login(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.contains('@') {
        let e = s.to_lowercase();
        let (local, domain) = e.split_once('@')?;
        (!local.is_empty() && domain.contains('.') && !e.contains(' ') && e.len() <= 120).then_some(e)
    } else {
        let plus = s.starts_with('+');
        let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
        (7..=15).contains(&digits.len()).then(|| if plus { format!("+{digits}") } else { digits })
    }
}

fn hash_token(token: &str) -> String {
    let d = Sha256::digest(token.as_bytes());
    d.iter().map(|b| format!("{b:02x}")).collect()
}

fn new_token() -> String {
    let mut b = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut b);
    URL_SAFE_NO_PAD.encode(b)
}

fn token_from(headers: &HeaderMap, jar: &CookieJar) -> Option<String> {
    if let Some(t) = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        return Some(t.trim().to_string());
    }
    jar.get(COOKIE).map(|c| c.value().to_string())
}

/// The signed-in user, or nothing. Handlers that need one use [`User`].
pub struct MaybeUser(pub Option<User>);

impl<S> FromRequestParts<S> for MaybeUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let st = AppState::from_ref(state);
        let jar = CookieJar::from_headers(&parts.headers);
        let Some(token) = token_from(&parts.headers, &jar) else {
            return Ok(Self(None));
        };
        let h = hash_token(&token);
        let dev = st.cfg.dev_premium;
        let user = st
            .db
            .run(move |c| {
                Ok(c.query_row(
                    "SELECT u.id, u.login, u.name, u.premium_until FROM sessions s JOIN users u ON u.id = s.user_id
                     WHERE s.token_hash = ?1 AND s.expires > ?2",
                    params![h, now()],
                    |r| {
                        Ok(User {
                            id: r.get(0)?,
                            login: r.get(1)?,
                            name: r.get(2)?,
                            premium_until: r.get(3)?,
                            dev_premium: dev,
                        })
                    },
                )
                .optional()?)
            })
            .await?;
        Ok(Self(user))
    }
}

impl<S> FromRequestParts<S> for User
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        MaybeUser::from_request_parts(parts, state).await?.0.ok_or(ApiError::Login)
    }
}

#[derive(Deserialize)]
pub struct Credentials {
    pub login: String,
    pub password: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Serialize)]
pub struct Me {
    pub id: String,
    pub login: String,
    pub name: String,
    pub member: bool,
    /// unix seconds; 0 when not a member
    pub member_until: i64,
    /// also set as a cookie; returned for tools that use Bearer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

impl Me {
    fn of(u: &User, token: Option<String>) -> Self {
        Self {
            id: u.id.clone(),
            login: u.login.clone(),
            name: u.name.clone(),
            member: u.is_member(),
            member_until: u.premium_until,
            token,
        }
    }
}

async fn start_session(st: &AppState, user_id: String) -> ApiResult<String> {
    let token = new_token();
    let h = hash_token(&token);
    st.db
        .run(move |c| {
            c.execute(
                "INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?1, ?2, ?3, ?4)",
                params![h, user_id, now(), now() + SESSION_DAYS * 86_400],
            )?;
            Ok(())
        })
        .await?;
    Ok(token)
}

fn session_cookie(st: &AppState, token: String) -> Cookie<'static> {
    Cookie::build((COOKIE, token))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(st.cfg.secure_cookies())
        .path("/")
        .max_age(time::Duration::days(SESSION_DAYS))
        .build()
}

pub async fn signup(State(st): State<AppState>, jar: CookieJar, Json(c): Json<Credentials>) -> ApiResult<(CookieJar, Json<Me>)> {
    let login = normalize_login(&c.login).ok_or_else(|| bad("use a phone number or an email address"))?;
    if c.password.chars().count() < 8 {
        return Err(bad("the password needs at least 8 characters"));
    }
    let name = c.name.trim().chars().take(80).collect::<String>();
    let salt = SaltString::generate(&mut OsRng);
    let pass = Argon2::default()
        .hash_password(c.password.as_bytes(), &salt)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("hash: {e}")))?
        .to_string();
    let id = new_id();
    let user = User {
        id: id.clone(),
        login: login.clone(),
        name: if name.is_empty() { login.clone() } else { name },
        premium_until: 0,
        dev_premium: st.cfg.dev_premium,
    };
    let u = user.clone();
    st.db
        .run(move |conn| {
            let taken: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM users WHERE login = ?1)", [&u.login], |r| r.get(0))?;
            if taken {
                return Err(ApiError::Conflict("that login already has an account — sign in instead".into()));
            }
            conn.execute(
                "INSERT INTO users (id, login, name, pass, created) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![u.id, u.login, u.name, pass, now()],
            )?;
            Ok(())
        })
        .await?;
    let token = start_session(&st, id).await?;
    Ok((jar.add(session_cookie(&st, token.clone())), Json(Me::of(&user, Some(token)))))
}

pub async fn login(State(st): State<AppState>, jar: CookieJar, Json(c): Json<Credentials>) -> ApiResult<(CookieJar, Json<Me>)> {
    let wrong = || ApiError::Forbidden("that login and password do not match".into());
    let login = normalize_login(&c.login).ok_or_else(wrong)?;
    let dev = st.cfg.dev_premium;
    let found = st
        .db
        .run(move |conn| {
            Ok(conn
                .query_row(
                    "SELECT id, login, name, pass, premium_until FROM users WHERE login = ?1",
                    [&login],
                    |r| {
                        Ok((
                            User {
                                id: r.get(0)?,
                                login: r.get(1)?,
                                name: r.get(2)?,
                                premium_until: r.get(4)?,
                                dev_premium: dev,
                            },
                            r.get::<_, String>(3)?,
                        ))
                    },
                )
                .optional()?)
        })
        .await?;
    let (user, stored) = found.ok_or_else(wrong)?;
    /* an account made through Firebase has no SHOW password */
    if stored.is_empty() {
        return Err(wrong());
    }
    let parsed = PasswordHash::new(&stored).map_err(|e| ApiError::Internal(anyhow::anyhow!("stored hash: {e}")))?;
    Argon2::default().verify_password(c.password.as_bytes(), &parsed).map_err(|_| wrong())?;
    let token = start_session(&st, user.id.clone()).await?;
    Ok((jar.add(session_cookie(&st, token.clone())), Json(Me::of(&user, Some(token)))))
}

pub async fn logout(State(st): State<AppState>, headers: HeaderMap, jar: CookieJar) -> ApiResult<CookieJar> {
    if let Some(t) = token_from(&headers, &jar) {
        let h = hash_token(&t);
        st.db
            .run(move |c| {
                c.execute("DELETE FROM sessions WHERE token_hash = ?1", [h])?;
                Ok(())
            })
            .await?;
    }
    Ok(jar.remove(Cookie::build(COOKIE).path("/").build()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirebaseIn {
    pub id_token: String,
    #[serde(default)]
    pub name: String,
}

/// POST /v1/auth/firebase — a Firebase ID token in, a SHOW session out.
///
/// The person is found by their Firebase uid. A first sign-in links to an
/// existing SHOW account only through a verified identity — a phone number
/// Firebase confirmed by OTP, or an email the provider vouches for — so an
/// unverified email can never take over someone else's account.
pub async fn firebase_signin(State(st): State<AppState>, jar: CookieJar, Json(req): Json<FirebaseIn>) -> ApiResult<(CookieJar, Json<Me>)> {
    let verifier = st.firebase.clone().ok_or_else(|| bad("Firebase sign-in is not configured on this server"))?;
    let claims = verifier.verify(&req.id_token).await.map_err(|e| {
        tracing::info!("firebase token refused: {e:#}");
        ApiError::Forbidden("that sign-in could not be confirmed — try again".into())
    })?;

    let verified_login = claims
        .phone_number
        .as_deref()
        .and_then(normalize_login)
        .or_else(|| claims.email.as_deref().filter(|_| claims.email_verified).and_then(normalize_login));
    let any_login = verified_login.clone().or_else(|| claims.email.as_deref().and_then(normalize_login));
    let name = Some(req.name.trim())
        .filter(|n| !n.is_empty())
        .map(str::to_string)
        .or(claims.name.clone())
        .unwrap_or_default()
        .chars()
        .take(80)
        .collect::<String>();
    let dev = st.cfg.dev_premium;
    let uid = claims.sub.clone();

    let user = st
        .db
        .run(move |c| {
            let row = |sql: &str, key: &str| -> rusqlite::Result<Option<User>> {
                c.query_row(sql, [key], |r| {
                    Ok(User { id: r.get(0)?, login: r.get(1)?, name: r.get(2)?, premium_until: r.get(3)?, dev_premium: dev })
                })
                .optional()
            };
            /* 1. seen before */
            if let Some(u) = row("SELECT id, login, name, premium_until FROM users WHERE firebase_uid = ?1", &uid)? {
                return Ok(u);
            }
            /* 2. a SHOW account with the same verified phone or email, not yet linked */
            if let Some(login) = &verified_login
                && let Some(u) = row("SELECT id, login, name, premium_until FROM users WHERE login = ?1 AND firebase_uid IS NULL", login)?
            {
                c.execute("UPDATE users SET firebase_uid = ?1 WHERE id = ?2", params![uid, u.id])?;
                return Ok(u);
            }
            /* 3. new: the phone or email as the login when it is free */
            let free = |l: &str| -> rusqlite::Result<bool> {
                c.query_row("SELECT NOT EXISTS(SELECT 1 FROM users WHERE login = ?1)", [l], |r| r.get(0))
            };
            let login = match &any_login {
                Some(l) if free(l)? => l.clone(),
                _ => format!("firebase:{uid}"),
            };
            let u = User {
                id: new_id(),
                name: if name.is_empty() { login.trim_start_matches("firebase:").to_string() } else { name },
                login,
                premium_until: 0,
                dev_premium: dev,
            };
            c.execute(
                "INSERT INTO users (id, login, name, pass, created, firebase_uid) VALUES (?1, ?2, ?3, '', ?4, ?5)",
                params![u.id, u.login, u.name, now(), uid],
            )?;
            Ok(u)
        })
        .await?;

    let token = start_session(&st, user.id.clone()).await?;
    Ok((jar.add(session_cookie(&st, token.clone())), Json(Me::of(&user, Some(token)))))
}

pub async fn me(user: User) -> Json<Me> {
    Json(Me::of(&user, None))
}

/// `grant <login> <days>` from the command line. Payment is not decided
/// yet, so membership is granted by hand until it is.
pub fn grant(db_path: &std::path::Path, login: &str, days: i64) -> anyhow::Result<i64> {
    let login = normalize_login(login).ok_or_else(|| anyhow::anyhow!("not a phone number or email"))?;
    let c = rusqlite::Connection::open(db_path)?;
    let current: i64 = c
        .query_row("SELECT premium_until FROM users WHERE login = ?1", [&login], |r| r.get(0))
        .optional()?
        .ok_or_else(|| anyhow::anyhow!("no account for {login}"))?;
    let until = if days <= 0 { 0 } else { current.max(now()) + days * 86_400 };
    c.execute("UPDATE users SET premium_until = ?1 WHERE login = ?2", params![until, login])?;
    Ok(until)
}

#[cfg(test)]
mod tests {
    use super::normalize_login;

    #[test]
    fn logins() {
        assert_eq!(normalize_login(" 09 7812 34567 ").as_deref(), Some("09781234567"));
        assert_eq!(normalize_login("+95 9 781 234 567").as_deref(), Some("+959781234567"));
        assert_eq!(normalize_login("Aung@Example.com").as_deref(), Some("aung@example.com"));
        assert_eq!(normalize_login("12345"), None);
        assert_eq!(normalize_login("no-at-sign"), None);
        assert_eq!(normalize_login("a@b"), None);
    }
}
