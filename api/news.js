module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    // Use Google News RSS feed
    const query = encodeURIComponent(q + ' stock');
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockSight/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Google News returned ${response.status}`);
    }

    const xml = await response.text();
    const articles = parseRSS(xml);

    return res.json({ articles: articles.slice(0, 15) });
  } catch (err) {
    console.error('News API error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch news' });
  }
};

function parseRSS(xml) {
  const articles = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const pubDate = extractTag(item, 'pubDate');
    const source = extractTag(item, 'source');

    if (title) {
      articles.push({
        title: decodeHTMLEntities(title),
        link: link || '',
        date: pubDate ? new Date(pubDate).toISOString() : null,
        source: source ? decodeHTMLEntities(source) : 'Unknown',
        sentiment: analyzeSentiment(title)
      });
    }
  }

  return articles;
}

function extractTag(xml, tag) {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? m[1].trim() : null;
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]*>/g, ''); // Strip any remaining HTML tags
}

// Simple keyword-based sentiment for quick classification
function analyzeSentiment(title) {
  const lower = title.toLowerCase();

  const positiveWords = [
    'surge', 'soar', 'rally', 'jump', 'gain', 'rise', 'profit', 'growth',
    'bullish', 'upgrade', 'outperform', 'buy', 'record', 'high', 'boost',
    'strong', 'beat', 'positive', 'optimistic', 'recover', 'dividend',
    'approval', 'deal', 'partnership', 'expansion', 'breakout', 'multibagger'
  ];

  const negativeWords = [
    'crash', 'fall', 'drop', 'decline', 'loss', 'bearish', 'downgrade',
    'sell', 'plunge', 'slump', 'weak', 'miss', 'fraud', 'scam', 'probe',
    'investigation', 'penalty', 'fine', 'debt', 'default', 'concern',
    'warning', 'risk', 'tumble', 'correction', 'crisis', 'cut'
  ];

  let score = 0;
  for (const w of positiveWords) {
    if (lower.includes(w)) score++;
  }
  for (const w of negativeWords) {
    if (lower.includes(w)) score--;
  }

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}
