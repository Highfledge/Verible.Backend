const DEFAULT_BASE_URL = 'https://api.firecrawl.dev/v2/scrape';

function getApiKey() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }

  return apiKey;
}

export async function scrapeWithFirecrawl(url) {
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      maxAge: 172800000,
      parsers: ['pdf'],
      formats: ['markdown']
    })
  };

  const response = await fetch(process.env.FIRECRAWL_API_URL || DEFAULT_BASE_URL, options);

  if (!response.ok) {
    throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.success && data.data) {
    return {
      markdown: data.data.markdown || '',
      html: data.data.html || '',
      metadata: data.data.metadata || {}
    };
  }

  throw new Error('Firecrawl API returned unsuccessful response');
}

