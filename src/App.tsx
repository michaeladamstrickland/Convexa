import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ScraperPage from './pages/ScraperPage';

/**
 * Main application component with routing
 */
const App: React.FC = () => {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '8px',
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-xl font-bold text-gray-900">LeadFlow AI</h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<ScraperPage />} />
              <Route path="/scraper" element={<ScraperPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;
