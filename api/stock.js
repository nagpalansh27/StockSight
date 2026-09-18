// api/stock.js — Direct Native Yahoo Finance Fetcher (Zero external deps, fast & reliable)

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let cachedCookie = null;
let cachedCrumb = null;
let crumbExpiry = 0;

async function getCrumbAndCookie() {
  const now = Date.now();
  if (cachedCookie && cachedCrumb && now < crumbExpiry) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  try {
    const res1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': USER_AGENT }
    });
    const cookie = res1.headers.get('set-cookie');
    if (!cookie) throw new Error('No cookie received from Yahoo');

    const res2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie }
    });
    const crumb = await res2.text();
    if (!crumb || crumb.includes('Too Many') || crumb.includes('error')) {
      throw new Error('Invalid crumb: ' + crumb);
    }

    cachedCookie = cookie;
    cachedCrumb = crumb;
    crumbExpiry = now + 1000 * 60 * 30; // 30 mins cache
    return { cookie, crumb };
  } catch (err) {
    console.error('Error fetching Yahoo crumb:', err.message);
    throw err;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, symbol } = req.query;

  try {
    if (action === 'search') {
      return await handleSearch(q, res);
    }
    if (action === 'quote') {
      return await handleQuote(symbol, res);
    }
    return res.status(400).json({ error: 'Invalid action. Use ?action=search&q=... or ?action=quote&symbol=...' });
  } catch (err) {
    console.error('Stock API error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch stock data' });
  }
};

// ─── Search ──────────────────────────────────────────────────────────
async function handleSearch(query, res) {
  if (!query || query.length < 1) return res.json({ quotes: [] });

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);

  const data = await response.json();
  const quotes = (data.quotes || [])
    .filter(q => ['NSI', 'NSE', 'BSE', 'BOM', 'NMS', 'NYQ', 'NGM', 'PCX'].includes(q.exchange))
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange,
      type: q.quoteType
    }));

  return res.json({ quotes });
}

// ─── Full Quote ──────────────────────────────────────────────────────
async function handleQuote(symbol, res) {
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  let ticker = symbol.toUpperCase().trim();
  if (!ticker.includes('.') && !ticker.includes(':')) {
    ticker = ticker + '.NS';
  }

  const { cookie, crumb } = await getCrumbAndCookie();

  const modules = [
    'financialData',
    'defaultKeyStatistics',
    'assetProfile',
    'summaryDetail',
    'price',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'majorHoldersBreakdown'
  ].join(',');

  let summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?crumb=${encodeURIComponent(crumb)}&modules=${modules}`;
  let summaryRes = await fetch(summaryUrl, {
    headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie }
  });

  // Retry without .NS suffix if not found
  if (!summaryRes.ok && ticker.endsWith('.NS')) {
    ticker = ticker.replace('.NS', '');
    summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?crumb=${encodeURIComponent(crumb)}&modules=${modules}`;
    summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie }
    });
  }

  if (!summaryRes.ok) {
    throw new Error(`Failed to fetch stock summary: HTTP ${summaryRes.status}`);
  }

  const summaryData = await summaryRes.json();
  const s = summaryData.quoteSummary?.result?.[0];
  if (!s) throw new Error('Stock data not found');

  // Chart data (5-year monthly + 3-month daily)
  let chart5y = null;
  let chart3m = null;

  try {
    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=5y`;
    const chartRes = await fetch(chartUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (chartRes.ok) chart5y = await chartRes.json();
  } catch (e) {
    console.warn('Chart 5y fetch failed:', e.message);
  }

  try {
    const chart3mUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
    const chart3mRes = await fetch(chart3mUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (chart3mRes.ok) chart3m = await chart3mRes.json();
  } catch (e) {
    console.warn('Chart 3m fetch failed:', e.message);
  }

  const processed = processStockData(s, chart5y, chart3m, ticker);
  return res.json(processed);
}

function raw(val) {
  if (val == null) return null;
  if (typeof val === 'object' && 'raw' in val) return val.raw;
  return typeof val === 'number' ? val : null;
}

function str(val) {
  if (val == null) return '';
  if (typeof val === 'object' && 'fmt' in val) return val.fmt;
  return String(val);
}

function processStockData(s, chart5y, chart3m, ticker) {
  const fd = s.financialData || {};
  const dk = s.defaultKeyStatistics || {};
  const ap = s.assetProfile || {};
  const pr = s.price || {};
  const sd = s.summaryDetail || {};
  const mh = s.majorHoldersBreakdown || {};

  // ── Income Statements (annual) ──
  const incomeStatements = (s.incomeStatementHistory?.incomeStatementHistory || []).map(is => ({
    date: is.endDate ? (typeof is.endDate === 'object' ? is.endDate.fmt : is.endDate) : null,
    revenue: raw(is.totalRevenue),
    grossProfit: raw(is.grossProfit),
    operatingIncome: raw(is.operatingIncome),
    netIncome: raw(is.netIncome),
    ebitda: raw(is.ebitda)
  })).reverse();

  // ── Balance Sheets ──
  const balanceSheets = (s.balanceSheetHistory?.balanceSheetStatements || []).map(bs => {
    const ltDebt = raw(bs.longTermDebt) || 0;
    const stDebt = raw(bs.shortLongTermDebt) || 0;
    const cash = raw(bs.cash) || 0;
    const totalDebt = (ltDebt + stDebt) > 0 ? (ltDebt + stDebt) : (raw(bs.totalDebt) || 0);
    return {
      date: bs.endDate ? (typeof bs.endDate === 'object' ? bs.endDate.fmt : bs.endDate) : null,
      totalAssets: raw(bs.totalAssets),
      totalDebt,
      totalEquity: raw(bs.totalStockholderEquity),
      cash,
      netCash: cash - totalDebt
    };
  }).reverse();

  // ── Cash Flow Statements ──
  const cashFlows = (s.cashflowStatementHistory?.cashflowStatements || []).map(cf => ({
    date: cf.endDate ? (typeof cf.endDate === 'object' ? cf.endDate.fmt : cf.endDate) : null,
    operatingCashFlow: raw(cf.totalCashFromOperatingActivities),
    investingCashFlow: raw(cf.totalCashflowsFromInvestingActivities),
    financingCashFlow: raw(cf.totalCashFromFinancingActivities),
    capitalExpenditure: raw(cf.capitalExpenditures),
    freeCashFlow: raw(cf.freeCashFlow)
  })).reverse();

  // ── Price History (5 years monthly) ──
  const priceHistory = [];
  const chartRes = chart5y?.chart?.result?.[0];
  if (chartRes?.timestamp && chartRes?.indicators?.quote?.[0]?.close) {
    const timestamps = chartRes.timestamp;
    const closes = chartRes.indicators.quote[0].close;
    const volumes = chartRes.indicators.quote[0].volume || [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        priceHistory.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: closes[i],
          volume: volumes[i] || 0
        });
      }
    }
  }

  // ── Recent Volume (3 months daily) ──
  const recentVolume = [];
  const chart3mRes = chart3m?.chart?.result?.[0];
  if (chart3mRes?.timestamp && chart3mRes?.indicators?.quote?.[0]?.volume) {
    const ts = chart3mRes.timestamp;
    const vols = chart3mRes.indicators.quote[0].volume;
    const cls = chart3mRes.indicators.quote[0].close;
    for (let i = 0; i < ts.length; i++) {
      if (vols[i] != null) {
        recentVolume.push({
          date: new Date(ts[i] * 1000).toISOString().split('T')[0],
          volume: vols[i],
          close: cls[i]
        });
      }
    }
  }

  // ── Volume spike computation ──
  let avgVolume = 0;
  let volumeSpike = null;
  if (recentVolume.length > 10) {
    const allVols = recentVolume.map(v => v.volume).filter(Boolean);
    avgVolume = allVols.reduce((a, b) => a + b, 0) / allVols.length;
    const recent5 = allVols.slice(-5);
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    if (avgVolume > 0) volumeSpike = recentAvg / avgVolume;
  }

  // ── Prior Price Run-Up Computation (5d, 15d, 30d) ──
  let priceChange5d = null;
  let priceChange15d = null;
  let priceChange30d = null;

  if (recentVolume.length >= 6) {
    const cur = recentVolume[recentVolume.length - 1].close;
    const p5 = recentVolume[recentVolume.length - 6].close;
    if (cur && p5) priceChange5d = ((cur - p5) / p5) * 100;
  }
  if (recentVolume.length >= 16) {
    const cur = recentVolume[recentVolume.length - 1].close;
    const p15 = recentVolume[recentVolume.length - 16].close;
    if (cur && p15) priceChange15d = ((cur - p15) / p15) * 100;
  }
  if (recentVolume.length >= 31) {
    const cur = recentVolume[recentVolume.length - 1].close;
    const p30 = recentVolume[recentVolume.length - 31].close;
    if (cur && p30) priceChange30d = ((cur - p30) / p30) * 100;
  }

  // ── Revenue CAGR ──
  let revenueCAGR = null;
  if (incomeStatements.length >= 2) {
    const first = incomeStatements[0].revenue;
    const last = incomeStatements[incomeStatements.length - 1].revenue;
    const years = incomeStatements.length - 1;
    if (first > 0 && last > 0 && years > 0) {
      revenueCAGR = (Math.pow(last / first, 1 / years) - 1) * 100;
    }
  }

  // ── Operating Margins ──
  const operatingMargins = incomeStatements
    .filter(is => is.revenue && is.operatingIncome)
    .map(is => ({
      date: is.date,
      margin: (is.operatingIncome / is.revenue) * 100
    }));

  const curPrice = raw(fd.currentPrice) || raw(pr.regularMarketPrice);
  const shares = raw(dk.sharesOutstanding) || raw(dk.impliedSharesOutstanding);
  const mCap = raw(pr.marketCap) 
    || raw(sd.marketCap) 
    || (curPrice && shares ? curPrice * shares : null)
    || raw(dk.enterpriseValue);
  const totRev = raw(fd.totalRevenue);

  const insiderHeld = raw(mh.insidersPercentHeld);
  const instHeld = raw(mh.institutionsPercentHeld);

  const cleanTicker = ticker.replace('.NS', '').replace('.BO', '');
  const documents = {
    bseUrl: `https://www.bseindia.com/stock-share-price/${encodeURIComponent(cleanTicker)}/`,
    nseUrl: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(cleanTicker)}`,
    screenerUrl: `https://www.screener.in/company/${encodeURIComponent(cleanTicker)}/consolidated/`,
    annualReportSearch: `https://www.google.com/search?q=${encodeURIComponent(cleanTicker + ' Annual Report filetype:pdf')}`,
    investorPresentationSearch: `https://www.google.com/search?q=${encodeURIComponent(cleanTicker + ' Investor Presentation filetype:pdf')}`
  };

  return {
    name: pr.longName || pr.shortName || ticker,
    symbol: ticker,
    cleanTicker,
    exchange: pr.exchangeName || pr.exchange || '',
    currency: pr.currency || 'INR',
    sector: ap.sector || '',
    industry: ap.industry || '',
    description: ap.longBusinessSummary || '',
    website: ap.website || '',
    employees: raw(ap.fullTimeEmployees),
    shares,

    currentPrice: raw(fd.currentPrice) || raw(pr.regularMarketPrice),
    previousClose: raw(sd.previousClose) || raw(pr.regularMarketPreviousClose),
    dayHigh: raw(sd.dayHigh) || raw(pr.regularMarketDayHigh),
    dayLow: raw(sd.dayLow) || raw(pr.regularMarketDayLow),
    fiftyTwoWeekHigh: raw(sd.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: raw(sd.fiftyTwoWeekLow),
    marketCap: mCap,

    pe: raw(sd.trailingPE) || raw(dk.trailingPE),
    forwardPE: raw(sd.forwardPE) || raw(dk.forwardPE),
    pb: raw(dk.priceToBook),
    ps: raw(dk.priceToSalesTrailing12Months),
    evToEbitda: raw(dk.enterpriseToEbitda),
    evToRevenue: raw(dk.enterpriseToRevenue),
    pegRatio: raw(dk.pegRatio),
    dividendYield: raw(sd.dividendYield) != null ? raw(sd.dividendYield) * 100 : null,

    debtToEquity: raw(fd.debtToEquity) != null ? raw(fd.debtToEquity) / 100 : null,
    currentRatio: raw(fd.currentRatio),
    quickRatio: raw(fd.quickRatio),
    returnOnEquity: raw(fd.returnOnEquity) != null ? raw(fd.returnOnEquity) * 100 : null,
    returnOnAssets: raw(fd.returnOnAssets) != null ? raw(fd.returnOnAssets) * 100 : null,
    operatingMargin: raw(fd.operatingMargins) != null ? raw(fd.operatingMargins) * 100 : null,
    profitMargin: raw(fd.profitMargins) != null ? raw(fd.profitMargins) * 100 : null,
    grossMargin: raw(fd.grossMargins) != null ? raw(fd.grossMargins) * 100 : null,
    revenueGrowth: raw(fd.revenueGrowth) != null ? raw(fd.revenueGrowth) * 100 : null,
    earningsGrowth: raw(fd.earningsGrowth) != null ? raw(fd.earningsGrowth) * 100 : null,
    freeCashFlow: raw(fd.freeCashflow),
    operatingCashFlow: raw(fd.operatingCashflow),
    totalRevenue: totRev,
    totalDebt: raw(fd.totalDebt),
    totalCash: raw(fd.totalCash),

    revenueCAGR,
    operatingMargins,
    marketCapToRevenue: (mCap && totRev) ? mCap / totRev : null,

    insiderHolding: insiderHeld != null ? insiderHeld * 100 : null,
    institutionHolding: instHeld != null ? instHeld * 100 : null,

    avgVolume,
    volumeSpike,
    priceChange5d,
    priceChange15d,
    priceChange30d,

    financials: {
      income: incomeStatements,
      balanceSheet: balanceSheets,
      cashFlow: cashFlows
    },
    documents,
    priceHistory,
    recentVolume
  };
}
