# Hosting the POC (GitHub Actions + Pages + staticrypt)

This is a **proof of concept**. The workflow `.github/workflows/dashboard.yml`
builds the dashboard from **bundled fictional data** (`--demo`, see
`src/team_status/demo.py`) — no Linear key, no network, no real people — encrypts
it with a shared password ([staticrypt](https://github.com/robinmoisson/staticrypt)),
and publishes it to GitHub Pages. Visitors must enter the password to decrypt the
page in their browser.

Because the data is fictional, this runs entirely on **free GitHub** (public repo:
unlimited Actions minutes + free Pages).

## One-time setup

### 1. Repo must be public (free Pages)
```bash
gh repo edit --visibility public --accept-visibility-change-consequences
```
Safe here: the code uses only fictional data (no secrets, no real names/emails —
the test suite enforces this), and the dashboard is published as a
password-encrypted artifact, never committed.

### 2. Add the gate password
```bash
gh secret set STATICRYPT_PASSWORD   # the password visitors type to view the demo
```

### 3. Enable Pages with the "GitHub Actions" source
Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 4. Run it
**Actions tab → "Build & publish dashboard" → Run workflow.** The deploy step
prints the published URL. Open it, enter the password, and you'll see the demo
roster.

## Going from POC to real data later

Swap `--demo` out of the workflow's generate step and add back a
`LINEAR_API_KEY` secret + `env:` block (see git history of this file). At that
point the data is real, so revisit hosting: a public encrypted page is no longer
appropriate — move to a private repo on a paid plan, or Cloudflare Pages +
Cloudflare Access for real per-person auth. Names are already abbreviated
(`abbreviate_name` in `render.py`), but ticket titles would be real.

## Notes
- **Cron is UTC, no DST.** `13:00`/`18:00` UTC ≈ `09:00`/`14:00` ET in summer.
- **Diff persistence** across runs is best-effort via `actions/cache`; a miss just
  shows a "baseline" that run. (With static demo data the diff is mostly "no change".)
- **Encryption is client-side** (staticrypt AES); strength = password strength.
