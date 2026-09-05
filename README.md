# BYN Price Converter

Free, open-source browser extension (Chrome MV3). Reads the Belarusian
ruble (BYN) prices shown on **kufar.by** and **av.by** listing, search, and
detail pages, and displays an additional estimated price in US dollars
and/or euros next to them, using the official exchange rates published by
the National Bank of the Republic of Belarus.

Adding a new site is a small, local change: one entry in
`src/sites/sites.json`, one adapter module in `src/sites/`, one line in
`src/sites/adapters.ts`. See `.claude/skills/byn-price-converter/SKILL.md`
for the adapter contract and the legality constraints this project keeps.

## Development

```sh
npm install
npm run dev       # esbuild watch build -> dist/
npm run build     # production build -> dist/
npm test          # vitest
npm run typecheck # tsc --noEmit
```

Load `dist/` as an unpacked extension at `chrome://extensions`.

## Privacy Policy

See [PRIVACY.md](PRIVACY.md).
