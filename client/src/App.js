import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// ===================================================================================

// Storing API keys in frontend code is insecure and should not be done in production.
// These keys will be visible to anyone inspecting your app's source code.
// For production, use a serverless function or a backend proxy to protect your keys.
// ===================================================================================
const NEWSDATA_API_KEY = 'pub_04399dc063224203917f923e999dc182';
const GEMINI_API_KEY = 'AIzaSyCz70oV2m89o48UFksQarxGBJezclHeTvk';

function App() {
  const [portfolio, setPortfolio] = useState(['RELIANCE', 'TCS', 'INFY']);
  const [inputValue, setInputValue] = useState(portfolio.join(', '));
  const [generalNews, setGeneralNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  // Effect to fetch general news when the component first loads
  useEffect(() => {
    const fetchNews = async () => {
      setIsLoadingNews(true);
      // Directly call the NewsData.io API
      const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&language=en&country=in&category=business`;

      try {
        const response = await axios.get(url);
        console.log('Fetched general news:', response.data);
        // The raw API response uses 'results', not 'articles'
        setGeneralNews(response.data.results || []);
      } catch (error) {
        console.error('❌ Failed to fetch general news:', error.message);
        // Add user-friendly error message
        setGeneralNews([{ title: 'Error: Could not fetch general news. Check API Key.' }]);
      }
      setIsLoadingNews(false);
    };

    if (NEWSDATA_API_KEY === 'PASTE_YOUR_NEWSDATA_API_KEY_HERE') {
        alert("Please paste your NewsData.io API key in App.js");
        setIsLoadingNews(false);
    } else {
        fetchNews();
    }
  }, []);

  // Main function to update portfolio and fetch news for it
  const handlePortfolioUpdate = async () => {
    const newPortfolio = inputValue
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    
    setPortfolio(newPortfolio);
    setFilteredNews([]); // Clear old results immediately

    if (newPortfolio.length === 0) return;
    if (NEWSDATA_API_KEY === 'PASTE_YOUR_NEWSDATA_API_KEY_HERE') {
        alert("Please paste your NewsData.io API key in App.js");
        return;
    }

    const query = newPortfolio.join(' OR ');
    // Directly call the NewsData.io search endpoint
    const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en&category=business`;

    try {
      setFilteredNews([{ isLoading: true, title: `Searching news for ${query}...` }]);
      const response = await axios.get(url);
      
      // The raw API response uses 'results'
      const results = response.data.results.map(article => ({
        ...article,
        isLoading: true, // Set to true to trigger analysis spinner for each card
      }));
      
      setFilteredNews(results);
      // Trigger analysis for each fetched article
      results.forEach(article => analyzeHeadline(article, newPortfolio));

    } catch (err) {
      console.error('❌ Portfolio news search failed:', err.message);
      setFilteredNews([{ title: 'Failed to find news. Please try again.' }]);
    }
  };

  // Function to call Google Gemini API directly
  const analyzeHeadline = async (article, currentPortfolio) => {
    if (GEMINI_API_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
        setFilteredNews(prev => prev.map(n => n.link === article.link ? { ...n, isLoading: false, reasoning: 'Gemini API key not provided.' } : n));
        return;
    }

    const relevantStock = currentPortfolio.find(stock =>
        new RegExp(`\\b${stock}\\b`, 'i').test(article.title)
    );

    if (!relevantStock) {
        setFilteredNews(prevNews =>
            prevNews.map(n => n.link === article.link ? { ...n, isLoading: false, reasoning: 'No specific portfolio stock mentioned.' } : n)
        );
        return;
    }

    // This logic is moved directly from your backend
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `
      Analyze the following news headline for its potential impact on the Indian stock: "${relevantStock}".
      Headline: "${article.title}"
      
      Strictly provide your analysis ONLY in a raw JSON object format with three keys:
      1. "sentiment": A string which must be one of "Positive", "Negative", or "Neutral".
      2. "confidence": A number between 0 and 1 representing your confidence.
      3. "reasoning": A brief, one-sentence explanation for your sentiment analysis.
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
      const response = await axios.post(url, requestBody);
      const analysisText = response.data.candidates[0].content.parts[0].text;
      const analysisJson = JSON.parse(analysisText);

      setFilteredNews(prevNews =>
        prevNews.map(n =>
          n.link === article.link
            ? { ...n, ...analysisJson, isLoading: false }
            : n
        )
      );
    } catch (error) {
      console.error('❌ Gemini analysis failed for:', article.title, error.message);
      setFilteredNews(prevNews =>
        prevNews.map(n =>
          n.link === article.link
            ? { ...n, reasoning: 'AI analysis failed.', isLoading: false }
            : n
        )
      );
    }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1>Smart News & Portfolio Insights</h1>
          <p>AI-Powered News Analysis for Your Indian Stock Portfolio</p>
        </header>

        <div className="portfolio-section">
          <h2>Your Portfolio</h2>
          <div className="input-group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., RELIANCE, TCS, INFY"
            />
            <button onClick={handlePortfolioUpdate}>Update & Analyze</button>
            {/* The "Enable Notifications" button has been removed as it's no longer functional */}
          </div>
        </div>

        <div className="news-grid">
          <section>
            <h2>News For Your Portfolio ({portfolio.join(', ')})</h2>
            <div className="news-list">
              {filteredNews === null ? (
                <p className="placeholder-text">Enter stocks and click "Update" to see relevant news.</p>
              ) : filteredNews.length > 0 ? (
                filteredNews.map((item, index) => <NewsCard key={item.link || index} item={item} />)
              ) : (
                <p className="placeholder-text">No results found. Try different stocks.</p>
              )}
            </div>
          </section>

          <section>
            <h2>General Market News</h2>
            <div className="news-list">
              {isLoadingNews ? (
                <p className="placeholder-text">Loading news...</p>
              ) : generalNews.length > 0 ? (
                generalNews.map((item, index) => <NewsCard key={item.link || index} item={item} />)
              ) : (
                <p className="placeholder-text">Could not fetch general news.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Reusable NewsCard component remains unchanged
const NewsCard = ({ item }) => {
    const getSentimentClass = (sentiment) => {
      if (sentiment === 'Positive') return 'sentiment-positive';
      if (sentiment === 'Negative') return 'sentiment-negative';
      if (sentiment === 'Neutral') return 'sentiment-neutral';
      return '';
    };
  
    const formattedDate = item.pubDate
      ? new Date(item.pubDate).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;
  
    return (
      <div className="news-card">
        {item.link ? (
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            <h3>{item.title}</h3>
          </a>
        ) : (
          <h3>{item.title}</h3>
        )}
        
        {formattedDate && (
          <p className="news-date" style={{ fontSize: '0.85em', color: '#555' }}>
            {formattedDate}
          </p>
        )}
  
        {item.isLoading ? (
          <p className="analysis-text">Analyzing with AI...</p>
        ) : item.sentiment && (
          <div className="analysis-section">
            <div className="sentiment-badge-container">
              <span className={`sentiment-badge ${getSentimentClass(item.sentiment)}`}>
                {item.sentiment}
              </span>
              <p className="reasoning-text">{item.reasoning}</p>
            </div>
            {item.confidence && (
              <p className="confidence-text">
                Confidence: {(item.confidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

export default App;
