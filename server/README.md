# show-server

SHOW's backend (Rust · axum · SQLite). The web app does everything it can on the device. This server does the four things a device cannot:

- **Accounts and membership.** You sign in with a phone number or an email. Passwords are hashed with argon2id. The session is kept in an HttpOnly cookie, and the database stores only a SHA-256 of the session token.
- **Making photographs.** `POST /v1/generate` is for members only. It returns four results with the seed pinned. A failed attempt is recorded as failed, so nothing is charged for it.
- **Portfolios.** The site zip exported from the app is served at `/@handle/`. Uploads are limited to `index.html`, `og.jpg` and `images/*.jpg`, no path can escape the site folder, and a handle is claimed only after an upload succeeds.
- **Event galleries.** A guest who scans their QR opens `/e/{event}/{code}` and sees only their own photographs, with a "Save all" zip.

## Run

```bash
cp .env.example .env
cargo run            # from server/, or `preview_start show-server` from the repo root
```

The web app finds the server through `NEXT_PUBLIC_SHOW_API` in `web/.env.local`.

## Membership

Pricing is not decided yet, so membership is granted by hand for now:

```bash
cargo run -- grant 09781234567 30
cargo run -- revoke 09781234567
```

## Sign-in

When `FIREBASE_PROJECT_ID` is set, the web app signs people in with Firebase: Google, a phone number with an SMS code, or email. The app sends the Firebase ID token to `POST /v1/auth/firebase`. The server checks the token against Google's published keys (RS256, this project's audience and issuer, not expired) and returns an ordinary SHOW session.

A first Firebase sign-in links to an existing SHOW account only through a verified phone number or a verified email. An unverified email cannot take over someone else's account.

## Refine

`POST /v1/refine` takes `{ prompt, negative, target }` and returns `{ prompt, negative, notes, model, left }`.

- A text model on OpenRouter rewrites the crafted prompt for the target engine without changing any decision.
- It is free for signed-in accounts, up to `SHOW_REFINE_DAILY` per day.
- Without a key, the server tidies the prompt itself and says so.

## Providers (`SHOW_PROVIDER`)

| | |
|---|---|
| `openrouter` | The default when `OPENROUTER_API_KEY` is set. Nano Banana Pro and GPT Image 2.5 Sunburst through OpenRouter's Images API. The model is chosen per request from `GET /v1/models`; references go in `input_references`. |
| `dev` | Deterministic stand-in images (tinted, with a gold hairline). Needs no key and no GPU. |
| `openai` | `OPENAI_API_KEY`. Generations, plus edits with a mask. A cut-out subject is used as its own mask. |
| `comfyui` | The studio's own ComfyUI: `COMFYUI_URL`, `COMFYUI_CKPT`. Runs the same graph the web app hands out (seed pinned, batch of 4, inpaint when the source has transparency). |

## API

| | |
|---|---|
| `POST /v1/auth/signup` · `login` · `logout` | `{ login, password, name? }` |
| `GET /v1/me` | `{ login, name, member, member_until }` |
| `POST /v1/generate` | Multipart: `request` (JSON), optional `image` and `mask`. Returns 401 if not signed in, 402 if not a member, 502 if the provider fails. |
| `PUT /v1/portfolio/{handle}` | The site zip. |
| `PUT /v1/events/{id}` | The event and its guests. |
| `POST /v1/events/{id}/photos` | Multipart: `meta` (`{ id, guests: [codes] }`) and `photo` (JPEG). |
| `PUT /v1/events/{id}/photos/{photo}/guests` · `DELETE …/{photo}` | Retag or remove a photo. |
| `GET /@{handle}/` · `/e/{id}` · `/e/{id}/{code}` · `/e/{id}/{code}/all.zip` | The public pages. |
| `GET /health` | |

## Tests

```bash
cargo test     # unit tests, plus the whole HTTP surface on a temp folder (tests/api.rs)
```

## Not yet

- Rate limits on sign-in and guest codes.
- Payment.
- Messenger delivery.
- Face search (planned as a Python model service).
- Print-to-door.
