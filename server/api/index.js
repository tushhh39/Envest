const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const webPush = require('web-push');
const path = require("path");
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();

// === VAPID Keys ===
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails('mailto:your-email@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

let subscriptions = [];

app.use(cors({
  origin: 'https://envest-mern.vercel23.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// === Routes (same as your original) ===

app.get('/api/news', async (req, res) => {
  const apiKey = process.env.NEWSDATA_API_KEY;
  const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&language=en&country=in&category=business`;

  try {
    const response = await axios.get(url);
    const articles = response.data.results?.map(article => ({
      title: article.title,
      link: article.link,
      source: article.source_id,
      pubDate: article.pubDate,
    }));
    res.json({ articles: articles.slice(0, 15) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news.' });
  }
});

app.post('/api/searchNews', async (req, res) => {
  const { query } = req.body;
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}&language=en&category=business`;

  try {
    const response = await axios.get(url);
    const articles = response.data.results.map(article => ({
      title: article.title,
      link: article.link,
      source: article.source_id,
    }));
    res.json({ articles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news.' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { headline, stock } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!headline || !stock) {
    return res.status(400).json({ error: 'Headline and stock are required.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `Analyze the following news headline for "${stock}": "${headline}". Respond with raw JSON: { sentiment, confidence, reasoning }.`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: [],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });

    const analysisText = response.data.candidates[0].content.parts[0].text;
    const analysisJson = JSON.parse(analysisText);
    res.json(analysisJson);
  } catch (error) {
    res.status(500).json({ error: 'Gemini analysis failed.' });
  }
});

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscriptions.find(sub => sub.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
  }
  res.status(201).json({ message: 'Subscription successful' });
});

// === Export handler for Vercel ===
module.exports = serverless(app);
