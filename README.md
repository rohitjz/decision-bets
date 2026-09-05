# 🎲 Decision Bets

A small, no-build, static web app that turns the ideas from Annie Duke's **_Thinking in Bets_**
(as summarized in [this video](https://www.youtube.com/watch?v=nc4u9oxb0nA), *"If You Only Read
One Book This Year, Make It This"*) into a practical decision-making toolkit.

**Live demo:** enabled via GitHub Pages once published — see the repository "About" section / Pages URL.

## Why

Good results are bad teachers. Outcomes are a mix of skill, luck, timing, and emotion, so judging a
decision purely by how it turned out is a trap. This tool operationalizes four ideas from the book
so you can audit your *process* instead of just your results:

1. **EVA Framework (Expected Value Analysis)** — map out 4-5 future scenarios, assign a payoff and a
   probability to each, and calculate expected value. Includes a pre-mortem prompt: *"it's 12 months
   from now and it all failed — what happened?"*
2. **Known / Unknown table** — separate what you actually know from the hidden cards: your
   assumptions and hopes. Life is poker, not chess — the board isn't fully visible.
3. **Belief Calibration ("You want to bet?")** — replace binary right/wrong thinking with a
   confidence percentage for every belief your decision depends on, and ask if you'd actually put
   money on it.
4. **Skill vs Luck Audit** — after the fact, rate a decision on a skill/luck dial instead of asking
   "was I smart or lucky?" (a question your self-serving bias has already rigged), and separate
   what was skill, what was luck, and what was just a plain mistake.

Every saved EVA analysis or Skill vs Luck audit is written to a **Decision Journal**, persisted in
your browser's `localStorage` — nothing is sent to a server.

## Running locally

No build step, no dependencies. Just open `index.html` in a browser, or serve the folder:

```bash
# any static file server works, e.g.
npx serve .
# or
python -m http.server 8000
```

## Tech

Plain HTML/CSS/JavaScript. No frameworks, no bundler, no npm install required — this is
intentional so it can be hosted for free on GitHub Pages with zero CI/build configuration.

## Credit

Framework and stories adapted from Annie Duke's book *Thinking in Bets: Making Smarter Decisions
When You Don't Have All the Facts*, via the YouTube video
["If You Only Read One Book This Year, Make It This"](https://www.youtube.com/watch?v=nc4u9oxb0nA)
by Sandeep Swadia.

## License

MIT — see [LICENSE](LICENSE).
