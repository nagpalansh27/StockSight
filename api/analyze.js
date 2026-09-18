// api/analyze.js — Multi-Tier AI Analysis Engine
// Tier 1: Local Ollama Qwen 27B (if running & requested/detected)
// Tier 2: Google Gemini API (gemini-2.0-flash with user or env key)
// Tier 3: Algorithmic Deep Synthesis based on Rohit's 12-point framework

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { stockData, mode, query, chatHistory, apiKey: clientApiKey, modelPreference } = req.body;

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    // Build prompts
    let systemPrompt = SYSTEM_PROMPT;
    let userPrompt = '';

    if (mode === 'quality') {
      userPrompt = buildQualityPrompt(stockData);
    } else if (mode === 'rumor') {
      userPrompt = buildRumorPrompt(stockData, query);
    } else if (mode === 'chat') {
      userPrompt = query;
      if (stockData) {
        systemPrompt += `\n\n--- CURRENT STOCK CONTEXT ---\n${buildStockContext(stockData)}`;
      }
    } else {
      return res.status(400).json({ error: 'Invalid mode. Use: quality, rumor, or chat' });
    }

    // Try Local Ollama if requested or preferred
    if (modelPreference === 'ollama' || (!apiKey && modelPreference !== 'gemini')) {
      try {
        const ollamaRes = await tryOllama(systemPrompt, userPrompt, mode, chatHistory);
        if (ollamaRes) {
          return res.json({ analysis: ollamaRes, provider: 'ollama-qwen' });
        }
      } catch (ollamaErr) {
        console.warn('Ollama unavailable:', ollamaErr.message);
      }
    }

    // Try Gemini API if key exists
    if (apiKey) {
      try {
        const geminiText = await callGemini(apiKey, systemPrompt, userPrompt, mode, chatHistory);
        if (geminiText) {
          return res.json({ analysis: geminiText, provider: 'gemini' });
        }
      } catch (geminiErr) {
        console.error('Gemini API error:', geminiErr.message);
      }
    }

    // Fallback: Rule-Based Algorithmic Synthesis (Rohit's Framework)
    const fallbackText = generateAlgorithmicAnalysis(stockData, mode, query);
    return res.json({
      analysis: fallbackText,
      provider: 'rule-engine',
      note: apiKey ? 'Generated via rule engine' : 'Tip: Add your Gemini API key in Settings (⚙️) for full generative LLM responses.'
    });

  } catch (err) {
    console.error('Analyze handler error:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
};

// ─── Gemini Caller ──────────────────────────────────────────────────
async function callGemini(apiKey, systemPrompt, userPrompt, mode, chatHistory) {
  const messages = [];

  if (mode === 'chat' && chatHistory && chatHistory.length > 0) {
    messages.push({ role: 'user', parts: [{ text: systemPrompt }] });
    messages.push({ role: 'model', parts: [{ text: 'Understood. I will strictly follow Rohit\'s fact-based numbers-first framework.' }] });
    for (const msg of chatHistory.slice(-8)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    messages.push({ role: 'user', parts: [{ text: userPrompt }] });
  } else {
    messages.push({ role: 'user', parts: [{ text: systemPrompt + '\n\n---\n\n' + userPrompt }] });
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 3000,
        topP: 0.85
      }
    })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${txt}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ─── Local Ollama Caller ────────────────────────────────────────────
async function tryOllama(systemPrompt, userPrompt, mode, chatHistory) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  const ollamaMessages = [{ role: 'system', content: systemPrompt }];
  if (mode === 'chat' && chatHistory?.length) {
    for (const m of chatHistory.slice(-6)) {
      ollamaMessages.push({ role: m.role, content: m.content });
    }
  }
  ollamaMessages.push({ role: 'user', content: userPrompt });

  try {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen3.8:27b-vram-speed',
        messages: ollamaMessages,
        temperature: 0.2,
        max_tokens: 2500
      })
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    clearTimeout(timeoutId);
    return null;
  }
}

// ─── Fallback Algorithmic Synthesis ─────────────────────────────────
function generateAlgorithmicAnalysis(d, mode, query) {
  if (mode === 'rumor') {
    return generateRumorFallback(d, query);
  }
  if (mode === 'chat') {
    return generateChatFallback(d, query);
  }
  return generateQualityFallback(d);
}

function generateQualityFallback(d) {
  if (!d) return 'No stock data provided for analysis.';

  const isBank = (d.sector || '').toLowerCase().includes('financial');
  const peVal = d.pe ? `${d.pe.toFixed(1)}x` : 'N/A';
  const mcapCr = d.marketCap ? fmtCr(d.marketCap) : 'N/A';
  const revCr = d.totalRevenue ? fmtCr(d.totalRevenue) : 'N/A';
  const opm = d.operatingMargin != null ? `${d.operatingMargin.toFixed(1)}%` : 'N/A';
  const roe = d.returnOnEquity != null ? `${d.returnOnEquity.toFixed(1)}%` : 'N/A';
  const de = d.debtToEquity != null ? d.debtToEquity.toFixed(2) : 'N/A';
  const mcr = d.marketCapToRevenue != null ? `${d.marketCapToRevenue.toFixed(1)}x` : 'N/A';

  // Compute key observations
  const redFlags = [];
  const greenFlags = [];

  if (d.revenueCAGR != null) {
    if (d.revenueCAGR > 12) greenFlags.push(`Consistent multi-year top-line expansion (CAGR ${d.revenueCAGR.toFixed(1)}%)`);
    else if (d.revenueCAGR < 0) redFlags.push(`Revenue contraction: CAGR is negative (${d.revenueCAGR.toFixed(1)}%)`);
  }
  if (d.operatingMargin != null) {
    if (d.operatingMargin > 15) greenFlags.push(`Healthy operating profit margin of ${opm}`);
    else if (d.operatingMargin < 5) redFlags.push(`Razor-thin margins (${opm}) — low pricing power`);
  }
  if (d.debtToEquity != null && !isBank) {
    if (d.debtToEquity < 0.5) greenFlags.push(`Conservatively leveraged balance sheet (D/E ${de})`);
    else if (d.debtToEquity > 1.2) redFlags.push(`High debt exposure with D/E of ${de}`);
  }
  if (d.marketCapToRevenue != null && d.marketCapToRevenue > 10 && !isBank) {
    redFlags.push(`Stretched valuation: trading at ${mcr} annual sales`);
  }

  let text = `### 📊 Rohit's Framework Dissection: **${d.name}** (${d.symbol})\n\n`;
  text += `> *"Trust numbers, not narratives. If a company claims massive growth, it must show up in quarterly balance sheets and operating cash flows."*\n\n`;

  text += `#### 1. Fundamental Baseline\n`;
  text += `- **Market Cap**: ₹${mcapCr} on annual revenue of ₹${revCr} (**${mcr} sales multiple**).\n`;
  text += `- **Earnings Multiple**: Trailing P/E is **${peVal}**.\n`;
  text += `- **Operating Margin (OPM)**: **${opm}**.\n`;
  text += `- **Return on Equity (ROE)**: **${roe}**.\n`;
  text += `- **Balance Sheet Leverage (D/E)**: **${de}**${isBank ? ' *(Financial institution context applied)*' : ''}.\n\n`;

  text += `#### 2. Key Flags Identified\n`;
  if (greenFlags.length) {
    text += `**🟢 Solid Ground:**\n`;
    greenFlags.forEach(f => { text += `- ${f}\n`; });
  }
  if (redFlags.length) {
    text += `\n**🔴 Caution Points / Red Flags:**\n`;
    redFlags.forEach(f => { text += `- ${f}\n`; });
  }
  if (!redFlags.length) {
    text += `- No glaring operational red flags detected in published filings.\n`;
  }

  text += `\n#### 3. Rohit's Reality Check\n`;
  if (d.marketCapToRevenue && d.marketCapToRevenue > 8 && !isBank) {
    text += `At **${mcr}** price-to-sales, this company has already priced in aggressive multi-year perfection. Any slowdown in orders, execution delay, or margin compression could cause sharp multiple contraction. Amateurs chase price momentum; smart capital waits for valuation sanity.\n`;
  } else if (d.operatingMargin && d.operatingMargin > 15 && (d.debtToEquity == null || d.debtToEquity < 0.6 || isBank)) {
    text += `The business demonstrates genuine operating efficiency with **${opm} OPM** and controlled debt. Rather than trading on daily news buzz, watch the next 1-2 quarterly filings for consistent cash conversion from operations.\n`;
  } else {
    text += `Mixed fundamentals. The numbers do not justify blind retail euphoria. Verify working capital cycle and cash flow conversion before committing long-term capital.\n`;
  }

  return text;
}

function generateRumorFallback(d, rumor) {
  let text = `### 🔍 Rumor Buster Investigation\n\n`;
  text += `**Claim Under Review:** *"${rumor}"*\n\n`;
  text += `---\n\n`;

  if (d) {
    const rev = d.totalRevenue ? d.totalRevenue / 1e7 : null;
    const mcap = d.marketCap ? d.marketCap / 1e7 : null;
    const opm = d.operatingMargin != null ? d.operatingMargin : 10;

    text += `#### 1. Hard Numbers Check: **${d.name}**\n`;
    text += `- Current Annual Revenue: **₹${rev ? rev.toFixed(1) + ' Cr' : 'N/A'}**\n`;
    text += `- Current Market Capitalization: **₹${mcap ? mcap.toFixed(1) + ' Cr' : 'N/A'}**\n`;
    text += `- Operating Profit Margin (OPM): **${opm.toFixed(1)}%**\n\n`;

    text += `#### 2. The Arithmetic Test (Rohit's Law)\n`;
    text += `Retail investors consistently confuse headline top-line numbers with bottom-line profit:\n`;
    text += `- If an order is claimed, remember the math: \`Order Value × OPM (${opm.toFixed(1)}%) = Pre-Tax Profit\`.\n`;
    text += `- A ₹100 Cr order at ${opm.toFixed(1)}% margin generates only **₹${(100 * opm / 100).toFixed(1)} Cr** in pre-tax profit.\n`;
    text += `- If the stock rallies by ₹500 Cr in market cap on a ₹100 Cr order headline, retail is paying 50x the entire order value for a one-time transaction!\n\n`;

    text += `#### 3. Capacity & Capex Reality\n`;
    text += `Industrial and commercial businesses cannot magically scale production overnight. Capacity expansion requires 2–4 year Capex cycles. Any sudden claim of exponential output without prior quarterly disclosures of plant expansion is physically impossible.\n\n`;

    text += `#### 4. Disclose vs. Tip\n`;
    text += `- If a material event is real, SEBI rules mandate formal stock exchange filings (BSE/NSE disclosures).\n`;
    text += `- If it only exists on WhatsApp groups, Telegram channels, or "insider sources," it is almost universally designed to create **exit liquidity** for early operators.\n\n`;

    text += `**Verdict:** 🔴 **QUESTIONABLE / HIGH PROBABILITY OF PUMP**\n`;
    text += `Demand audited exchange disclosures. Never deploy capital based on unverified order or takeover hype.`;
  } else {
    text += `#### 1. The Anomaly Detection Principle\n`;
    text += `- **Who benefits?** When tips circulate in private groups, the originators have already accumulated at low levels and need retail buyers to buy their shares at peak prices.\n`;
    text += `- **Verify on official exchanges**: Check BSE/NSE corporate announcements for official disclosures under Regulation 30.\n`;
    text += `- **Look at volume**: Did volume surge 3–5 days *before* the rumor spread? If yes, smart money is preparing to dump.\n\n`;
    text += `**Verdict:** 🔴 **UNVERIFIED NARRATIVE — DO NOT ACT WITHOUT DATA**`;
  }

  return text;
}

function generateChatFallback(d, query) {
  let text = `### Fact-Based Perspective\n\n`;
  text += `Analyzing query: *"${query}"*\n\n`;

  if (d) {
    text += `**Context: ${d.name} (${d.symbol})**\n`;
    text += `- Price: ₹${fmt(d.currentPrice)} | P/E: ${fmt(d.pe)}x | Market Cap: ₹${fmtCr(d.marketCap)}\n`;
    text += `- Revenue: ₹${fmtCr(d.totalRevenue)} | OPM: ${fmt(d.operatingMargin)}% | ROE: ${fmt(d.returnOnEquity)}%\n\n`;
  }

  text += `**Rohit's Core Decision Rules:**\n`;
  text += `1. **Never buy a story without checking the balance sheet** — If revenue isn't growing or operating cash flow is negative, the narrative is meaningless.\n`;
  text += `2. **Avoid high debt during uncertain cycles** — Companies with D/E > 1.0 bleed cash when interest rates rise or demand cools.\n`;
  text += `3. **Price is what you pay, value is what you get** — Paying 15x sales for a slow-growth legacy asset guarantees poor long-term returns.\n\n`;
  text += `*Have a specific rumor, order announcement, or financial metric you want to dissect? Paste it here.*`;

  return text;
}

// ─── System Prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are StockSight AI — a ruthlessly honest, fact-only stock analyst for the Indian (and global) stock market, strictly applying Rohit's investment methodology.

## YOUR CORE RULES
1. **TRUST NUMBERS, NOT NARRATIVES** — Every statement must be anchored in audited numbers and empirical facts.
2. **BE SKEPTICAL BY DEFAULT** — The market is filled with pump schemes, fake tips, and retail traps. Your job is to protect capital.
3. **ACTIVELY DISPROVE** — When given a rumor or bull case, your primary job is to find the mathematical or physical reasons why it won't work.
4. **SHOW THE ARITHMETIC** — Always calculate OPM: Order Value × Operating Margin = Pre-Tax Profit. Contrast that with market cap changes.
5. **NEVER SPECULATE** — If data is missing, explicitly state "Insufficient data to verify."
6. **NO BUY/SELL ADVICE** — Present facts, ratios, and balance sheet realities; let the investor decide.

## ROHIT'S 12-POINT QUALITY CHECKLIST
1. Revenue Reality: Multi-year CAGR & YoY trajectory.
2. Profit Quality: Stable or expanding Operating Profit Margins (OPM).
3. Cash Flow Check: Operating cash flow must back reported net income.
4. Valuation Sanity: Market Cap ÷ Annual Sales. High multiples (>8x) demand proof of extreme growth.
5. Debt Load: Debt-to-Equity (D/E). Watch for overleveraged balance sheets.
6. Promoter Holding: Aligned incentives vs. promoter dumping.
7. Promoter Pledge: Pledged shares signify hidden leverage and liquidation risk.
8. ROE Quality: Return on Equity above 15% indicates capital efficiency.
9. Auditor Trust: Frequent auditor resignations are an immediate red flag.
10. Narrative Drift: Companies pivoting business models to hot trends (ethanol, EV, AI).
11. Volume Sanity: Spikes without news point to operator manipulation.
12. Insider Activity: Watch who is actually buying and selling in block/bulk deals.

Format with clean markdown, bolding key numbers, and using 🟢, 🟡, 🔴 indicators.`;

function buildStockContext(d) {
  if (!d) return 'No stock data available.';
  let ctx = `Company: ${d.name} (${d.symbol})
Sector: ${d.sector || 'N/A'} | Industry: ${d.industry || 'N/A'}
Current Price: ₹${fmt(d.currentPrice)} | Market Cap: ₹${fmtCr(d.marketCap)}
52W Range: ₹${fmt(d.fiftyTwoWeekLow)} – ₹${fmt(d.fiftyTwoWeekHigh)}

KEY RATIOS:
P/E: ${fmt(d.pe)} | Forward P/E: ${fmt(d.forwardPE)} | P/B: ${fmt(d.pb)}
Debt/Equity: ${fmt(d.debtToEquity)} | Current Ratio: ${fmt(d.currentRatio)}
ROE: ${fmt(d.returnOnEquity)}% | Operating Margin (OPM): ${fmt(d.operatingMargin)}%
Revenue Growth (YoY): ${fmt(d.revenueGrowth)}% | Revenue CAGR: ${fmt(d.revenueCAGR)}%
Market Cap / Revenue: ${fmt(d.marketCapToRevenue)}x

TOTALS:
Annual Revenue: ₹${fmtCr(d.totalRevenue)}
Operating Cash Flow: ₹${fmtCr(d.operatingCashFlow)}
Free Cash Flow: ₹${fmtCr(d.freeCashFlow)}
Total Debt: ₹${fmtCr(d.totalDebt)} | Total Cash: ₹${fmtCr(d.totalCash)}
Insider Holding: ${fmt(d.insiderHolding)}%
`;

  if (d.financials?.income?.length) {
    ctx += '\nANNUAL INCOME HISTORY:\n';
    d.financials.income.forEach(y => {
      ctx += `  ${y.date}: Revenue ₹${fmtCr(y.revenue)} | Op Income ₹${fmtCr(y.operatingIncome)} | Net Income ₹${fmtCr(y.netIncome)}\n`;
    });
  }

  if (d.volumeSpike != null) {
    ctx += `\nVolume Spike Ratio: ${d.volumeSpike.toFixed(2)}x\n`;
  }

  return ctx;
}

function buildQualityPrompt(d) {
  return `Analyze this stock using Rohit's 12-Point Quality Framework. Go through each check with exact numbers, evaluate flags (🟢 PASS, 🟡 CAUTION, 🔴 FAIL), and provide a brutally honest summary.

${buildStockContext(d)}`;
}

function buildRumorPrompt(d, rumor) {
  return `A retail investor heard this rumor/claim:
"${rumor}"

Actively try to DISPROVE this claim using the company's financial realities, physical capacity constraints, and basic margin arithmetic.

${d ? buildStockContext(d) : 'Analyze the logical and market mechanics of the claim.'}`;
}

function fmt(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return typeof val === 'number' ? Number(val.toFixed(2)).toLocaleString('en-IN') : String(val);
}

function fmtCr(val) {
  if (val == null || isNaN(val)) return 'N/A';
  const cr = val / 10000000;
  if (Math.abs(cr) >= 1) return cr.toFixed(1) + ' Cr';
  const lakh = val / 100000;
  if (Math.abs(lakh) >= 1) return lakh.toFixed(1) + ' L';
  return fmt(val);
}
