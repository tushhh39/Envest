import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// The URL where your Express backend is running
const API_URL = 'https://envest-mern23.vercel.app/api';
// Your VAPID Public Key from the .env file
const VAPID_PUBLIC_KEY = 'BNHAPDB6AmpBOmSfpcPFnB0_byZAmSL80e-gGa_cyHqK_RnvpWyDOgF54K24603J5k20q0rT4PgTECn8ZBFUBgM'; // <-- IMPORTANT: PASTE YOUR PUBLIC KEY HERE

// Helper function to convert urlB64ToUint8Array
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function App() {
  const [portfolio, setPortfolio] = useState(['RELIANCE', 'TCS', 'INFY']);
  const [inputValue, setInputValue] = useState(portfolio.join(', '));
  const [generalNews, setGeneralNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Effect to fetch general news when the component first loads
  useEffect(() => {
    const fetchNews = async () => {
      setIsLoadingNews(true);
      try {
        const response = await axios.get(`${API_URL}/news`);
        console.log('Fetched general news:', response.data);
        setGeneralNews(response.data.articles || []);
      } catch (error) {
        console.error('❌ Failed to fetch general news:', error.message);
      }
      setIsLoadingNews(false);
    };
    fetchNews();
  }, []);
  

  // Effect to check for existing push notification subscription on load
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setIsSubscribed(true);
          }
        });
      });
    }
  }, []);

  // Main function to update portfolio, fetch news for it, and trigger analysis
  const handlePortfolioUpdate = async () => {
    const newPortfolio = inputValue
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    
    setPortfolio(newPortfolio);
    setFilteredNews([]); // Clear old results immediately

    if (newPortfolio.length === 0) return;

    const query = newPortfolio.join(' OR ');
    try {
      // Set loading state for the filtered news section
      setFilteredNews([{ isLoading: true, title: `Searching news for ${query}...` }]);
      const response = await axios.post(`${API_URL}/searchNews`, { query });
      
      const results = response.data.articles.map(article => ({
        ...article,
        isLoading: true, // Set to true to trigger analysis spinner
      }));
      
      setFilteredNews(results);
      results.forEach(article => analyzeHeadline(article, newPortfolio));

    } catch (err) {
      console.error('❌ Portfolio news search failed:', err.message);
      setFilteredNews([{ title: 'Failed to find news. Please try again.' }]);
    }
  };

  // Function to call our backend's AI analysis endpoint
  const analyzeHeadline = async (article, currentPortfolio) => {
    // A more robust way to find which stock the headline is about
    const relevantStock = currentPortfolio.find(stock =>
        new RegExp(`\\b${stock}\\b`, 'i').test(article.title)
    );

    if (!relevantStock) {
        // If no direct match, just mark as done without analysis
        setFilteredNews(prevNews =>
            prevNews.map(n => n.link === article.link ? { ...n, isLoading: false, reasoning: 'No specific portfolio stock mentioned.' } : n)
        );
        return;
    }

    try {
      const response = await axios.post(`${API_URL}/analyze`, {
        headline: article.title,
        stock: relevantStock,
      });

      const analysis = response.data;
      setFilteredNews(prevNews =>
        prevNews.map(n =>
          n.link === article.link
            ? { ...n, ...analysis, isLoading: false }
            : n
        )
      );
    } catch (error) {
      console.error('❌ Analysis failed for:', article.title, error.message);
      setFilteredNews(prevNews =>
        prevNews.map(n =>
          n.link === article.link
            ? { ...n, reasoning: 'Analysis failed.', isLoading: false }
            : n
        )
      );
    }
  };

  // Function to handle push notification subscription
  const handleSubscription = async () => {
    if (!('serviceWorker' in navigator)) {
        alert('Push notifications not supported by your browser.');
        return;
    }

    try {
        const register = await navigator.serviceWorker.register('/sw.js');
        let subscription = await register.pushManager.getSubscription();
        
        if (subscription) {
            alert('You are already subscribed!');
            setIsSubscribed(true);
            return;
        }

        subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await axios.post(`${API_URL}/subscribe`, subscription);
        alert('Subscribed to notifications successfully!');
        setIsSubscribed(true);
    } catch (error) {
        console.error('Failed to subscribe:', error);
        alert('Failed to subscribe to notifications.');
        setIsSubscribed(false);
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
            <button onClick={handleSubscription} disabled={isSubscribed} className="subscribe-btn">
              {isSubscribed ? 'Subscribed' : 'Enable Notifications'}
            </button>
          </div>
        </div>

        <div className="news-grid">
          <section>
            <h2>News For Your Portfolio ({portfolio.join(', ')})</h2>
            <div className="news-list">
  {/* Case 1: Initial state, before any search has been run */}
  {filteredNews === null ? (
    <p className="placeholder-text">Enter stocks above and click "Update" to see relevant news.</p>

  /* Case 2: A search was run, but it returned results */
  ) : filteredNews.length > 0 ? (
    filteredNews.map((item, index) => <NewsCard key={item.link || index} item={item} />)

  /* Case 3: A search was run and it returned 0 results */
  ) : (
    <p className="placeholder-text">No results found for your query. Try searching for other stocks.</p>
  )}
</div>
          </section>

          <section>
            <h2>General Market News (News.Data.io)</h2>
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

// Reusable component for news card (Unchanged)
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
