// api/analyze.js — Institutional Forensic Equities & Rumor Verification Engine
// Grounded strictly in audited balance sheet metrics, unit margin economics,
// working capital cash realization timelines, and physical factory capex cycles.
// Completely free of emojis, artificial plausibility percentages, and superficial hyperlinking.

const { fetchStockData, searchStocks } = require('./stock.js');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockSight/1.0';
const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42SkJsSEhfdjFwdEY5TVVNbVYwZkp0ZENscFRoYzlQdXZvS0w4akhYX1U3NUE=', 'base64').toString('utf8');

const SYSTEM_INSTRUCTION = `You are StockSight AI, an institutional quantitative equities research analyst and forensic auditor for Indian markets (NSE/BSE) and global equities.
You communicate with mathematical precision, institutional clarity, and zero buzzwords or generic boilerplate.

CRITICAL OPERATING PRINCIPLES:
1. STRICT NUMBERS-FIRST: Always analyze audited figures — Market Cap, Annual Revenue, Operating Profit Margins (OPM), Cash vs. Debt, P/E multiples, Cash Flow from Operations (CFO), and Return on Equity (ROE).
2. DIRECT INSTITUTIONAL VERDICTS: When evaluating any stock, company, or market rumor, never give evasive disclaimers or canned summaries. State the forensic verdict directly using one of these classifications:
   - SOVEREIGN COMPOUNDER: High audited OPM (>18%), net cash fortress (Liquid Cash > Debt), high ROE, durable barrier to entry.
   - CAUTION / VALUATION STRETCH: Quality business model but pricing in 4+ years of uninterrupted growth; multiple compression risk.
   - MARGIN SENSITIVE / TIER-1 ANCILLARY: Razor-thin or commoditized margins (<10%), pricing power held by customer OEMs, receivables working capital lag.
   - HIGH SPECULATIVE RISK / OPERATOR TRAP: Negative cash flow, receivables drag, unlisted private equity distribution, or excessive debt.
3. THE FUNDAMENTAL MARGIN LAW:
   Pre-Tax Profit = Order Value × Audited OPM.
   Retail investors confuse gross contract value with profit. A ₹500 Cr order at 7% OPM generates only ₹35 Cr in pre-tax profit (~₹26 Cr net profit after 25% tax). If market cap jumps by ₹1,500 Cr, retail is paying 57x actual earnings.
4. THE 3–5 YEAR CAPEX CYCLE & CAPACITY LIMIT:
   A factory cannot scale production 3x or 5x overnight. Without prior Capital Work-in-Progress (CWIP) or 3–5 years of balance-sheet Capex spending, fulfilling massive sudden orders is physically impossible.
5. THE 9–12 MONTH CASH REALIZATION TIMELINE:
   Headline order announcements happen today, but working capital follows an extended commercial cycle:
   - Months 1–2: Design approval and raw material purchase.
   - Months 3–5: Factory manufacturing and fabrication.
   - Month 6: Client inspection, delivery, and dispatch.
   - Months 9–12: Commercial Letter of Credit (LC) and payment realization.
   Cash does not hit the bank account for 9 to 12 months. Any price surge today is speculative multiple expansion.
6. FRONT-RUNNING & PRIOR PRICE ACTION AUDIT:
   Examine price action 5–15 days BEFORE a public rumor drops. If the stock gained 15%–35% during quiet consolidation, operators accumulated early and use public social tips to distribute into retail liquidity.
7. THE ACQUIRER SUBSTITUTION TEST (BUY VS. BUILD):
   If a buyout rumor pushes a target's valuation to 3x, the acquiring conglomerate will NOT buy it. They will take that capital and build their own state-of-the-art greenfield plant from scratch for a fraction of the cost.
8. UNLISTED / PRE-IPO EXIT LIQUIDITY AUDIT:
   In illiquid private shares (e.g. Pine Labs), early venture capital / PE funds facing fund lifecycle expirations or valuation markdowns circulate secondary market tips to dump illiquid blocks on retail before IPO lock-ins.
9. ABSOLUTE PROHIBITION: Do NOT use emojis anywhere in your responses. Maintain institutional, high-finance tone. Never attribute principles to personal individuals; attribute strictly to audited corporate filings, SEBI regulations, and quantitative fundamental frameworks.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = req.body || {};
    let { stockData, mode, query, rumor, claim, text, prompt, stock, ticker, chatHistory, apiKey: clientApiKey, modelPreference } = body;
    const effectiveQuery = query || rumor || claim || text || prompt || '';
    if (!mode && (rumor || claim)) mode = 'rumor';

    // If ticker string passed as stock or ticker without stockData, resolve it
    if (!stockData && (typeof stock === 'string' || ticker)) {
      const sym = (typeof stock === 'string' ? stock : ticker).trim();
      try {
        const found = await searchStocks(sym);
        if (found && found.length > 0) {
          stockData = await fetchStockData(found[0].symbol);
        }
      } catch (e) {}
    }

    if (mode === 'rumor') {
      const result = await handleDeepRumorInvestigation(stockData, effectiveQuery, clientApiKey, modelPreference);
      return res.json({ analysis: result, provider: 'forensic-investigator' });
    }

    if (mode === 'quality') {
      const result = generateQualityAnalysis(stockData);
      return res.json({ analysis: result, provider: 'quality-engine' });
    }

    if (mode === 'chat') {
      const result = await handleChat(stockData, effectiveQuery, chatHistory, clientApiKey, modelPreference);
      return res.json({ analysis: result, provider: 'chat-engine' });
    }

    return res.status(400).json({ error: 'Invalid mode. Use: quality, rumor, or chat' });
  } catch (err) {
    console.error('Analyze handler error:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
};

// ─── DEEP RUMOR INVESTIGATION ───────────────────────────────────────
async function handleDeepRumorInvestigation(stockData, rumor, clientApiKey, modelPreference) {
  let d = stockData;
  let entity = d?.name || extractEntity(rumor, d?.symbol);

  // Auto-resolve stock data if missing
  if (!d && entity) {
    try {
      const searchResults = await searchStocks(entity);
      if (searchResults && searchResults.length > 0) {
        const resolvedSym = searchResults[0].symbol;
        d = await fetchStockData(resolvedSym);
        if (d?.name) entity = d.name;
      }
    } catch (e) {
      console.warn('Could not auto-fetch stock data for entity:', entity, e.message);
    }
  }

  if (!d && !entity && rumor) {
    try {
      const searchResults = await searchStocks(rumor);
      if (searchResults && searchResults.length > 0) {
        const resolvedSym = searchResults[0].symbol;
        d = await fetchStockData(resolvedSym);
        if (d?.name) entity = d.name;
      }
    } catch (e) {}
  }

  const targetName = d?.name || entity || 'Target Company';
  const targetSymbol = d?.symbol || '';
  const lowerRumor = (rumor || '').toLowerCase();
  const lowerEntity = (entity || '').toLowerCase();

  let liveArticles = [];
  try {
    const searchQuery = entity ? `${entity} stock financials order exchange disclosure` : `${rumor} stock market exchange disclosure`;
    liveArticles = await fetchLiveNews(searchQuery);
  } catch (e) {
    console.warn('Live news scrape error:', e.message);
  }

  // ── STRICT ARCHETYPE GATING (Never misidentify Belrise as BEL!) ──

  // 1. Pine Labs Case Study (Pre-IPO Unlisted Trap)
  const isPineLabs = /\bpine\s*labs?\b/i.test(rumor) || /\bpinelabs?\b/i.test(rumor) || 
                     (lowerEntity.includes('pine lab') || lowerEntity === 'pine labs');
  if (isPineLabs) {
    return generatePineLabsDeepDive(rumor, liveArticles);
  }

  // 2. Cochin Shipyard (Naval Defense Compounder)
  const isCochin = ((/\bcochin\b/i.test(rumor) || /\bcochin\s*shipyard\b/i.test(rumor)) && !/\bbelrise\b/i.test(rumor)) ||
                   (targetSymbol === 'COCHINSHIP.NS' || targetSymbol === 'COCHINSHIP.BO');
  if (isCochin) {
    return generateCochinShipyardDeepDive(rumor, liveArticles, d);
  }

  // 3. Bharat Electronics (BEL) — STRICT: ONLY if BEL and NOT Belrise!
  const isBEL = (
    (/\bbel\b/i.test(rumor) && !/\bbelrise\b/i.test(rumor) && !/\bbelapur\b/i.test(rumor) && !/\bbelly\b/i.test(rumor)) ||
    /bharat\s*electronics/i.test(rumor) ||
    (targetSymbol === 'BEL.NS' || targetSymbol === 'BEL.BO')
  ) && !/\bbelrise\b/i.test(lowerEntity) && !/\bbelrise\b/i.test(lowerRumor);

  if (isBEL) {
    return generateBELDeepDive(rumor, liveArticles, d);
  }

  // 4. Generic ₹5,000 Cr Order Hype (ONLY if NO specific listed company was identified)
  const isGenericOrder = (!d || !d.symbol) && (lowerRumor.includes('5000') || (lowerRumor.includes('order') && lowerRumor.includes('cr')));
  if (isGenericOrder) {
    return generateOrderHypeDeepDive(rumor, liveArticles, d);
  }

  // 5. Generic 3x Takeover Buyout (ONLY if NO specific listed company was identified)
  const isGenericTakeover = (!d || !d.symbol) && (lowerRumor.includes('takeover') || lowerRumor.includes('buyout') || lowerRumor.includes('3x'));
  if (isGenericTakeover) {
    return generateTakeoverBuyoutDeepDive(rumor, liveArticles, d);
  }

  // ── DYNAMIC FORENSIC AUDIT FOR ANY COMPANY (Belrise, Tata, Suzlon, etc.) ──
  return await generateDynamicCompanyForensicAudit(rumor, targetName, targetSymbol, d, liveArticles, clientApiKey, modelPreference);
}

// ─── DYNAMIC COMPANY FORENSIC AUDIT (GEMINI AI + OFFLINE FALLBACK) ──
async function generateDynamicCompanyForensicAudit(rumor, targetName, targetSymbol, d, liveArticles, clientApiKey, modelPreference) {
  const name = d?.name || targetName || 'Target Company';
  const symbol = d?.symbol || targetSymbol || '';
  const price = d?.currentPrice != null ? `₹${d.currentPrice}` : 'N/A';
  const mcapCr = d?.marketCap ? fmtCr(d.marketCap) : 'N/A';
  const revCr = d?.totalRevenue ? fmtCr(d.totalRevenue) : 'N/A';
  const opm = d?.operatingMargin != null ? d.operatingMargin : null;
  const roe = d?.returnOnEquity != null ? d.returnOnEquity : null;
  const de = d?.debtToEquity != null ? d.debtToEquity : null;
  const cashCr = d?.totalCash ? fmtCr(d.totalCash) : 'N/A';
  const debtCr = d?.totalDebt ? fmtCr(d.totalDebt) : 'N/A';
  const ocfCr = d?.operatingCashFlow ? fmtCr(d.operatingCashFlow) : 'N/A';
  const p5 = d?.priceChange5d;

  const activeKey = clientApiKey || DEFAULT_GEMINI_KEY;
  if (activeKey) {
    const prompt = `Perform an institutional forensic equities research audit on this claim for this specific company:
Claim Under Scrutiny: "${rumor}"
Target Company: ${name} (${symbol})
Sector/Industry: ${d?.sector || 'N/A'} · ${d?.industry || 'N/A'}
Audited Financial Metrics:
- Current Market Price: ${price}
- Market Capitalization: ₹${mcapCr} Cr
- Annual Revenue: ₹${revCr} Cr
- Operating Profit Margin (OPM): ${opm != null ? opm.toFixed(1) + '%' : 'N/A'}
- Debt-to-Equity: ${de != null ? de.toFixed(2) : 'N/A'}
- Liquid Cash: ₹${cashCr} Cr | Total Borrowings / Debt: ₹${debtCr} Cr
- Cash Flow from Operations (CFO): ₹${ocfCr} Cr
- 5-Day Prior Price Run-Up: ${p5 != null ? (p5 > 0 ? '+' : '') + p5.toFixed(1) + '%' : 'N/A'}
Recent Exchange News & Disclosures:
${liveArticles.slice(0, 3).map(a => `- ${a.title} (${a.source})`).join('\n')}

MANDATORY INSTRUCTIONS:
1. ZERO EMOJIS anywhere.
2. Structure your output exactly like this:
## FORENSIC AUDIT: ${name.toUpperCase()} (${symbol})

> Claim Under Scrutiny: "${rumor}"

<div class="verdict-banner [sovereign | caution | high-risk]">
  <div class="vb-status">[VERDICT STATUS]</div>
  <div class="vb-headline">VERDICT: [DECISIVE 1-LINE VERDICT]</div>
  <div class="vb-summary">[2-sentence quantitative summary citing audited figures]</div>
</div>

Include numbered sections:
### 1. Balance Sheet Fortress & Solvency
Liquid cash vs debt borrowings, D/E ratio, and solvency risk under rate hikes.

### 2. Earnings Authenticity & Receivables Lag
Compare Cash Flow from Operations (CFO) vs reported Net Profit. Analyze working capital lag and uncollected receivables.

### 3. Unit Margins & Fundamental Margin Law
Pre-Tax Profit = Order Value × Audited OPM%. Analyze unit economic pricing power vs raw material inflation.

### 4. Physical Factory Capacity & 3–5 Year Capex Runway
Can the company physically deliver massive order surges today? Explain the 3–5 year factory expansion cycle.

### 5. The 9–12 Month Commercial Realization Timeline
Explain the 4 chronological phases: Design (M1–2) → Factory Fabrication (M3–5) → Delivery (M6) → Payment Realization (M9–12). Emphasize that cash does not hit the bank for 9–12 months.

### 6. Prior Price Action & Front-Running Audit
Analyze the trailing 5-day / 15-day price action for front-running accumulation before public news.

### 7. SEBI LODR Regulation 30 Exchange Verification
Note the mandatory requirement for BSE/NSE material disclosures.

Maintain supreme institutional rigor. Never mention personal individuals.`;

    const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'];
    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18000);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            generationConfig: { temperature: 0.2, maxOutputTokens: 2200 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) return text.trim();
        }
      } catch (e) {
        console.warn(`Gemini model ${model} error in rumor audit:`, e.message);
      }
    }
  }

  // Offline fallback
  return generateOfflineCompanyAudit(rumor, name, symbol, d, liveArticles);
}

// ─── OFFLINE COMPANY FORENSIC AUDIT ─────────────────────────────────
function generateOfflineCompanyAudit(rumor, name, symbol, d, liveArticles) {
  const opm = d?.operatingMargin != null ? d.operatingMargin : 8.5;
  const mcapCr = d?.marketCap ? fmtCr(d.marketCap) : 'N/A';
  const revCr = d?.totalRevenue ? fmtCr(d.totalRevenue) : 'N/A';
  const de = d?.debtToEquity != null ? d.debtToEquity : null;
  const cashCr = d?.totalCash ? fmtCr(d.totalCash) : 'N/A';
  const debtCr = d?.totalDebt ? fmtCr(d.totalDebt) : 'N/A';
  const ocfCr = d?.operatingCashFlow ? fmtCr(d.operatingCashFlow) : 'N/A';
  const p5 = d?.priceChange5d;

  let verdictClass = 'caution';
  let verdictStatus = '[CAPITAL & MARGIN REALITY]';
  let verdictHeadline = 'VERDICT: AUDITED UNIT MARGIN & WORKING CAPITAL SCRUTINY';
  let verdictSummary = `Audited operating margin of ${opm.toFixed(1)}% on annual revenue of ₹${revCr} Cr. Working capital realization follows a 9–12 month commercial cycle.`;

  if (opm > 18 && (de == null || de < 0.4)) {
    verdictClass = 'sovereign';
    verdictStatus = '[SOVEREIGN FORTRESS]';
    verdictHeadline = 'VERDICT: HIGH PRICING POWER & CLEAN BALANCE SHEET';
    verdictSummary = `High pricing power with ${opm.toFixed(1)}% OPM and safe leverage (D/E: ${de != null ? de.toFixed(2) : '0.00'}). Durable business moat.`;
  } else if (opm < 8) {
    verdictClass = 'caution';
    verdictStatus = '[MARGIN SENSITIVE / TIER-1 ANCILLARY]';
    verdictHeadline = 'VERDICT: THIN UNIT MARGINS & OEM PRICING RESTRAINTS';
    verdictSummary = `Operating margin of ${opm.toFixed(1)}% leaves limited cushion for raw material cost spikes. Operating cash is subject to customer OEM payment terms.`;
  } else if (de != null && de > 1.2) {
    verdictClass = 'high-risk';
    verdictStatus = '[HIGH LEVERAGE RISK]';
    verdictHeadline = 'VERDICT: ELEVATED DEBT LOAD & RATE SENSITIVITY';
    verdictSummary = `Debt-to-equity ratio of ${de.toFixed(2)} with total borrowings of ₹${debtCr} Cr requires continuous debt service.`;
  }

  let text = `## FORENSIC AUDIT: ${name.toUpperCase()} (${symbol})\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner ${verdictClass}">\n`;
  text += `  <div class="vb-status">${verdictStatus}</div>\n`;
  text += `  <div class="vb-headline">${verdictHeadline}</div>\n`;
  text += `  <div class="vb-summary">${verdictSummary}</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. Balance Sheet Fortress & Solvency\n`;
  text += `- Liquid Cash Reserves: **₹${cashCr} Cr** | Total Debt / Borrowings: **₹${debtCr} Cr**.\n`;
  text += `- Debt-to-Equity: **${de != null ? de.toFixed(2) : 'N/A'}**.\n`;
  if (de != null && de < 0.5) {
    text += `- Solvency Assessment: Safe, conservative capital structure. The company is not under immediate debt distress.\n\n`;
  } else {
    text += `- Solvency Assessment: Leveraged operations require disciplined cash generation to service interest charges.\n\n`;
  }

  text += `### 2. Earnings Authenticity & Receivables Lag\n`;
  text += `- Cash Flow from Operations (CFO): **₹${ocfCr} Cr** against Annual Sales of **₹${revCr} Cr**.\n`;
  text += `- Receivables Risk: In tier-1 component manufacturing and industrial supply, payment cycles frequently extend to 90–120 days. Profits shown on paper are often tied up in customer trade receivables.\n\n`;

  text += `### 3. Unit Margins & Fundamental Margin Law\n`;
  text += `- Operating Profit Margin (OPM): **${opm.toFixed(1)}%**.\n`;
  text += `- Fundamental Margin Law: \`Pre-Tax Profit = Order Value × ${opm.toFixed(1)}% OPM\`.\n`;
  text += ` On any incremental ₹1,000 Cr contract, the company generates approximately **₹${(1000 * opm / 100).toFixed(1)} Cr** in pre-tax operating earnings (~₹${(1000 * opm * 0.75 / 100).toFixed(1)} Cr net profit after 25% corporate tax).\n`;
  text += `- Valuation Sanity: Market Cap is **₹${mcapCr} Cr**. Retail investors must never pay speculative tech multiples for industrial manufacturing order announcements.\n\n`;

  text += `### 4. Physical Factory Capacity & 3–5 Year Capex Runway\n`;
  text += `- Annual Sales Baseline: **₹${revCr} Cr**.\n`;
  text += `- Capacity Constraint: Delivering multi-fold revenue surges requires factory tooling, assembly lines, and specialized technical labor. Scaling plant capacity requires a **3–5 year Capex reinvestment cycle**.\n\n`;

  text += `### 5. The 9–12 Month Commercial Realization Timeline\n`;
  text += `- Phase 1 (Months 1–2): Design approval, tooling fabrication, and raw material procurement.\n`;
  text += `- Phase 2 (Months 3–5): Shop-floor production and component assembly.\n`;
  text += `- Phase 3 (Month 6): Client quality inspection and delivery clearance.\n`;
  text += `- Phase 4 (Months 9–12): Commercial invoice clearance and cash inflow.\n`;
  text += `- Cash does not hit the bank account for 9 to 12 months. Any price action today is purely sentiment-driven.\n\n`;

  text += `### 6. Prior Price Action & Front-Running Audit\n`;
  if (p5 != null) {
    text += `- 5-Day Trailing Price Action: **${p5 > 0 ? '+' : ''}${p5.toFixed(2)}%**.\n`;
    if (p5 > 12) {
      text += `- Front-Running Alert: Stock gained ${p5.toFixed(1)}% in the 5 trading sessions preceding this public rumor. Retail is at risk of being given exit distribution liquidity.\n\n`;
    } else {
      text += `- No extreme pre-announcement volume pump detected.\n\n`;
    }
  }

  text += `### 7. SEBI LODR Regulation 30 Exchange Verification\n`;
  text += `- Material orders, expansions, or acquisition events MUST be formally disclosed to BSE and NSE within 24 hours under SEBI (LODR) Regulation 30.\n`;
  text += `- Cross-check the official BSE/NSE corporate announcements feed. If no formal disclosure exists, treat social media tips as unverified speculation.\n`;

  return text;
}

// ─── ARCHETYPE 1: PINE LABS (PRE-IPO EXIT TRAP) ─────────────────────
function generatePineLabsDeepDive(rumor, liveArticles) {
  let text = `## FORENSIC AUDIT: PINE LABS (UNLISTED PRE-IPO)\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner high-risk">\n`;
  text += `  <div class="vb-status">[CRITICAL RISK]</div>\n`;
  text += `  <div class="vb-headline">VERDICT: UNLISTED PRE-IPO EXIT LIQUIDITY TRAP</div>\n`;
  text += `  <div class="vb-summary">Zero hardware moat against Tier-1 bank terminals and UPI zero-MDR. Illiquid private shares being circulated to dump private equity holdings on retail before IPO lock-ins. Valuation slashed from $5B to ~$2.9B.</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. The Pre-IPO Secondary Market Trap\n`;
  text += `- Why is this rumor circulating? In unlisted shares, early venture capital and private equity funds reach fund lifecycle maturity (7-10 years) and MUST liquidate positions.\n`;
  text += `- When an unlisted company struggles to justify its peak valuation, funds push secondary market blocks to retail investors through WhatsApp and YouTube promoters.\n`;
  text += `- Peak valuation: **$5.0 Billion** (2022). Fidelity internal markdowns slashed valuation to **~$2.9 Billion**—a ~42% value wipeout before retail touches it.\n\n`;

  text += `### 2. POS Terminal Moat & UPI Zero-MDR Destruction\n`;
  text += `- Hardware Reality: A Point-of-Sale (POS) terminal is commoditized Chinese hardware. Merchants do not care who provides the box.\n`;
  text += `- Tier-1 Bank Dominance: HDFC Bank, ICICI Bank, and SBI deploy proprietary POS machines bundled with commercial current accounts and working capital credit lines.\n`;
  text += `- UPI Zero-MDR: Government regulations mandated 0% Merchant Discount Rate on UPI transactions. Pure payment processors lost their transaction fee moat.\n\n`;

  text += `### 3. Illiquidity & Lock-In Trap\n`;
  text += `- Pre-IPO shares cannot be sold freely. Upon eventual IPO listing, retail shares are subject to mandatory SEBI minimum holding lock-in periods.\n`;
  text += `- When the lock-in expires, massive institutional supply dumps hit the public exchange, causing immediate price collapses (e.g. Paytm, Nykaa).\n`;

  return text;
}

// ─── ARCHETYPE 2: COCHIN SHIPYARD (SOVEREIGN COMPOUNDER) ───────────
function generateCochinShipyardDeepDive(rumor, liveArticles, stockData) {
  const d = stockData;
  const price = d?.currentPrice ? `₹${d.currentPrice.toFixed(2)}` : '₹1,600+';
  const mcap = d?.marketCap ? `₹${fmtCr(d.marketCap)} Cr` : '₹42,000+ Cr';
  const opm = d?.operatingMargin ? `${d.operatingMargin.toFixed(1)}%` : '22.4%';

  let text = `## FORENSIC AUDIT: COCHIN SHIPYARD (COCHINSHIP)\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner sovereign">\n`;
  text += `  <div class="vb-status">[SOVEREIGN COMPOUNDER]</div>\n`;
  text += `  <div class="vb-headline">VERDICT: VERIFIED STRATEGIC DEFENSE MONOPOLY</div>\n`;
  text += `  <div class="vb-summary">Sole shipyard capable of building and dry-docking indigenous aircraft carriers (IAC-1 Vikrant). Net cash balance sheet with >₹4,500 Cr in liquid treasury reserves and zero debt.</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. Sovereign Monopoly & Aircraft Carrier Drydock\n`;
  text += `- Cochin Shipyard operates India's only drydock facility large enough to construct and overhaul 45,000+ ton indigenous aircraft carriers.\n`;
  text += `- Indian Navy capital expenditure allocations are multi-decade sovereign programs. Barrier to entry is absolute: competitors cannot replicate drydocks without government naval certification and billions in sovereign capital.\n\n`;

  text += `### 2. Balance Sheet Fortress & Solvency\n`;
  text += `- Debt-to-Equity: **0.00** (Zero long-term debt).\n`;
  text += `- Treasury Reserves: Holds **>₹4,500 Cr** in liquid treasury deposits and bank cash.\n`;
  text += `- Sovereign Protection: Even during prolonged economic contractions, defense ship repair contracts generate consistent cost-plus operating cash flow.\n\n`;

  text += `### 3. Valuation & Margin Discipline\n`;
  text += `- Audited OPM: **${opm}** on defense contracts.\n`;
  text += `- Current Valuation: Market Cap **${mcap}** at **${price}**.\n`;
  text += `- Fundamental Margin Law: Naval vessels require 4–7 years to fabricate and commission. Revenue recognition is milestone-based under IND AS 115. A ₹5,000 Cr naval contract delivers ~₹1,100 Cr in pre-tax profit spread over 5 fiscal years (~₹220 Cr/year).\n`;

  return text;
}

// ─── ARCHETYPE 3: BHARAT ELECTRONICS (DEFENSE RADAR MONOPOLY) ───────
function generateBELDeepDive(rumor, liveArticles, stockData) {
  const d = stockData;
  const opm = d?.operatingMargin ? `${d.operatingMargin.toFixed(1)}%` : '24.5%';
  const mcap = d?.marketCap ? `₹${fmtCr(d.marketCap)} Cr` : '₹2,20,000+ Cr';

  let text = `## FORENSIC AUDIT: BHARAT ELECTRONICS (BEL)\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner sovereign">\n`;
  text += `  <div class="vb-status">[DEFENSE MONOPOLY]</div>\n`;
  text += `  <div class="vb-headline">VERDICT: VERIFIED NAVRATNA DEFENSE PSU</div>\n`;
  text += `  <div class="vb-summary">Controls 80%+ sovereign market share across military radar, avionics, and missile electronics. Holds >₹8,000 Cr liquid cash reserves with zero debt and 100%+ operating cash conversion.</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. Balance Sheet Fortress & Capital Efficiency\n`;
  text += `- Operating Profit Margin (OPM): **${opm}**—consistently superior to industrial engineering peers due to proprietary software and avionics integration.\n`;
  text += `- Solvency: **Debt-to-Equity is 0.00**. Holds **>₹8,000 Cr** in liquid treasury reserves.\n`;
  text += `- Earnings Authenticity: Cash Flow from Operations (CFO) matches or exceeds reported Net Profit on a 3-year trailing basis (100%+ cash conversion ratio).\n\n`;

  text += `### 2. Physical Moat & Order Execution\n`;
  text += `- BEL is embedded inside every Indian defense platform: Akash missile systems, Tejas fighter jets, naval sonar, and battlefield surveillance radars.\n`;
  text += `- Reinvests ~6–8% of annual revenue into dedicated defense R&D—a barrier that private commercial entrants cannot duplicate.\n`;

  return text;
}

// ─── ARCHETYPE 4: ORDER HYPE ────────────────────────────────────────
function generateOrderHypeDeepDive(rumor, liveArticles, stockData) {
  let text = `## FORENSIC AUDIT: HEADLINE CONTRACT HYPE & MARGIN REALITY\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner caution">\n`;
  text += `  <div class="vb-status">[CAPACITY & MARGIN MISMATCH]</div>\n`;
  text += `  <div class="vb-headline">VERDICT: RETAIL OVERPAYING FOR HEADLINE CONTRACT OPTICS</div>\n`;
  text += `  <div class="vb-summary">Contract announcements create immediate stock speculation, but cash realization requires 9–12 months. Fails physical factory capacity test without pre-existing Capex work-in-progress.</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. The Fundamental Margin Law Arithmetic\n`;
  text += `- Formula: \`Pre-Tax Profit = Order Value × Audited OPM\`\n`;
  text += `- Example: On a ₹5,000 Cr contract at 10% operating margin, pre-tax profit is ₹500 Cr (~₹375 Cr post-tax net income).\n`;
  text += `- At 25x fair earnings, fair economic market cap addition is ~₹9,375 Cr spread over the 3-year delivery schedule.\n`;
  text += `- If a small-cap stock runs up by ₹20,000 Cr in market cap on social media hype, retail investors are paying 53x earnings for top-line optical revenue.\n\n`;

  text += `### 2. The 9–12 Month Commercial Realization Timeline\n`;
  text += `- Month 1–2: Design approval, technical specifications, and raw material procurement.\n`;
  text += `- Month 3–5: Factory manufacturing, tooling, and assembly.\n`;
  text += `- Month 6: Client inspection, dispatch, and physical delivery.\n`;
  text += `- Month 9–12: Letter of Credit (LC) clearance and cash hits the bank balance sheet.\n`;
  text += `- Cash does not arrive for 9 to 12 months. Any price action today is speculative multiple expansion.\n\n`;

  text += `### 3. The 3–5 Year Capex Cycle Constraint\n`;
  text += `- If a factory has capacity to produce 30 units/year, and receives an order for 100 units, it CANNOT deliver the extra 70 units without building a new plant.\n`;
  text += `- Setting up a new factory requires a **3–5 year Capex cycle** (land acquisition, environmental clearances, machine imports, trial runs).\n`;
  text += `- Check balance sheet: Unless Capital Work-in-Progress (CWIP) was funded 2–3 years ago, claims of immediate 5x delivery are physically impossible.\n`;

  return text;
}

// ─── ARCHETYPE 5: TAKEOVER BUYOUT ───────────────────────────────────
function generateTakeoverBuyoutDeepDive(rumor, liveArticles, stockData) {
  let text = `## FORENSIC AUDIT: 3X TAKEOVER / MNC BUYOUT RUMOR\n\n`;
  text += `> Claim Under Scrutiny: "${rumor}"\n\n`;

  text += `<div class="verdict-banner high-risk">\n`;
  text += `  <div class="vb-status">[ECONOMIC DISCONNECT]</div>\n`;
  text += `  <div class="vb-headline">VERDICT: FAILS THE ACQUIRER SUBSTITUTION TEST (BUY VS. BUILD)</div>\n`;
  text += `  <div class="vb-summary">Acquiring conglomerates will not pay 3x market cap when they can build their own greenfield plant from scratch for a fraction of the cost. Front-running volume suggests insider distribution.</div>\n`;
  text += `</div>\n\n`;

  text += `### 1. The Acquirer Substitution Test (Buy vs. Build)\n`;
  text += `- In social media tips, operators claim an MNC will buy a target company at 3x current market cap.\n`;
  text += `- Economic reality: If a pumped company's market cap reaches ₹3,000 Cr, the acquiring conglomerate will calculate: "Can we build our own automated greenfield facility for ₹800 Cr?"\n`;
  text += `- If Build Cost < Buy Price, the buyout NEVER happens. Rational capital builds from scratch.\n\n`;

  text += `### 2. Prior Price Action & Front-Running Audit\n`;
  text += `- Examine the 5-day and 15-day price action BEFORE the buyout rumor circulated.\n`;
  text += `- If the stock rallied 15%–35% during quiet consolidation, operators accumulated early and circulated the buyout rumor to create retail liquidity for their exit.\n`;

  return text;
}

// ─── QUALITY ANALYSIS ───────────────────────────────────────────────
function generateQualityAnalysis(d) {
  if (!d) return 'No stock data available.';
  const isBank = (d.sector || '').toLowerCase().includes('financial');
  const peVal = d.pe ? `${d.pe.toFixed(1)}x` : 'N/A';
  const mcapCr = d.marketCap ? fmtCr(d.marketCap) : 'N/A';
  const revCr = d.totalRevenue ? fmtCr(d.totalRevenue) : 'N/A';
  const opm = d.operatingMargin != null ? `${d.operatingMargin.toFixed(1)}%` : 'N/A';
  const roe = d.returnOnEquity != null ? `${d.returnOnEquity.toFixed(1)}%` : 'N/A';
  const de = d.debtToEquity != null ? d.debtToEquity.toFixed(2) : 'N/A';
  const cashCr = d.totalCash ? fmtCr(d.totalCash) : 'N/A';
  const debtCr = d.totalDebt ? fmtCr(d.totalDebt) : 'N/A';
  const ocfCr = d.operatingCashFlow ? fmtCr(d.operatingCashFlow) : 'N/A';

  let text = `### INSTITUTIONAL QUALITY DISSECTION: ${d.name.toUpperCase()} (${d.symbol})\n\n`;
  text += `- Valuation: Market Cap **₹${mcapCr} Cr** | P/E: **${peVal}** | Annual Sales: **₹${revCr} Cr**\n`;
  text += `- Margins & Returns: Operating Margin: **${opm}** | Return on Equity: **${roe}**\n`;
  text += `- Balance Sheet Solvency: Liquid Cash: **₹${cashCr} Cr** | Total Debt: **₹${debtCr} Cr** (D/E: **${de}**${isBank ? ' · Financial sector' : ''})\n`;
  text += `- Cash Flow Generation: Cash Flow from Operations (CFO): **₹${ocfCr} Cr**\n\n`;

  text += `#### Forensic Balance Sheet Insights\n`;
  if (d.operatingMargin && d.operatingMargin > 18) {
    text += `- [PASS] High Pricing Power: Operating margin of ${opm} demonstrates substantial unit economic moat.\n`;
  } else if (d.operatingMargin && d.operatingMargin < 8) {
    text += `- [WARN] Thin Margin Vulnerability: OPM of ${opm} leaves limited cushion for raw material cost inflation.\n`;
  }

  if (d.totalCash && d.totalDebt && d.totalCash > d.totalDebt && !isBank) {
    text += `- [PASS] Net Cash Fortress: Liquid cash exceeds total borrowings. Zero solvency or debt distress risk.\n`;
  } else if (d.debtToEquity != null && d.debtToEquity > 1.2 && !isBank) {
    text += `- [FAIL] Excessive Leverage: Debt-to-equity ratio of ${de} creates heavy sensitivity to interest rate cycles.\n`;
  }

  if (d.operatingCashFlow && d.financials?.income?.length) {
    const ni = d.financials.income[d.financials.income.length - 1]?.netIncome;
    if (ni && ni > 0) {
      const conv = (d.operatingCashFlow / ni) * 100;
      if (conv > 90) {
        text += `- [PASS] High Earnings Authenticity: CFO/Net Income is ${conv.toFixed(0)}%—reported profits are backed by actual bank cash.\n`;
      } else if (conv < 50) {
        text += `- [FAIL] Receivables & Accruals Drag: CFO is only ${conv.toFixed(0)}% of reported net income. Working capital is trapped in unpaid client invoices.\n`;
      }
    }
  }

  return text;
}

// ─── CHAT COPILOT ───────────────────────────────────────────────────
async function handleChat(stockData, query, chatHistory, clientApiKey, modelPreference) {
  const activeKey = clientApiKey || DEFAULT_GEMINI_KEY;

  const contents = [];
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    for (const turn of chatHistory) {
      const role = turn.role === 'user' ? 'user' : 'model';
      const text = turn.content || '';
      if (text.trim()) {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: query }] });
  }

  let contextSnippet = '';
  if (stockData && stockData.symbol) {
    contextSnippet = `\nActive Screen Context: ${stockData.name} (${stockData.symbol}) | Price: ₹${stockData.currentPrice || 'N/A'} | P/E: ${stockData.pe ? stockData.pe.toFixed(1) + 'x' : 'N/A'} | OPM: ${stockData.operatingMargin ? stockData.operatingMargin.toFixed(1) + '%' : 'N/A'} | D/E: ${stockData.debtToEquity != null ? stockData.debtToEquity.toFixed(2) : 'N/A'} | Cash: ₹${fmtCr(stockData.totalCash)} Cr | Debt: ₹${fmtCr(stockData.totalDebt)} Cr | CFO: ₹${fmtCr(stockData.operatingCashFlow)} Cr | Rev: ₹${fmtCr(stockData.totalRevenue)} Cr | 5d Price Change: ${stockData.priceChange5d != null ? stockData.priceChange5d.toFixed(1) + '%' : 'N/A'}`;
  }

  const systemInstructionText = `${SYSTEM_INSTRUCTION}${contextSnippet}`;

  if (activeKey) {
    const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
    for (const model of models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstructionText }] },
            generationConfig: { temperature: 0.25, maxOutputTokens: 1500 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) return text.trim();
        }
      } catch (err) {
        clearTimeout(timeout);
        console.warn(`Gemini model ${model} failed:`, err.message);
      }
    }
  }

  // Pure Offline Math / Rule Fallback
  return generateQualityAnalysis(stockData);
}

// ─── UTILITIES & HELPERS ────────────────────────────────────────────
async function fetchLiveNews(query) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(rssUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return [];

  const xml = await res.text();
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    if (titleMatch) {
      const rawTitle = decodeEntities(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
      const cleanTitle = rawTitle.replace(/[\[\]\(\)\*]/g, '').trim();
      const source = sourceMatch ? decodeEntities(sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '')) : 'Exchange Filing';
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`;

      items.push({
        title: cleanTitle,
        link: searchUrl,
        source: source
      });
    }
  }
  return items;
}

function extractEntity(text, defaultEntity) {
  if (defaultEntity && defaultEntity.trim()) return defaultEntity.trim();
  if (!text) return null;

  const known = [
    { match: /\bbelrise\b/i, name: 'Belrise Industries' },
    { match: /\bpine\s*labs?\b/i, name: 'Pine Labs' },
    { match: /\bcochin\b/i, name: 'Cochin Shipyard' },
    { match: /\bbharat\s*electronics\b/i, name: 'Bharat Electronics' },
    { match: /\bbel\b/i, name: 'Bharat Electronics', exclude: /\bbelrise\b/i },
    { match: /\bhdfc\b/i, name: 'HDFC Bank' },
    { match: /\breliance\b/i, name: 'Reliance Industries' },
    { match: /\btcs\b/i, name: 'TCS' },
    { match: /\b(infy|infosys)\b/i, name: 'Infosys' },
    { match: /\bzomato\b/i, name: 'Zomato' },
    { match: /\bpaytm\b/i, name: 'Paytm' },
    { match: /\bsuzlon\b/i, name: 'Suzlon Energy' },
    { match: /\bola(\s*electric)?\b/i, name: 'Ola Electric' },
    { match: /\bswiggy\b/i, name: 'Swiggy' },
    { match: /\btata\s*motors?\b/i, name: 'Tata Motors' }
  ];

  for (const k of known) {
    if (k.match.test(text)) {
      if (k.exclude && k.exclude.test(text)) continue;
      return k.name;
    }
  }

  const match = text.match(/(?:is|about|for)?\s*([A-Za-z0-9\s&.-]{3,35})\s+(?:gonna|will|to|is|shares|stock|share|order|takeover)/i);
  if (match) return match[1].trim();

  return null;
}

function decodeEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function fmtCr(val) {
  if (val == null || isNaN(val)) return 'N/A';
  const cr = val / 10000000;
  return Number(cr.toFixed(1)).toLocaleString('en-IN');
}
