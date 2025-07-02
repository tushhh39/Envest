// backend/server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors =require('cors');
const webPush = require('web-push');
const path=require("path")
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// === VAPID Keys for Push Notifications ===
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails('mailto:avhadtushar68@gmail.com', vapidKeys.publicKey, vapidKeys.privateKey);

// In-memory store for push subscriptions (for demonstration purposes)
let subscriptions = [];

// === Middleware ===
app.use(cors());
app.use(express.json());

// === API Routes ===

/**
 * @route   GET /api/news
 * @desc    Scrape general market news from Moneycontrol
 * @access  Public
 */
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
    

    res.json({ articles: articles.slice(0, 15) }); // Limit to top 15
  } catch (error) {
    console.error('Failed to fetch general news from NewsData.io:', error.message);
    res.status(500).json({ error: 'Failed to fetch general market news.' });
  }
});


/**
 * @route   POST /api/searchNews
 * @desc    Search for news using NewsData.io API
 * @access  Public
 */
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
    console.error('News API failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch news.' });
  }
});


/**
 * @route   POST /api/analyze
 * @desc    Analyze a news headline using Google Gemini API
 * @access  Public
 */
app.post('/api/analyze', async (req, res) => {
  const { headline, stock } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!headline || !stock) {
    return res.status(400).json({ error: 'Headline and stock are required.' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `
    Analyze the following news headline for its potential impact on the Indian stock: "${stock}".
    Headline: "${headline}"
    
    Strictly provide your analysis ONLY in a raw JSON object format with three keys:
    1. "sentiment": A string which must be one of "Positive", "Negative", or "Neutral".
    2. "confidence": A number between 0 and 1 representing your confidence.
    3. "reasoning": A brief, one-sentence explanation for your sentiment analysis.

    Example:
    {
      "sentiment": "Positive",
      "confidence": 0.8,
      "reasoning": "The headline suggests strong quarterly earnings, which typically drives stock prices up."
    }
  `;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
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
    console.error('Gemini API request failed:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to analyze sentiment with Gemini.' });
  }
});

/**
 * @route   POST /api/subscribe
 * @desc    Subscribe a user to push notifications
 * @access  Public
 */
app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    
    // Add new subscription to our in-memory list
    if (!subscriptions.find(sub => sub.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription);
        console.log('Subscription added:', subscription.endpoint);
    }
    
    res.status(201).json({ message: 'Subscription successful' });
});

//static files

app.use(express.static(path.join(__dirname,'./client/build')))
app.get('*',function(req,res){
  res.sendFile(path.join(__dirname,'./client/build/index.html'))
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
