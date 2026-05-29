/**
 * Component-specific extractors for structured data extraction
 * Each extractor has its own rules for parsing different HTML elements
 */

// ============== LIST EXTRACTOR ==============
export function extractLists($) {
  const lists = [];

  $('ol, ul').each((_, listEl) => {
    const list = $(listEl);
    const isOrdered = listEl.tagName === 'ol';

    // Find heading - check preceding sibling or parent heading
    let heading = null;
    const prevSibling = list.prev();
    if (prevSibling.is('h1, h2, h3, h4, h5, h6, p, span')) {
      heading = prevSibling.text().trim() || null;
    }

    // Extract list items
    const elements = [];
    list.find('> li').each((_, li) => {
      const item = $(li);

      // Check for nested lists
      const nestedLists = [];
      const nestedUl = item.find('> ul, > ol');
      if (nestedUl.length > 0) {
        nestedUl.each((_, nested) => {
          const nestedItems = [];
          $(nested).find('> li').each((_, nli) => {
            nestedItems.push($(nli).text().trim());
          });
          nestedLists.push({
            type: $(nested).prop('tagName').toLowerCase(),
            items: nestedItems
          });
        });
        // Remove nested list from main text
        nestedUl.remove();
      }

      const text = item.text().trim();
      if (text) {
        elements.push({
          text,
          nestedLists: nestedLists.length > 0 ? nestedLists : undefined
        });
      }
    });

    if (elements.length > 0) {
      lists.push({
        type: isOrdered ? 'ordered' : 'unordered',
        heading,
        elements: elements.map(e => e.text),
        detailedElements: elements
      });
    }
  });

  return lists.length > 0 ? lists : null;
}

// ============== TABLE EXTRACTOR ==============
export function extractTables($) {
  const tables = [];

  $('table').each((_, tableEl) => {
    const table = $(tableEl);

    // Find table caption or preceding heading
    let heading = table.find('caption').text().trim() || null;
    if (!heading) {
      const prevSibling = table.prev();
      if (prevSibling.is('h1, h2, h3, h4, h5, h6, p')) {
        heading = prevSibling.text().trim() || null;
      }
    }

    // Extract headers
    const headers = [];
    table.find('thead th').each((_, th) => {
      headers.push($(th).text().trim().replace(/\s+/g, ' '));
    });

    // Extract rows
    const rows = [];
    table.find('tbody tr, tr').each((_, tr) => {
      const cells = [];
      $(tr).find('td, th').each((_, cell) => {
        cells.push($(cell).text().trim().replace(/\s+/g, ' '));
      });
      if (cells.length > 0 && !cells.every(c => c === '')) {
        rows.push(cells);
      }
    });

    // Convert to objects if headers exist
    const structuredRows = headers.length > 0
      ? rows.map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            if (row[i]) obj[header] = row[i];
          });
          return obj;
        })
      : rows;

    if (rows.length > 0) {
      tables.push({
        heading,
        headers: headers.length > 0 ? headers : null,
        rowCount: rows.length,
        columnCount: headers.length > 0 ? headers.length : (rows[0]?.length || 0),
        data: structuredRows,
        rawRows: rows
      });
    }
  });

  return tables.length > 0 ? tables : null;
}

// ============== DIV/BLOCK EXTRACTOR ==============
export function extractDivs($) {
  const blocks = [];

  // Look for divs with meaningful classes/ids that contain content
  $('div[class], div[id]').each((_, divEl) => {
    const div = $(divEl);

    // Skip hidden or utility divs
    const className = div.attr('class') || '';
    if (className.match(/hidden|wrapper|container|flex|grid|row|col/i)) {
      // Don't skip entirely, just deprioritize
    }

    const text = div.text().trim();

    // Only include divs with substantial content
    if (text.length > 50 && text.length < 2000) {
      // Check if it has a heading inside
      const heading = div.find('h1, h2, h3, h4, h5, h6').first().text().trim() || null;

      // Extract any links inside
      const links = [];
      div.find('a[href]').each((_, a) => {
        const href = $(a).attr('href');
        const linkText = $(a).text().trim();
        if (href && linkText) {
          links.push({ text: linkText, href });
        }
      });

      // Check for special patterns (pricing, features, etc.)
      let type = 'content-block';
      if (className.match(/price|pricing|plan/i)) type = 'pricing';
      else if (className.match(/feature/i)) type = 'features';
      else if (className.match(/testimonial|review/i)) type = 'testimonial';
      else if (className.match(/faq|question/i)) type = 'faq';
      else if (className.match(/hero|banner/i)) type = 'hero';

      blocks.push({
        type,
        heading,
        content: text,
        links: links.length > 0 ? links : undefined,
        class: className || undefined
      });
    }
  });

  // Deduplicate similar blocks
  const uniqueBlocks = blocks.filter((block, i, self) =>
    i === self.findIndex(b => b.content === block.content)
  );

  return uniqueBlocks.length > 0 ? uniqueBlocks : null;
}

// ============== PARAGRAPH EXTRACTOR ==============
export function extractParagraphs($) {
  const paragraphs = [];

  $('p').each((_, p) => {
    const text = $(p).text().trim();
    // Only include substantial paragraphs
    if (text.length > 20) {
      paragraphs.push(text);
    }
  });

  return paragraphs.length > 0 ? paragraphs : null;
}

// ============== HEADING EXTRACTOR ==============
export function extractHeadings($) {
  const headings = [];

  $('h1, h2, h3, h4, h5, h6').each((_, h) => {
    const heading = $(h);
    headings.push({
      level: parseInt(heading.prop('tagName')[1]),
      text: heading.text().trim()
    });
  });

  return headings.length > 0 ? headings : null;
}

// ============== LINK EXTRACTOR ==============
export function extractLinks($) {
  const links = [];
  const seen = new Set();

  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    const text = $(a).text().trim();

    if (href &&
        !href.startsWith('javascript:') &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        !seen.has(href)) {
      seen.add(href);
      links.push({
        text: text || href,
        href,
        isExternal: href.startsWith('http') && !href.includes('portail.in')
      });
    }
  });

  return links.length > 0 ? links : null;
}

// ============== IMAGE EXTRACTOR ==============
export function extractImages($) {
  const images = [];

  $('img[src]').each((_, img) => {
    const src = $(img).attr('src');
    const alt = $(img).attr('alt') || '';

    if (src && !src.startsWith('data:')) {
      images.push({
        src,
        alt,
        caption: $(img).closest('figure').find('figcaption').text().trim() || undefined
      });
    }
  });

  return images.length > 0 ? images : null;
}

// ============== SPAN/INLINE EXTRACTOR ==============
export function extractSpans($) {
  const highlights = [];

  // Look for spans with special styling or classes
  $('span[class], span[style]').each((_, span) => {
    const el = $(span);
    const text = el.text().trim();
    const className = el.attr('class') || '';

    // Only capture spans that seem meaningful
    if (text.length > 3 && text.length < 200) {
      let type = 'inline';
      if (className.match(/highlight|important|emphasis/i)) type = 'highlight';
      else if (className.match(/price|cost|amount/i)) type = 'price';
      else if (className.match(/badge|tag|label/i)) type = 'badge';

      if (type !== 'inline') {
        highlights.push({
          type,
          text,
          class: className || undefined
        });
      }
    }
  });

  return highlights.length > 0 ? highlights : null;
}

// ============== DEFINITION LIST EXTRACTOR ==============
export function extractDefinitionLists($) {
  const definitions = [];

  $('dl').each((_, dl) => {
    const dlEl = $(dl);
    const items = [];

    dlEl.find('dt').each((_, dt) => {
      const term = $(dt).text().trim();
      const dd = $(dt).next('dd');
      const definition = dd.text().trim();

      if (term) {
        items.push({ term, definition });
      }
    });

    if (items.length > 0) {
      definitions.push({ items });
    }
  });

  return definitions.length > 0 ? definitions : null;
}

// ============== CODE EXTRACTOR ==============
export function extractCode($) {
  const codeBlocks = [];

  $('pre, code, kbd').each((_, codeEl) => {
    const code = $(codeEl).text().trim();
    if (code.length > 10) {
      codeBlocks.push({
        type: codeEl.tagName.toLowerCase(),
        content: code
      });
    }
  });

  return codeBlocks.length > 0 ? codeBlocks : null;
}

// ============== QUOTE/BLOCKQUOTE EXTRACTOR ==============
export function extractQuotes($) {
  const quotes = [];

  $('blockquote, q, cite').each((_, quoteEl) => {
    const quote = $(quoteEl);
    const text = quote.text().trim();

    if (text.length > 10) {
      // Try to find author/citation
      const cite = quote.find('cite').text().trim() ||
                   quote.next('cite').text().trim() ||
                   undefined;

      quotes.push({
        text,
        author: cite
      });
    }
  });

  return quotes.length > 0 ? quotes : null;
}
