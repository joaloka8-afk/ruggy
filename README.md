# ruggy

`ruggy` is a Telegram bot that scans Solana meme coin contract addresses and returns a scam-risk style report with:
- 3 analysis agents
- A `0-100` safety score (`100` safer, `0` highest risk)
- Human-readable explanation text
- Optional chat interaction mode

## Features
- CA-first UX: users can paste a Solana contract address directly.
- Command support: `/start`, `/help`, `/scan <CA>`.
- Hybrid AI mode:
  - Deterministic 3-agent scoring always runs.
  - OpenAI is optional for richer chat/report language.
- Railway-ready runtime:
  - Webhook mode when `TELEGRAM_WEBHOOK_URL` is set.
  - Polling mode otherwise.

## Tech stack
- Node.js + TypeScript
- Telegraf (Telegram)
- Rugcheck API + DexScreener API
- OpenAI (optional)
- Pino logging
- Express health/webhook server

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Add at minimum:
   - `TELEGRAM_BOT_TOKEN`
4. Run development mode:
   ```bash
   npm run dev
   ```

## Production build
```bash
npm run build
npm run start
```

## Environment variables
- Required:
  - `TELEGRAM_BOT_TOKEN`
- Optional:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default: `gpt-4.1-mini`)
  - `TELEGRAM_WEBHOOK_URL` (enables webhook mode)
  - `WEBHOOK_PATH` (default: `/telegram/webhook`)
  - `PORT` (default: `3000`)
  - `LOG_LEVEL` (default: `info`)
  - `CHAT_MEMORY_TURNS` (default: `8`)

## Telegram usage
- `/scan <SOLANA_CA>` to analyze a token.
- Paste a CA directly in chat for instant scan.
- Send normal text to chat with Ruggy.

## Scoring model
Overall score is weighted from 3 agents:
- On-Chain Risk Agent (`45%`)
- Market Behavior Agent (`35%`)
- Trust & Social Agent (`20%`)

Verdict bands:
- `80-100` lower risk
- `60-79` caution
- `40-59` high risk
- `0-39` extreme risk

If Rugcheck flags a token as rugged, overall score is hard-capped to a very low range.

## Railway deploy
### Option A: Webhook mode (recommended for Railway web service)
Set these vars in Railway:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_URL=https://<your-app>.up.railway.app`
- Optional: `OPENAI_API_KEY`

Ruggy will auto-register webhook at:
- `${TELEGRAM_WEBHOOK_URL}${WEBHOOK_PATH}`

### Option B: Polling mode
Leave `TELEGRAM_WEBHOOK_URL` empty and run as worker/service.

## Test and checks
```bash
npm run typecheck
npm run test
npm run build
```

## GitHub push flow
Run these commands from the project root:
```bash
git init
git add .
git commit -m "feat: ruggy v1 telegram scam detector"
gh repo create ruggy --public --source . --remote origin --push
```

## Disclaimer
Ruggy provides risk signals only. It does not provide financial advice or guarantee token safety.

