# DataShift

Free browser-based CSV/JSON conversion and a test-only x402 AI API. Replaces the original weather site; the repository name and Pages URL are unchanged.

- Website: https://d3nis4o.github.io/weather-website/
- AI entrance: https://datashift-api.datashift-d3nis4o.workers.dev/ai
- API docs: https://datashift-api.datashift-d3nis4o.workers.dev/docs
- Status: https://datashift-api.datashift-d3nis4o.workers.dev/health

## Free tools

CSV to JSON, JSON to CSV, JSON formatting, minification and validation. Browser conversion is local with no uploads, tracking scripts or third-party fonts. 128 KiB input, 512 KiB output, 2,000 rows, 100 columns. CSV headers must be unique/non-empty. JSON-to-CSV accepts an array of objects; nested values become JSON strings. Formula-like string cells are prefixed with an apostrophe for spreadsheet safety; inspect output before use.

## Payment status: TEST ONLY

The Worker accepts only Solana devnet USDC, not real USDC. 0.0004 test USDC (400 atomic units) is required per successful paid response. Network and mint are hard-coded to devnet and cannot be changed by request parameters. Wallet recipient: ANdBMwRimMyrm1qJ3vFtixK1DQ8WgSLKBYWxvcTHCvgY.

GET /ai is the paid AI entrance and returns an API catalog after one payment. POST /api/convert performs a conversion and requires a separate new payment. No access passes, sessions or reusable credits. /docs and /health are free discovery endpoints. The free public browser site is not a secure AI-detection gate: bots can still use it or copy this public source.

An x402 v2 client reads PAYMENT-REQUIRED from HTTP 402, signs a devnet transaction, and retries with PAYMENT-SIGNATURE. The Worker obtains feePayer from https://x402.org/facilitator/supported, validates server-owned requirements, uses /verify and /settle, and serves output only after successful settlement. A SQLite-backed Durable Object stores a one-use marker per signed transaction to block replay. Invalid conversion input is not settled. Ambiguous settlement failures deny output and reuse rather than risk double charging; a new payment attempt should not be automatic without inspecting the outcome.

Request body:
```json
{"operation":"csv-to-json","input":"name,age\nAda,36"}
```

## Development and deployment

Run `python3 -m http.server 8000` at repository root for the free site. No npm dependencies are required for the app. `npm test` runs local unit tests; facilitator verification and settlement in those tests are mocked, not real blockchain transactions.

GitHub Pages publishes the root of main. The Cloudflare API is deployed separately; a GitHub commit alone does not update it. To deploy manually, run `npx wrangler deploy --config worker/wrangler.jsonc` after Cloudflare login. Confirm the selected Cloudflare account and free-plan limits before deploying. No private wallet key is needed on the server.

API input is processed transiently; conversion input/output is not persisted by the app. Durable state stores replay markers only; signed test transactions are sent to the facilitator. Worker application observability is disabled. Cloudflare/provider infrastructure may retain operational metadata. Do not send secrets.

## Before real payments

Complete an end-to-end devnet test with a funded test payer. Review the payment transport, replay behavior, quotas, spam protection and error/refund handling. Choose a Solana-mainnet facilitator and review its fees/terms; the public test facilitator is not a production configuration. Mainnet activation needs a reviewed code change and explicit owner approval. Mainnet payments have not been enabled.

Protocol reference: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
