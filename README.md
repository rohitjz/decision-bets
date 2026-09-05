# 🎲 Decision Bets

A small decision tool inspired by Annie Duke's **_Thinking in Bets_** (via
[this video summary](https://www.youtube.com/watch?v=nc4u9oxb0nA)).

The core idea: **every decision is a bet on a future you can't see.** Good outcomes can come from
bad decisions and vice versa, so if you only judge yourself by results, you learn the wrong lessons.
This tool makes you write down the odds *before* you know how it turned out — then lets you come
back later and honestly separate skill from luck.

## How it works

**1. Make the bet.** Name the decision, list the outcomes you can imagine, and give each one a value
and a probability. The tool computes the expected value as you type. Then answer one question:
*it's a year later and this failed — why?* Writing the failure story in advance is what surfaces the
exit ramps early.

**2. Record the outcome.** Once reality lands, reopen the decision and rate it on a skill↔luck dial —
scoring it as if a stranger had made the move, which is the only way around your own self-serving
bias. Add what you'd do differently.

That's the whole app: two steps, one page.

## Storage

Decisions are saved to **Azure Table Storage** through a small Azure Functions API, partitioned per
user so everyone gets their own private list. No login is required — the browser generates a random
user id on first visit and keeps it in `localStorage`.

If the API isn't reachable (for example on the GitHub Pages mirror), the app transparently falls
back to browser-only storage and the badge reads "saved on this device" instead of "☁ saved to Azure".

```
GET    /api/decisions?user=<id>       list a person's decisions
POST   /api/decisions?user=<id>       save a new decision
PATCH  /api/decisions/<id>?user=<id>  attach the outcome review
DELETE /api/decisions/<id>?user=<id>  remove a decision
```

## Running locally

The front end is plain HTML/CSS/JS with no build step, so you can just open `index.html`.
To run it with the API:

```bash
npm install -g @azure/static-web-apps-cli
cd api && npm install && cd ..
swa start . --api-location api
```

Set `STORAGE_CONNECTION_STRING` in `api/local.settings.json` to a real storage account, or leave it
unset to use the Azurite emulator (`UseDevelopmentStorage=true`).

## Deploying

Pushes to `main` deploy automatically to Azure Static Web Apps via
[the workflow](.github/workflows/azure-static-web-apps.yml). It needs one repository secret,
`AZURE_STATIC_WEB_APPS_API_TOKEN`, and one app setting on the Static Web App,
`STORAGE_CONNECTION_STRING`. No secrets live in this repo.

## Credit

Framework adapted from Annie Duke's *Thinking in Bets*, via
["If You Only Read One Book This Year, Make It This"](https://www.youtube.com/watch?v=nc4u9oxb0nA)
by Sandeep Swadia. This is a thinking aid, not advice.

## License

MIT — see [LICENSE](LICENSE).
