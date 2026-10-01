use show_server::{AppState, app, auth, config::Config};
use tracing_subscriber::EnvFilter;

const USAGE: &str = "\
show-server — SHOW's backend

  show-server [serve]              run the server (see .env.example)
  show-server grant <login> <days> make an account a member for <days>
  show-server revoke <login>       end an account's membership";

/// Read `.env` next to the binary's working directory, without overriding
/// anything already set. Runs before any thread exists.
fn load_env() {
    /* started from the repository root (the dev launcher does): work from server/ */
    if !std::path::Path::new(".env").exists() && std::path::Path::new("server/.env").exists() {
        let _ = std::env::set_current_dir("server");
    }
    let Ok(text) = std::fs::read_to_string(".env") else { return };
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            let (k, v) = (k.trim(), v.trim().trim_matches('"'));
            if std::env::var_os(k).is_none() {
                // SAFETY: single-threaded — the async runtime has not started yet.
                unsafe { std::env::set_var(k, v) };
            }
        }
    }
}

fn main() -> anyhow::Result<()> {
    load_env();
    tokio::runtime::Runtime::new()?.block_on(run())
}

async fn run() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "show_server=info,tower_http=info".into()))
        .init();

    let args: Vec<String> = std::env::args().skip(1).collect();
    let cfg = Config::from_env()?;

    match args.first().map(String::as_str) {
        None | Some("serve") => {
            if cfg.dev_premium {
                tracing::warn!("SHOW_DEV_PREMIUM=1 — every signed-in account is a member. Local development only.");
            }
            let bind = cfg.bind;
            let st = AppState::new(cfg)?;
            tracing::info!("SHOW server on http://{bind} · provider {} · data {}", st.provider.name(), st.cfg.data.display());
            let listener = tokio::net::TcpListener::bind(bind).await?;
            axum::serve(listener, app(st)).with_graceful_shutdown(async {
                let _ = tokio::signal::ctrl_c().await;
            })
            .await?;
        }
        Some("grant") if args.len() == 3 => {
            let days: i64 = args[2].parse()?;
            std::fs::create_dir_all(&cfg.data)?;
            AppState::new(cfg.clone())?; // makes sure the schema exists
            let until = auth::grant(&cfg.data.join("show.db"), &args[1], days)?;
            println!("{} is a member until {}", args[1], time::OffsetDateTime::from_unix_timestamp(until)?.date());
        }
        Some("revoke") if args.len() == 2 => {
            AppState::new(cfg.clone())?;
            auth::grant(&cfg.data.join("show.db"), &args[1], 0)?;
            println!("{} is no longer a member", args[1]);
        }
        _ => {
            eprintln!("{USAGE}");
            std::process::exit(2);
        }
    }
    Ok(())
}
