# StockSight 🔍 — Fact-Based Stock Intelligence

AI-powered, ruthlessly honest stock quality analyzer and rumor buster for Indian (NSE/BSE) and global stocks.

Inspired by real-world fundamental analysis and built to counter rumor-driven investing with audited numbers, capacity reality checks, and hard financial data.

---

## 🎯 What It Does

1. **📊 Stock Quality Score (0–100 & Letter Grade)**
   - Runs stocks through **StockSight's Institutional 12-Point Quality Checklist**:
     - Revenue Reality (Multi-year CAGR & YoY)
     - Profit Quality (Operating Profit Margins)
     - Cash Flow vs. Net Income verification
     - Valuation Sanity (Market Cap ÷ Revenue)
     - Debt Load (Debt-to-Equity thresholds)
     - Promoter & Insider Holding alignment
     - Return on Equity (ROE capital efficiency)
     - Abnormal Volume Spike detection (operator pump alerts)
     - Balance Sheet checks

2. **🔍 Rumor Buster Mode**
   - Enter any WhatsApp tip, forum claim, or rumor (e.g., *"XYZ company got a ₹5,000 Cr order and will 3x"*).
   - StockSight actively acts as devil's advocate to **disprove** the claim using:
     - Hard Margin Arithmetic: `Order Value × OPM = Pre-Tax Profit` vs. Market Cap reaction
     - Industrial Capacity & Capex Cycle constraints
     - Mandatory Regulatory Filing checks

3. **💬 AI Financial Assistant**
   - Ask anything about stocks, valuation multiples, or industry dynamics.
   - Grounded strictly in facts and numbers — no speculation or vague promises.

4. **📈 Multi-Year Interactive Charts**
   - Annual Revenue & Net Profit trends
   - Operating & Free Cash Flow history
   - 5-Year Price trajectory
   - Operating Profit Margin (OPM) evolution

---

## 🤖 AI Backend Options

- **Google Gemini API** (Gemini 2.0 Flash)
- **Local Qwen 27B** on RTX 4090 via Ollama (`http://localhost:11434`)
- **Offline Rule-Based Fact Engine** (Zero external dependencies)

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/nagpalansh27/StockSight.git
cd StockSight

# Install dependencies (optional for local dev)
npm install

# Run locally using Vercel CLI
npx vercel dev
```

### Password Gate
Default client gate: `ansh` (SHA-256 hashed with localStorage persistence).
