# SkyRoute: Deployment (GitHub Pages)

The website is a static build (`dist/`) published to GitHub Pages by the workflow
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

* Repository: https://github.com/sarielh/SkyRoute
* Website: https://sarielh.github.io/SkyRoute/

## One-time configuration

1. **Repository visibility / plan.** GitHub Pages is available for public repositories on every plan, and for private repositories only on
   GitHub Pro, Team or Enterprise. The published website is always public.
2. **Enable Pages:** repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The base path is set in `vite.config.ts` (`/SkyRoute/`, matching the repository name). If the repository is renamed or the site moves
   to a custom domain, build with `BASE_PATH=/new-path/` (or `/` for a domain root) and update the URL in `README.md`.

The app uses hash URLs (`/SkyRoute/#/bookings/ABC123`), so refreshing or deep-linking any page works without server-side rewrites.
The Mock Service Worker file is served from `/SkyRoute/mockServiceWorker.js` with scope `/SkyRoute/`.

## How a deployment works

Every push to `main` (or a manual run from **Actions → Test and deploy to GitHub Pages → Run workflow**) runs three jobs:

| Job | Steps |
|-----|-------|
| **Typecheck, test and build** | `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, Playwright browser tests against the production build, upload of `dist/` |
| **Deploy** | Publishes the artifact to GitHub Pages; the job summary shows the URL |
| **Verify the live website** | Runs the Playwright suite against the deployed URL |

If any test fails before deployment, nothing is published and the previous version stays live.

## Updating the website

```bash
npm install
npm run dev                 # make and check changes locally
npm run typecheck && npm test && npm run build && npm run test:e2e
git commit -am "Describe the change" && git push origin main
```

Then watch **Actions** until all three jobs are green, and open the website. A hard refresh (Ctrl+F5) may be needed because the browser
caches the previous build briefly.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Deploy job fails with "Pages is not enabled" or "Not Found" | Enable Pages with source *GitHub Actions* (see above); for a private repository this requires a paid plan |
| Site shows a blank page or assets return 404 | `base` in `vite.config.ts` does not match the repository name |
| "SkyRoute could not start" message | The browser blocks Service Workers (some private modes). Use a normal window of a current browser |
| API calls return HTML or 404 in the Network tab | The Service Worker is not active yet: reload once. In DevTools → Application → Service Workers, check that `mockServiceWorker.js` is *activated* |
| Old version still shown after a deploy | Hard refresh; Pages caches assets for a few minutes |
| Bookings disappeared | Data is per browser: another browser/profile, cleared site data or `/#/reset-test` |
| Verify job fails but the build job passed | Open the uploaded `playwright-report-live` artifact; usually a timing issue right after deploy, so re-run the job |

## Rollback

* **Quick:** in **Actions**, open the last good *Test and deploy* run and choose **Re-run all jobs**. That redeploys that commit's build.
* **Permanent:** revert the bad commit and push: `git revert <sha> && git push origin main`.
