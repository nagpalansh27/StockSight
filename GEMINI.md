# StockSight — Project Rules

## What is this?
AI-powered, fact-based stock quality analyzer for Indian stocks. Built to counter rumor-driven investing with hard data and Rohit's analytical framework.

## Quick Reference
- **Repo**: `C:\Users\anshn\Documents\GitHub\StockSight\` → GitHub `nagpalansh27/StockSight`
- **Live**: TBD (Vercel)
- **Password**: `ansh` (SHA-256 hash gate with localStorage)
- **Always auto-push** using PowerShell CredRead from Windows Credential Manager

## Architecture
- `index.html` — Single-page app (HTML + CSS + JS), password-gated
- `api/stock.js` — Serverless: Yahoo Finance data fetcher + search
- `api/analyze.js` — Serverless: Gemini AI analysis proxy
- `api/news.js` — Serverless: Google News RSS parser
- Chart.js for financial charts (loaded via CDN)

## Environment Variables (Vercel)
- `GEMINI_API_KEY` — Google Gemini API key for AI analysis

## Core Philosophy (Rohit's Framework)
1. **Trust Numbers, Not Narratives** — every claim must cite a number
2. **Be Skeptical by Default** — if it sounds too good, disprove it
3. **12-Point Quality Checklist** — revenue, profit, cash flow, valuation, debt, promoter, ROE, auditor, narrative, volume, insider
4. **Rumor Buster** — actively find evidence AGAINST rumors
5. **Never Speculate** — say "insufficient data" instead of guessing

## Data Sources
- Yahoo Finance (via yahoo-finance2 npm) — financials, price history, key stats
- Google News RSS — recent news with sentiment
- Gemini API — AI-powered analysis and chat

## Rules
- Never change the password mechanism
- Never add buy/sell recommendations — facts and analysis only
- All monetary values in ₹ Cr/Lakh format
- Always show data source attribution
- Keep it single-file for index.html (HTML + CSS + JS)
- Dark mode only — no light mode toggle needed
