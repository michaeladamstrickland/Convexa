/**
 * demo-ui.js
 * A simple UI demo for ML integration
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express application
const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Proxy to ML API
app.post('/api/predict/:endpoint', async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    const data = req.body;
    
    console.log(`Forwarding request to ${endpoint}:`, data);
    
    // Forward to the ML API
    const response = await fetch(`http://localhost:3030/api/predict/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve demo UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// Create necessary directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create demo HTML file
const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeadFlow AI - ML Demo</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f7fa;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      flex: 1;
      min-width: 300px;
    }
    input, select {
      width: 100%;
      padding: 8px;
      margin-bottom: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover {
      background-color: #2980b9;
    }
    .result {
      margin-top: 15px;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 4px;
      border-left: 4px solid #3498db;
    }
    .error {
      background-color: #fee;
      border-left: 4px solid #e74c3c;
    }
    pre {
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .tabs {
      display: flex;
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      background-color: #eee;
      cursor: pointer;
      border: 1px solid #ddd;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
    }
    .tab.active {
      background-color: white;
      font-weight: bold;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .score-display {
      display: flex;
      align-items: center;
      margin-top: 10px;
    }
    .score-bar {
      flex-grow: 1;
      height: 20px;
      background-color: #ecf0f1;
      border-radius: 10px;
      overflow: hidden;
      margin-right: 10px;
    }
    .score-fill {
      height: 100%;
      background-color: #3498db;
      width: 0%;
      transition: width 0.5s ease-in-out;
    }
    .high-score { background-color: #2ecc71; }
    .medium-score { background-color: #f39c12; }
    .low-score { background-color: #e74c3c; }
  </style>
</head>
<body>
  <h1>LeadFlow AI - Machine Learning Demo</h1>
  
  <div class="tabs">
    <div class="tab active" data-tab="property-valuation">Property Valuation</div>
    <div class="tab" data-tab="distress-signals">Distress Signals</div>
    <div class="tab" data-tab="lead-scoring">Lead Scoring</div>
    <div class="tab" data-tab="contact-recommendation">Contact Recommendation</div>
  </div>
  
  <div class="tab-content active" id="property-valuation">
    <h2>Property Valuation Predictor</h2>
    <div class="card">
      <form id="valuation-form">
        <div>
          <label for="address">Property Address:</label>
          <input type="text" id="address" name="address" value="123 Main St, Example City, CA 90210" required>
        </div>
        <div>
          <label for="bedrooms">Bedrooms:</label>
          <input type="number" id="bedrooms" name="bedrooms" value="3" min="1" max="10" required>
        </div>
        <div>
          <label for="bathrooms">Bathrooms:</label>
          <input type="number" id="bathrooms" name="bathrooms" value="2" min="1" max="10" step="0.5" required>
        </div>
        <div>
          <label for="squareFeet">Square Feet:</label>
          <input type="number" id="squareFeet" name="squareFeet" value="1800" min="500" max="10000" required>
        </div>
        <div>
          <label for="yearBuilt">Year Built:</label>
          <input type="number" id="yearBuilt" name="yearBuilt" value="1990" min="1900" max="2024" required>
        </div>
        <div>
          <label for="zipCode">Zip Code:</label>
          <input type="text" id="zipCode" name="zipCode" value="90210" required>
        </div>
        <button type="submit">Predict Property Value</button>
      </form>
      <div class="result" id="valuation-result" style="display:none;">
        <h3>Predicted Value</h3>
        <div class="score-display">
          <div class="score-bar">
            <div class="score-fill"></div>
          </div>
          <div class="score-value">$0</div>
        </div>
        <div class="confidence">Confidence: <span>0%</span></div>
        <h4>Comparable Properties:</h4>
        <div class="comparables"></div>
        <pre class="raw-result"></pre>
      </div>
    </div>
  </div>
  
  <div class="tab-content" id="distress-signals">
    <h2>Distress Signal Detector</h2>
    <div class="card">
      <form id="distress-form">
        <div>
          <label for="distress-address">Property Address:</label>
          <input type="text" id="distress-address" name="address" value="456 Oak Ave, Example City, CA 90211" required>
        </div>
        <div>
          <label for="foreclosureStatus">Foreclosure Status:</label>
          <select id="foreclosureStatus" name="foreclosureStatus">
            <option value="NONE">None</option>
            <option value="PRE_FORECLOSURE">Pre-Foreclosure</option>
            <option value="NOTICE_OF_DEFAULT">Notice of Default</option>
            <option value="SCHEDULED_AUCTION">Scheduled Auction</option>
          </select>
        </div>
        <div>
          <label for="taxStatus">Tax Status:</label>
          <select id="taxStatus" name="taxStatus">
            <option value="CURRENT">Current</option>
            <option value="DELINQUENT">Delinquent</option>
            <option value="PARTIAL">Partially Paid</option>
          </select>
        </div>
        <div>
          <label for="propertyCondition">Property Condition:</label>
          <select id="propertyCondition" name="propertyCondition">
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
            <option value="VERY_POOR">Very Poor</option>
          </select>
        </div>
        <button type="submit">Detect Distress Signals</button>
      </form>
      <div class="result" id="distress-result" style="display:none;">
        <h3>Distress Analysis</h3>
        <div class="score-display">
          <div class="score-bar">
            <div class="score-fill"></div>
          </div>
          <div class="score-value">0%</div>
        </div>
        <div class="confidence">Confidence: <span>0%</span></div>
        <h4>Detected Signals:</h4>
        <ul class="signals-list"></ul>
        <h4>Recommendations:</h4>
        <ul class="recommendations-list"></ul>
        <pre class="raw-result"></pre>
      </div>
    </div>
  </div>
  
  <div class="tab-content" id="lead-scoring">
    <h2>Lead Scoring System</h2>
    <div class="card">
      <form id="lead-form">
        <div>
          <label for="lead-address">Property Address:</label>
          <input type="text" id="lead-address" name="address" value="789 Maple Dr, Example City, CA 90212" required>
        </div>
        <div>
          <label for="ownerName">Owner Name:</label>
          <input type="text" id="ownerName" name="ownerName" value="John Smith">
        </div>
        <div>
          <label for="occupancyStatus">Occupancy Status:</label>
          <select id="occupancyStatus" name="occupancyStatus">
            <option value="OWNER_OCCUPIED">Owner Occupied</option>
            <option value="RENTER_OCCUPIED">Renter Occupied</option>
            <option value="VACANT">Vacant</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
        <div>
          <label for="estimatedEquity">Estimated Equity:</label>
          <input type="number" id="estimatedEquity" name="estimatedEquity" value="100000">
        </div>
        <div>
          <label for="lead-taxStatus">Tax Status:</label>
          <select id="lead-taxStatus" name="taxStatus">
            <option value="CURRENT">Current</option>
            <option value="DELINQUENT">Delinquent</option>
            <option value="PARTIAL">Partially Paid</option>
          </select>
        </div>
        <button type="submit">Generate Lead Score</button>
      </form>
      <div class="result" id="lead-result" style="display:none;">
        <h3>Lead Score</h3>
        <div class="score-display">
          <div class="score-bar">
            <div class="score-fill"></div>
          </div>
          <div class="score-value">0</div>
        </div>
        <div class="classification">Classification: <span>UNKNOWN</span></div>
        <div class="confidence">Confidence: <span>0%</span></div>
        <h4>Contributing Factors:</h4>
        <ul class="factors-list"></ul>
        <h4>Recommended Actions:</h4>
        <ul class="lead-recommendations-list"></ul>
        <pre class="raw-result"></pre>
      </div>
    </div>
  </div>
  
  <div class="tab-content" id="contact-recommendation">
    <h2>Contact Method Recommendation</h2>
    <div class="card">
      <form id="contact-form">
        <div>
          <label for="name">Owner Name:</label>
          <input type="text" id="name" name="name" value="Jane Doe" required>
        </div>
        <div>
          <label for="phone">Phone Number:</label>
          <input type="text" id="phone" name="phone" value="555-123-4567">
        </div>
        <div>
          <label for="email">Email Address:</label>
          <input type="email" id="email" name="email" value="jane@example.com">
        </div>
        <div>
          <label for="age">Age (if known):</label>
          <input type="number" id="age" name="age" min="18" max="100">
        </div>
        <div>
          <label for="occupation">Occupation (if known):</label>
          <input type="text" id="occupation" name="occupation">
        </div>
        <button type="submit">Find Best Contact Method</button>
      </form>
      <div class="result" id="contact-result" style="display:none;">
        <h3>Recommended Contact Method</h3>
        <div class="primary-method"></div>
        <div class="confidence">Confidence: <span>0%</span></div>
        <h4>Alternative Methods:</h4>
        <ul class="alternative-methods-list"></ul>
        <h4>Best Times to Contact:</h4>
        <ul class="best-times-list"></ul>
        <h4>Personalized Message Template:</h4>
        <div class="personalized-message"></div>
        <pre class="raw-result"></pre>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Tab functionality
      const tabs = document.querySelectorAll('.tab');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabId = tab.dataset.tab;
          
          // Update tab states
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Update content
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          
          document.getElementById(tabId).classList.add('active');
        });
      });
      
      // Form submissions
      document.getElementById('valuation-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
          address: document.getElementById('address').value,
          bedrooms: parseInt(document.getElementById('bedrooms').value),
          bathrooms: parseFloat(document.getElementById('bathrooms').value),
          squareFeet: parseInt(document.getElementById('squareFeet').value),
          yearBuilt: parseInt(document.getElementById('yearBuilt').value),
          zipCode: document.getElementById('zipCode').value
        };
        
        try {
          const result = await sendApiRequest('value', formData);
          showValuationResult(result);
        } catch (error) {
          showError('valuation-result', error);
        }
      });
      
      document.getElementById('distress-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
          address: document.getElementById('distress-address').value,
          foreclosureStatus: document.getElementById('foreclosureStatus').value,
          taxStatus: document.getElementById('taxStatus').value,
          propertyCondition: document.getElementById('propertyCondition').value
        };
        
        try {
          const result = await sendApiRequest('distress', formData);
          showDistressResult(result);
        } catch (error) {
          showError('distress-result', error);
        }
      });
      
      document.getElementById('lead-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
          address: document.getElementById('lead-address').value,
          ownerName: document.getElementById('ownerName').value,
          occupancyStatus: document.getElementById('occupancyStatus').value,
          estimatedEquity: parseInt(document.getElementById('estimatedEquity').value),
          taxStatus: document.getElementById('lead-taxStatus').value
        };
        
        try {
          const result = await sendApiRequest('lead-score', formData);
          showLeadResult(result);
        } catch (error) {
          showError('lead-result', error);
        }
      });
      
      document.getElementById('contact-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
          name: document.getElementById('name').value,
          phone: document.getElementById('phone').value,
          email: document.getElementById('email').value
        };
        
        // Only add these if they have values
        if (document.getElementById('age').value) {
          formData.age = parseInt(document.getElementById('age').value);
        }
        
        if (document.getElementById('occupation').value) {
          formData.occupation = document.getElementById('occupation').value;
        }
        
        try {
          const result = await sendApiRequest('contact-method', formData);
          showContactResult(result);
        } catch (error) {
          showError('contact-result', error);
        }
      });
      
      // Helper Functions
      async function sendApiRequest(endpoint, data) {
        const response = await fetch(\`/api/predict/\${endpoint}\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(\`API request failed: \${response.status} \${response.statusText}\`);
        }
        
        return response.json();
      }
      
      function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(value);
      }
      
      function formatPercentage(value) {
        return (value * 100).toFixed(1) + '%';
      }
      
      function showValuationResult(result) {
        const resultDiv = document.getElementById('valuation-result');
        resultDiv.style.display = 'block';
        
        // Set the value
        const scoreValue = resultDiv.querySelector('.score-value');
        scoreValue.textContent = formatCurrency(result.estimatedValue);
        
        // Set the confidence
        const confidence = resultDiv.querySelector('.confidence span');
        confidence.textContent = formatPercentage(result.confidenceScore);
        
        // Set the score bar
        const scoreBar = resultDiv.querySelector('.score-fill');
        // Assuming max property value of $1.5M for the bar
        const maxValue = 1500000;
        const percentage = Math.min((result.estimatedValue / maxValue) * 100, 100);
        scoreBar.style.width = \`\${percentage}%\`;
        
        // Add comparables
        const comparablesDiv = resultDiv.querySelector('.comparables');
        comparablesDiv.innerHTML = '';
        
        if (result.comparables && result.comparables.length > 0) {
          const table = document.createElement('table');
          table.innerHTML = \`
            <tr>
              <th>Address</th>
              <th>Sale Price</th>
              <th>Sale Date</th>
              <th>Similarity</th>
            </tr>
          \`;
          
          result.comparables.forEach(comp => {
            const row = document.createElement('tr');
            row.innerHTML = \`
              <td>\${comp.address}</td>
              <td>\${formatCurrency(comp.salePrice)}</td>
              <td>\${comp.saleDate}</td>
              <td>\${comp.similarity}%</td>
            \`;
            table.appendChild(row);
          });
          
          comparablesDiv.appendChild(table);
        } else {
          comparablesDiv.textContent = 'No comparable properties found.';
        }
        
        // Raw result
        resultDiv.querySelector('.raw-result').textContent = JSON.stringify(result, null, 2);
      }
      
      function showDistressResult(result) {
        const resultDiv = document.getElementById('distress-result');
        resultDiv.style.display = 'block';
        
        // Set the score
        const scoreValue = resultDiv.querySelector('.score-value');
        scoreValue.textContent = formatPercentage(result.distressScore);
        
        // Set the confidence
        const confidence = resultDiv.querySelector('.confidence span');
        confidence.textContent = formatPercentage(result.confidenceScore);
        
        // Set the score bar
        const scoreBar = resultDiv.querySelector('.score-fill');
        const percentage = result.distressScore * 100;
        scoreBar.style.width = \`\${percentage}%\`;
        
        // Color based on score
        if (result.distressScore > 0.7) {
          scoreBar.className = 'score-fill high-score';
        } else if (result.distressScore > 0.4) {
          scoreBar.className = 'score-fill medium-score';
        } else {
          scoreBar.className = 'score-fill low-score';
        }
        
        // Add signals
        const signalsList = resultDiv.querySelector('.signals-list');
        signalsList.innerHTML = '';
        
        if (result.distressSignals && result.distressSignals.length > 0) {
          result.distressSignals.forEach(signal => {
            const li = document.createElement('li');
            li.innerHTML = \`<strong>\${signal.type}</strong> (\${signal.severity}): \${signal.description}\`;
            signalsList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No significant distress signals detected';
          signalsList.appendChild(li);
        }
        
        // Add recommendations
        const recommendationsList = resultDiv.querySelector('.recommendations-list');
        recommendationsList.innerHTML = '';
        
        if (result.recommendations && result.recommendations.length > 0) {
          result.recommendations.forEach(recommendation => {
            const li = document.createElement('li');
            li.textContent = recommendation;
            recommendationsList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No specific recommendations available';
          recommendationsList.appendChild(li);
        }
        
        // Raw result
        resultDiv.querySelector('.raw-result').textContent = JSON.stringify(result, null, 2);
      }
      
      function showLeadResult(result) {
        const resultDiv = document.getElementById('lead-result');
        resultDiv.style.display = 'block';
        
        // Set the score
        const scoreValue = resultDiv.querySelector('.score-value');
        scoreValue.textContent = result.totalScore;
        
        // Set the classification
        const classification = resultDiv.querySelector('.classification span');
        classification.textContent = result.classification;
        
        // Set the confidence
        const confidence = resultDiv.querySelector('.confidence span');
        confidence.textContent = formatPercentage(result.confidenceScore);
        
        // Set the score bar
        const scoreBar = resultDiv.querySelector('.score-fill');
        const percentage = Math.min((result.totalScore / 100) * 100, 100);
        scoreBar.style.width = \`\${percentage}%\`;
        
        // Color based on classification
        if (result.classification === 'HOT') {
          scoreBar.className = 'score-fill high-score';
        } else if (result.classification === 'WARM' || result.classification === 'LUKEWARM') {
          scoreBar.className = 'score-fill medium-score';
        } else {
          scoreBar.className = 'score-fill low-score';
        }
        
        // Add factors
        const factorsList = resultDiv.querySelector('.factors-list');
        factorsList.innerHTML = '';
        
        if (result.factors && result.factors.length > 0) {
          result.factors.forEach(factor => {
            const li = document.createElement('li');
            li.innerHTML = \`<strong>\${factor.factor}</strong> (\${factor.impact}): \${factor.description}\`;
            factorsList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No specific factors available';
          factorsList.appendChild(li);
        }
        
        // Add recommendations
        const recommendationsList = resultDiv.querySelector('.lead-recommendations-list');
        recommendationsList.innerHTML = '';
        
        if (result.recommendations && result.recommendations.length > 0) {
          result.recommendations.forEach(recommendation => {
            const li = document.createElement('li');
            li.textContent = recommendation;
            recommendationsList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No specific recommendations available';
          recommendationsList.appendChild(li);
        }
        
        // Raw result
        resultDiv.querySelector('.raw-result').textContent = JSON.stringify(result, null, 2);
      }
      
      function showContactResult(result) {
        const resultDiv = document.getElementById('contact-result');
        resultDiv.style.display = 'block';
        
        // Set the primary method
        const primaryMethod = resultDiv.querySelector('.primary-method');
        primaryMethod.innerHTML = \`<h3>\${formatContactMethod(result.recommendedMethod)}</h3>\`;
        
        // Set the confidence
        const confidence = resultDiv.querySelector('.confidence span');
        confidence.textContent = formatPercentage(result.confidenceScore);
        
        // Add alternative methods
        const alternativesList = resultDiv.querySelector('.alternative-methods-list');
        alternativesList.innerHTML = '';
        
        if (result.alternativeMethods && result.alternativeMethods.length > 0) {
          result.alternativeMethods.forEach(method => {
            const li = document.createElement('li');
            li.textContent = formatContactMethod(method);
            alternativesList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No alternative methods suggested';
          alternativesList.appendChild(li);
        }
        
        // Add best times
        const bestTimesList = resultDiv.querySelector('.best-times-list');
        bestTimesList.innerHTML = '';
        
        if (result.bestTimes && result.bestTimes.length > 0) {
          result.bestTimes.forEach(time => {
            const li = document.createElement('li');
            li.textContent = time;
            bestTimesList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = 'No specific times recommended';
          bestTimesList.appendChild(li);
        }
        
        // Add personalized message
        const messageDiv = resultDiv.querySelector('.personalized-message');
        if (result.personalizedMessage) {
          messageDiv.innerHTML = \`<div class="message-box">\${result.personalizedMessage.replace(/\\n/g, '<br>')}</div>\`;
        } else {
          messageDiv.textContent = 'No personalized message available';
        }
        
        // Raw result
        resultDiv.querySelector('.raw-result').textContent = JSON.stringify(result, null, 2);
      }
      
      function formatContactMethod(method) {
        switch (method) {
          case 'PHONE': return 'Phone Call';
          case 'TEXT': return 'Text Message';
          case 'EMAIL': return 'Email';
          case 'DIRECT_MAIL': return 'Direct Mail';
          case 'DOOR_KNOCK': return 'Door Knock';
          default: return method;
        }
      }
      
      function showError(resultId, error) {
        const resultDiv = document.getElementById(resultId);
        resultDiv.style.display = 'block';
        resultDiv.classList.add('error');
        resultDiv.innerHTML = \`<h3>Error</h3><p>\${error.message || 'Unknown error'}</p>\`;
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'demo.html'), demoHtml);

// Start server
app.listen(PORT, () => {
  console.log(`Demo UI running at http://localhost:${PORT}`);
});
