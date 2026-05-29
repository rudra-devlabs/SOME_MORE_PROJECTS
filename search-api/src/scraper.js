import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Extract lists (ul, ol, dl) with their items and nested sublists
 */
function extractLists($) {
  const lists = [];

  $('ul, ol, dl').each((_, el) => {
    const listEl = $(el);
    const listType = el.tagName.toLowerCase();

    // Find heading before the list (sibling or parent's sibling)
    let heading = null;
    const prevHeading = listEl.prev('h1, h2, h3, h4, h5, h6, p, span').first();
    if (prevHeading.length && prevHeading.is('h1, h2, h3, h4, h5, h6')) {
      heading = prevHeading.text().trim();
    } else if (prevHeading.length && prevHeading.is('p, span')) {
      const text = prevHeading.text().trim();
      if (text.length < 100 && text.length > 0) {
        heading = text;
      }
    }

    // Check parent for heading
    if (!heading) {
      const parentHeading = listEl.parent().prev('h1, h2, h3, h4, h5, h6').first();
      if (parentHeading.length) {
        heading = parentHeading.text().trim();
      }
    }

    const elements = [];

    if (listType === 'ul' || listType === 'ol') {
      // Extract li items
      listEl.children('li').each((_, li) => {
        const item = extractListItem($(li));
        elements.push(item);
      });
    } else if (listType === 'dl') {
      // Extract dt/dd pairs
      listEl.children('dt').each((_, dt) => {
        const term = $(dt).text().trim();
        const dd = $(dt).next('dd').first();
        const description = dd.length ? dd.text().trim() : null;
        elements.push({
          term,
          description
        });
      });
    }

    if (elements.length > 0) {
      lists.push({
        type: listType === 'ul' ? 'unordered' : listType === 'ol' ? 'ordered' : 'definition',
        heading,
        elements
      });
    }
  });

  return lists;
}

/**
 * Recursively extract a list item, handling nested lists
 */
function extractListItem($li) {
  const item = {
    text: null,
    nestedLists: []
  };

  // Clone to avoid modifying original
  const clone = $li.clone();

  // Find nested lists first
  clone.children('ul, ol, dl').each((_, nested) => {
    const nestedList = $(nested);
    const nestedType = nested.tagName.toLowerCase();
    const nestedItems = [];

    nestedList.children('li').each((_, subLi) => {
      nestedItems.push(extractListItem($(subLi)));
    });

    item.nestedLists.push({
      type: nestedType === 'ul' ? 'unordered' : 'ordered',
      items: nestedItems
    });

    nested.remove();
  });

  // Get remaining text
  item.text = clone.text().replace(/\s+/g, ' ').trim();

  return item;
}

/**
 * Extract tables with headers, rows, and cells
 */
function extractTables($) {
  const tables = [];

  $('table').each((_, el) => {
    const tableEl = $(el);

    // Find caption or heading for the table
    let heading = tableEl.find('caption').first().text().trim() || null;
    if (!heading) {
      const prevHeading = tableEl.prev('h1, h2, h3, h4, h5, h6').first();
      if (prevHeading.length) {
        heading = prevHeading.text().trim();
      }
    }

    const headers = [];
    const rows = [];

    // Extract header row (thead or first tr with th)
    tableEl.find('thead tr').each((_, tr) => {
      $(tr).find('th, td').each((_, cell) => {
        headers.push($(cell).text().replace(/\s+/g, ' ').trim());
      });
    });

    // If no thead, look for th in first tr
    if (headers.length === 0) {
      const firstRow = tableEl.find('tr').first();
      firstRow.find('th').each((_, cell) => {
        headers.push($(cell).text().replace(/\s+/g, ' ').trim());
      });
    }

    // Extract body rows
    tableEl.find('tbody tr, tr').each((_, tr) => {
      const rowEl = $(tr);
      const cells = [];
      let hasTh = rowEl.find('th').length > 0;

      // Skip if this is the header row
      if (rowEl.parent().is('thead')) return;
      if (headers.length > 0 && rowEl.find('th').length === headers.length) return;

      rowEl.find('td, th').each((_, cell) => {
        cells.push($(cell).text().replace(/\s+/g, ' ').trim());
      });

      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    // Only add tables with actual data
    if (rows.length > 0 || headers.length > 0) {
      tables.push({
        heading,
        headers: headers.length > 0 ? headers : null,
        rows,
        rowCount: rows.length,
        columnCount: headers.length || (rows[0]?.length || 0)
      });
    }
  });

  return tables;
}

/**
 * Extract paragraphs with context
 */
function extractParagraphs($) {
  const paragraphs = [];

  $('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();

    // Skip very short or empty paragraphs
    if (text.length < 10) return;

    // Find preceding heading for context
    let context = null;
    const prevHeading = $(el).prevAll('h1, h2, h3, h4, h5, h6').first();
    if (prevHeading.length) {
      context = prevHeading.text().trim();
    }

    paragraphs.push({
      text,
      wordCount: text.split(/\s+/).length,
      context
    });
  });

  return paragraphs;
}

/**
 * Extract spans with potential useful data (labels, badges, inline data)
 */
function extractSpans($) {
  const spans = [];

  $('span').each((_, el) => {
    const spanEl = $(el);
    const text = spanEl.text().replace(/\s+/g, ' ').trim();

    // Skip empty or very short spans
    if (text.length < 2) return;

    // Check for classes that indicate useful data
    const classes = spanEl.attr('class') || '';
    const isLabel = /label|tag|badge|pill|chip/i.test(classes);
    const isData = /data|value|number|count|price|amount/i.test(classes);
    const isHighlighted = /highlight|marked|important|emphasis/i.test(classes);

    if (isLabel || isData || isHighlighted || text.length > 5) {
      spans.push({
        text,
        type: isLabel ? 'label' : isData ? 'data' : isHighlighted ? 'highlighted' : 'inline',
        classes: classes || null
      });
    }
  });

  return spans.slice(0, 100); // Limit to 100 spans
}

/**
 * Extract divs that appear to be content blocks
 */
function extractDivs($) {
  const divs = [];

  $('div').each((_, el) => {
    const divEl = $(el);
    const classes = divEl.attr('class') || '';
    const id = divEl.attr('id') || null;

    // Skip divs without classes/ids (likely layout divs)
    if (!classes && !id) return;

    // Check if this looks like a content block
    const isContentBlock = /content|block|section|card|item|wrapper|container|panel|box|module/i.test(classes);

    if (!isContentBlock) return;

    const text = divEl.text().replace(/\s+/g, ' ').trim();

    // Skip empty or very short divs
    if (text.length < 20) return;

    // Skip if it contains other content divs (we want leaf content blocks)
    const childContentDivs = divEl.children('div[class*="content"], div[class*="card"], div[class*="section"]');
    if (childContentDivs.length > 0) return;

    // Find heading within or before the div
    let heading = divEl.find('h1, h2, h3, h4, h5, h6').first().text().trim() || null;
    if (!heading) {
      const prevHeading = divEl.prevAll('h1, h2, h3, h4, h5, h6').first();
      if (prevHeading.length) {
        heading = prevHeading.text().trim();
      }
    }

    divs.push({
      classes: classes.split(/\s+/).filter(c => c),
      id,
      text: text.slice(0, 500), // Limit text length
      wordCount: text.split(/\s+/).length,
      heading,
      hasChildren: divEl.children().length > 0
    });
  });

  return divs.slice(0, 50); // Limit to 50 divs
}

/**
 * Extract images with metadata
 */
function extractImages($) {
  const images = [];

  $('img').each((_, el) => {
    const imgEl = $(el);
    const src = imgEl.attr('src');
    const alt = imgEl.attr('alt') || null;

    // Skip tiny or placeholder images
    if (!src || src.startsWith('data:image/svg')) return;

    // Find caption or surrounding text
    let caption = imgEl.attr('title') || null;
    if (!caption) {
      const figure = imgEl.closest('figure');
      if (figure.length) {
        caption = figure.find('figcaption').first().text().trim() || null;
      }
    }

    images.push({
      src,
      alt,
      caption,
      width: imgEl.attr('width') || null,
      height: imgEl.attr('height') || null
    });
  });

  return images.slice(0, 30); // Limit to 30 images
}

/**
 * Extract code blocks
 */
function extractCode($) {
  const codeBlocks = [];

  $('pre, code').each((_, el) => {
    const codeEl = $(el);
    const isPre = el.tagName.toLowerCase() === 'pre';

    let code = codeEl.text().replace(/\n+/g, '\n').trim();

    // Skip very short code snippets
    if (code.length < 10) return;

    const language = codeEl.attr('class')?.match(/language-(\w+)/)?.[1] ||
                    codeEl.attr('data-language') || null;

    codeBlocks.push({
      code: code.slice(0, 1000), // Limit length
      language,
      type: isPre ? 'block' : 'inline'
    });
  });

  return codeBlocks;
}

/**
 * Extract blockquotes
 */
function extractBlockquotes($) {
  const blockquotes = [];

  $('blockquote').each((_, el) => {
    const bqEl = $(el);
    const text = bqEl.text().replace(/\s+/g, ' ').trim();

    // Find citation
    let cite = bqEl.attr('cite') || null;
    const footer = bqEl.find('footer, cite').first();
    if (footer.length) {
      cite = footer.text().trim();
    }

    if (text.length > 0) {
      blockquotes.push({
        text,
        citation: cite
      });
    }
  });

  return blockquotes;
}

/**
 * Main scrape function that combines all extractors
 */
export async function scrapeUrl(targetUrl) {
  try {
    new URL(targetUrl);

    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SearchBot/1.0)'
      }
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, noscript, iframe, nav, footer, header').remove();

    // Extract metadata
    const title = $('title').text().trim() ||
                  $('h1').first().text().trim() ||
                  'Untitled';

    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       '';

    const image = $('meta[property="og:image"]').attr('content') ||
                 $('meta[name="twitter:image"]').attr('content') ||
                 '';

    // Extract main content text
    const mainContent = $('main, article, [role="main"], .content, .post, body').first();
    const text = mainContent.text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    // Extract links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const linkText = $(el).text().trim();
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        links.push({ href, text: linkText });
      }
    });

    // Extract headings
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      headings.push({
        level: $(el).prop('tagName').toLowerCase(),
        text: $(el).text().trim()
      });
    });

    // Use component extractors
    const lists = extractLists($);
    const tables = extractTables($);
    const paragraphs = extractParagraphs($);
    const spans = extractSpans($);
    const divs = extractDivs($);
    const images = extractImages($);
    const code = extractCode($);
    const blockquotes = extractBlockquotes($);

    return {
      success: true,
      url: targetUrl,
      data: {
        title,
        description,
        image,
        text,
        wordCount: text.split(/\s+/).length,
        headings,
        links: links.slice(0, 50),
        // Structured components
        lists,
        tables,
        paragraphs,
        spans,
        divs,
        images,
        code,
        blockquotes,
        // Summary
        componentCount: {
          lists: lists.length,
          tables: tables.length,
          paragraphs: paragraphs.length,
          spans: spans.length,
          divs: divs.length,
          images: images.length,
          code: code.length,
          blockquotes: blockquotes.length
        }
      }
    };

  } catch (error) {
    return {
      success: false,
      url: targetUrl,
      error: error.message
    };
  }
}
