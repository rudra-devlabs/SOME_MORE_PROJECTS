import express from 'express';
import { scrapeUrl } from './scraper.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scrape a single URL
app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const result = await scrapeUrl(url);

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json(result);
});

// Search endpoint - accepts URL and returns scraped data
app.get('/search', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  const result = await scrapeUrl(url);

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json(result);
});

// Bulk scrape multiple URLs
app.post('/scrape/bulk', async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  if (urls.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 URLs allowed per request' });
  }

  const results = await Promise.all(urls.map(url => scrapeUrl(url)));

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Search API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /scrape      - Scrape a URL (body: { url })`);
  console.log(`  GET  /search?url= - Scrape a URL via query param`);
  console.log(`  POST /scrape/bulk - Scrape multiple URLs`);
});
