# SportsHub 0.2.9

SportsHub is a self-hosted sports addon for Nuvio that shows live games, upcoming fixtures, and matchup artwork. It uses one AIOStreams manifest URL. To use multiple sports addons, combine them in the same AIOStreams configuration.

**[Start Setup →](https://reelhumann-glitch.github.io/sportshub/)**

The wizard guides you through AIOStreams setup, optional catalog selection, Cloudflare deployment, and installation in Nuvio.

<details>
<summary>Manual browser setup and troubleshooting</summary>

## Deploy in your browser

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Freelhumann-glitch%2Fsportshub)

1. Click **Deploy to Cloudflare**, connect your GitHub account, and choose a Worker name.
2. Paste your configured AIOStreams manifest URL into `AIOSTREAMS_MANIFEST_URL` and click **Deploy**.
3. For custom catalogs or language preferences, add the wizard’s `SPORTHUB_CATALOGS` or `SPORTHUB_STREAM_LANGUAGES` values under **Workers & Pages → Settings → Variables and Secrets** as text variables. Save and deploy your changes.
4. Copy your Worker’s HTTPS address, append `/manifest.json`, and open it in your browser to check that it returns the SportsHub manifest.
5. In Nuvio, open **Settings → Addons → Add Addon**, paste the SportsHub manifest URL, and install it. Open **Live Now** or **Upcoming Today** to check the setup.

### Optional AIOStreams template

1. **Configure each addon first.** Open its own setup page, save the options you want, and copy its configured manifest URL. Repeat for every addon you plan to use.
2. Open the [raw AIOStreams template](https://raw.githubusercontent.com/reelhumann-glitch/sportshub/main/aiostreams-template.json). Use that URL for a template URL import. For a file import, save the raw page as `aiostreams-template.json` and select that file in the template picker.
3. Start a fresh sports configuration, paste at least one configured addon manifest into its matching field, and save. The template supplies its own addon list and preserves upstream stream labels.
4. Copy the new AIOStreams manifest URL into your Cloudflare `AIOSTREAMS_MANIFEST_URL` secret.

SportsHub handles its own sport and league filters, highlights exclusion, language rules, and resolution-first sorting. The template connects the sources and leaves AIOStreams' filters and other preferences at the values already set in that configuration. Install the SportsHub manifest in Nuvio to see the curated catalogs.

If you see `JSON.parse: unexpected character at line 1 column 1`, check that your file opens as JSON beginning with `{`. GitHub's regular file preview is an HTML page. Use the raw link above to get the JSON.

The template was built from scratch with blank inputs. It contains no existing manifest URLs, configuration identifiers or account credentials.

</details>

<details>
<summary>Terminal setup and technical details</summary>

## Terminal setup

You’ll need Node.js 22.12 or newer, a Cloudflare Workers account, and a configured AIOStreams manifest URL. Extract the ZIP and open a terminal in the extracted folder. In Windows PowerShell, use `npm.cmd` if `npm` is blocked by your execution policy.

```sh
npm ci
node setup.mjs
```

The setup opens Cloudflare login, deploys the Worker, and prompts for your AIOStreams manifest URL using Wrangler’s secret input. If Wrangler asks you to choose an account, select the same account throughout. Add `/manifest.json` to the HTTPS Worker URL that Wrangler prints and install it in Nuvio.

The Worker uses the default `workers.dev` route and needs no paid bindings or custom domain. If your account already has a Worker named `sportshub-addon`, change `name` in `wrangler.toml` before running setup to create a separate deployment.

## Manual setup and checks

Install dependencies with `npm ci`, sign into your own account with `npx wrangler login`, run `npm run deploy`, then set your AIOStreams manifest using `npx wrangler secret put AIOSTREAMS_MANIFEST_URL`. On Windows PowerShell, use `npx.cmd` if needed.

## Sports metadata

SportsHub uses the built-in public TheSportsDB key for fixture metadata. The [official PWHL schedule](https://www.thepwhl.com/en/schedule) works without a key and feeds Upcoming Today, Hockey, and the optional PWHL catalog.

SportsHub caches fixture snapshots for 10 minutes at each Cloudflare edge location and can reuse up to six hours of recent fixtures when an upstream source fails. API-Sports data refreshes at most hourly per catalog mode and edge location when the cache is available. The artwork renderer can use team logos supplied by addons when a metadata logo is missing or fails to load.

- `/manifest.json` returns the install manifest.
- `/diagnostics/providers.json` reports source catalog status without returning manifest URLs.
- `npm test` runs the local tests.

For local development, copy `dev.vars.example` to `.dev.vars`, add your AIOStreams manifest URL, and run `npm run dev`. The included Atkinson Hyperlegible Next font license is in `assets/OFL.txt`.

</details>
