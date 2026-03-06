/**
 * WebExtractor - Fetches web content and extracts readable article text.
 *
 * Uses Mozilla's Readability algorithm to extract the main content from web pages,
 * removing ads, navigation, sidebars, and other clutter.
 */

// Simple HTML entity decoder
function decodeHtmlEntities(html: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '--',
    '&ndash;': '–',
    '&hellip;': '…',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
  };
  let result = html;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  // Decode numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

// Strip HTML tags and convert to plain text
function htmlToText(html: string): string {
  // Replace block elements with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ');

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// Simple readability-style content extractor
function extractMainContent(html: string, url: string): { title: string; content: string } {
  // Extract title
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = decodeHtmlEntities(titleMatch[1].trim());
    // Remove common suffixes
    title = title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
  }

  // Try to find article content using common patterns
  let contentHtml = '';

  // Look for article, main, or content divs
  const articlePatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of articlePatterns) {
    const matches = html.match(pattern);
    if (matches) {
      // Find the longest match (likely the main content)
      let longest = '';
      for (const match of matches) {
        if (match.length > longest.length) {
          longest = match;
        }
      }
      if (longest.length > 200) {
        contentHtml = longest;
        break;
      }
    }
  }

  // Fallback: get all paragraph content
  if (!contentHtml || contentHtml.length < 200) {
    const pMatches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
    if (pMatches) {
      contentHtml = pMatches.join('\n\n');
    }
  }

  // Convert to plain text
  let content = htmlToText(contentHtml);

  // If still no content, try extracting all body text
  if (content.length < 100) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = htmlToText(bodyMatch[1]);
    }
  }

  return { title: title || 'Web Article', content };
}

export interface WebExtractionResult {
  title: string;
  content: string;
  url: string;
}

/**
 * Fetches a URL and extracts the main article content.
 */
export async function extractWebContent(url: string): Promise<WebExtractionResult> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('URL must start with http:// or https://');
  }

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('URL does not point to a web page');
  }

  const html = await response.text();

  // Extract content
  const { title, content } = extractMainContent(html, url);

  if (!content || content.length < 50) {
    throw new Error('Could not extract readable content from this page');
  }

  return {
    title,
    content,
    url,
  };
}
