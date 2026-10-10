# Market packs

One folder per country, named by its ISO code (`MY`, `SG`, ...). Adding a country means adding a folder; the agents and skills do not change.

The app reads `market.json` (form fields, currency, demo). The agents read the rest of the folder for the market in `profile.market`.

```
markets/<CODE>/
  market.json        required: what the app needs (see below)
  sme_rules.json     required: official SME definition as data (same shape as MY)
  sme_definition.md  required: the same rules in prose, with the official source URL
  funding_db.csv     required: one row per programme, same columns as MY/funding_db.csv
  funding_db.json    same rows as the CSV
  programs/<id>.md   required: one fact sheet per programme, including "## Required documents"
  glossary.md        optional: local-language finance terms
```

## market.json

| Field | Meaning |
|---|---|
| `code`, `name` | ISO code and English name |
| `currency`, `currencySymbol`, `locale` | e.g. `MYR`, `RM`, `en-MY` |
| `languages` | languages owners may write in |
| `regionLabel`, `regions` | label and options for the region dropdown (State, District, Province...) |
| `registry` | business registry: `name` (SSM, ACRA...), `fullName`, `sinceLabel` for the form |
| `ownershipFlags` | `{id, label}` options funding rules depend on (Bumiputera, women-owned...) |
| `ownershipHelp` | help text under those options |
| `smeAuthority` | who publishes the SME definition |
| `files` | paths of the files above, relative to this folder |
| `demo` | optional demo business JSON served from `public/` |

## Rules for pack data

- Every programme row and every SME threshold carries an official source URL and a `checked` date.
- Anything not confirmed on an official page is marked `VERIFY` in `verify_flag`. Never fill a gap with a guess.
- Money columns in the business data keep their `*Rm` names for every market; they hold amounts in the pack's `currency`.

## Turning a market on in the app

Import its `market.json` in `lib/markets.ts` and add it to `PACKS`. Until then it shows as "Soon" in the market picker.
