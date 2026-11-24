# SportsHub 0.2.9

SportsHub is a self-hosted sports addon for Nuvio and other Stremio-compatible clients. It combines live feeds from supported addons with sports fixtures, upcoming games, and matchup artwork. Each installation runs in the installer's Cloudflare account and uses their own sources.

## Deploy in your browser

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Freelhumann-glitch%2Fsportshub)

Use the Deploy to Cloudflare button to copy this project into your own GitHub account and deploy it to your own Cloudflare Worker. Enter your own configured AIOStreams manifest URL or one or more supported direct addon URLs in the **Secrets** section. Leave unused fields blank. When deployment finishes, open the Worker’s HTTPS URL, append `/manifest.json`, and install that URL in Nuvio.

If you need to add or update a source after deployment, open your Worker in **Workers & Pages → Settings → Variables and Secrets**. Add the value as a **Secret** using the names below.

1. Click **Deploy to Cloudflare** and connect your GitHub account if prompted.
2. Choose a Worker name and fill in `AIOSTREAMS_MANIFEST_URL` or the matching direct source secret fields. Leave unused fields blank. You can also add secrets in the Worker settings after deploying.
3. Deploy. Copy the Worker’s HTTPS address, append `/manifest.json`, and open it in your browser to check that it returns the SportsHub manifest.
4. In Nuvio, open **Settings → Addons → Add Addon**, paste the SportsHub manifest URL, and install it. Open **Live Now** or **Upcoming Today** to check the setup.
5. If your Nuvio version supports catalog visibility settings, you can hide any sport rows you don’t want on Home.

### Optional AIOStreams template

1. Open the [raw AIOStreams template](https://raw.githubusercontent.com/reelhumann-glitch/sportshub/main/aiostreams-template.json). Use that URL for a template URL import. For a file import, save the raw page as `aiostreams-template.json` and select that file in the template picker.
2. Start a fresh sports configuration, enter at least one of your own supported addon manifests, and save. The template supplies its own addon list.
3. Copy the new AIOStreams manifest URL into your Cloudflare `AIOSTREAMS_MANIFEST_URL` secret.

If you see `JSON.parse: unexpected character at line 1 column 1`, check that your file opens as JSON beginning with `{`. GitHub's regular file preview is an HTML page. Use the raw link above to get the JSON.

The template was built from scratch with blank inputs. It contains no existing manifest URLs, configuration identifiers or account credentials.

## Terminal setup

You’ll need Node.js 22.12 or newer, a Cloudflare Workers account, and at least one supported addon manifest URL. Extract the ZIP and open a terminal in the extracted folder. In Windows PowerShell, use `npm.cmd` if `npm` is blocked by your execution policy.

```sh
npm ci
node setup.mjs
```

Choose `aio` for your own configured AIOStreams manifest, or enter any combination of `nuvio, highfly, cnc` for direct addons. You can combine AIOStreams and direct sources. The setup opens Cloudflare login, deploys the Worker, and prompts for each chosen manifest URL using Wrangler’s secret input. If Wrangler asks you to choose an account, select the same account throughout. Add `/manifest.json` to the HTTPS Worker URL that Wrangler prints and install it in Nuvio.

The Worker uses the default `workers.dev` route and needs no paid bindings or custom domain. If your account already has a Worker named `sportshub-addon`, change `name` in `wrangler.toml` before running setup to create a separate deployment.

## Supported sources

| Source | Secret | Expected catalog |
| --- | --- | --- |
| AIOStreams | `AIOSTREAMS_MANIFEST_URL` | Configured sports addons exposing their live catalogs |
| NuvioLiveSports | `NUVIO_MANIFEST_URL` | `nuvio_sports_live` |
| HighFly Sports | `HIGHFLY_MANIFEST_URL` | `sports_live` |
| CNCVerse | `CNC_MANIFEST_URL` | `cnc_SportzXLiveEvents_tv` |

SportsHub recognizes NuvioLiveSports, HighFly Sports, CNCVerse, and pp-live through AIOStreams. It uses AIOStreams routes when advertised and falls back to configured direct bindings when those routes are unavailable. Source availability, supported catalog fields, and playback vary by addon. SportsHub uses a fixed set of source adapters.

Keep your source manifests in Cloudflare secrets. Your Worker URL serves catalog and stream responses, so share this package with other users and use your deployed URL for your own setup.

## Manual setup and checks

Install dependencies with `npm ci`, sign into your own account with `npx wrangler login`, run `npm run deploy`, then set each source using `npx wrangler secret put SECRET_NAME`. On Windows PowerShell, use `npx.cmd` if needed. The optional `THESPORTSDB_API_KEY` secret can improve fixture coverage.

- `/manifest.json` returns the install manifest.
- `/diagnostics/providers.json` reports source catalog status without returning manifest URLs.
- `npm test` runs the local tests.

For local development, copy `.dev.vars.example` to `.dev.vars`, add your own source URLs, and run `npm run dev`. The included Atkinson Hyperlegible Next font license is in `assets/OFL.txt`.
