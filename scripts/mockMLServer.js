/**
 * mockMLServer.js
 * Mock server for ML API testing
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check request received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Property valuation endpoint
app.post('/api/models/property-valuation', (req, res) => {
  const { address, squareFeet, bedrooms, bathrooms, yearBuilt, zipCode } = req.body;
  
  console.log(`Valuation request for property: ${address}`);
  
  // Generate a mock prediction
  const baseValue = 200000;
  const sqftFactor = squareFeet * 150;
  const bedroomFactor = bedrooms * 15000;
  const bathroomFactor = bathrooms * 10000;
  const ageFactor = (2024 - yearBuilt) * -500;
  const zipFactor = parseInt(zipCode.substring(0, 2)) * 1000;
  
  const predictedValue = baseValue + sqftFactor + bedroomFactor + bathroomFactor + ageFactor + zipFactor;
  const adjustedValue = Math.max(100000, Math.round(predictedValue * (0.9 + Math.random() * 0.2)));
  
  // Generate mock comparable properties
  const comparables = Array(3).fill(0).map((_, i) => ({
    address: `${i + 100} Test St, Testville, TX 12345`,
    salePrice: Math.round(adjustedValue * (0.85 + Math.random() * 0.3)),
    saleDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    squareFeet: Math.round(squareFeet * (0.9 + Math.random() * 0.2)),
    bedrooms,
    bathrooms: Math.round(bathrooms * 10) / 10,
    similarity: Math.round(85 + Math.random() * 10)
  }));
  
  // Respond with mock data
  setTimeout(() => {
    res.json({
      predictedValue: adjustedValue,
      confidence: Math.round((75 + Math.random() * 20)) / 100,
      comparables,
      metadata: {
        modelVersion: '1.0.0',
        predictionId: uuidv4(),
        timestamp: new Date().toISOString()
      }
    });
  }, 500); // Simulate some processing time
});

// Distress predictor endpoint
app.post('/api/models/distress-predictor', (req, res) => {
  const { address } = req.body;
  console.log(`Distress prediction request for property: ${address}`);
  
  // Generate random signals based on property characteristics
  const signals = [];
  const signalOptions = [
    { type: 'TAX_LIEN', severity: 'HIGH', description: 'Property has unpaid tax liens' },
    { type: 'FORECLOSURE_RISK', severity: 'MEDIUM', description: 'Property shows early signs of foreclosure risk' },
    { type: 'DEFERRED_MAINTENANCE', severity: 'MEDIUM', description: 'Property may have maintenance issues' },
    { type: 'LONG_VACANCY', severity: 'LOW', description: 'Property may have been vacant for extended period' },
    { type: 'EXPIRED_LISTING', severity: 'LOW', description: 'Property had an expired listing in past 6 months' }
  ];
  
  // Randomly pick 0-3 signals
  const signalCount = Math.floor(Math.random() * 4);
  for (let i = 0; i < signalCount; i++) {
    const randomIndex = Math.floor(Math.random() * signalOptions.length);
    signals.push(signalOptions.splice(randomIndex, 1)[0]);
  }
  
  // Calculate overall score based on signals
  let distressScore = 0.2 + Math.random() * 0.3; // Base score between 0.2-0.5
  signals.forEach(signal => {
    if (signal.severity === 'HIGH') distressScore += 0.2;
    else if (signal.severity === 'MEDIUM') distressScore += 0.1;
    else distressScore += 0.05;
  });
  
  distressScore = Math.min(0.95, distressScore); // Cap at 0.95
  
  // Generate recommendations
  const recommendations = [];
  if (distressScore > 0.7) {
    recommendations.push('Immediate contact recommended - high distress detected');
    recommendations.push('Consider cash offer with flexible closing timeline');
  } else if (distressScore > 0.4) {
    recommendations.push('Follow up contact recommended - moderate distress detected');
    recommendations.push('Highlight quick close and no-repair sale options');
  } else {
    recommendations.push('Monitor property for changes in status');
  }
  
  // Respond with mock data
  setTimeout(() => {
    res.json({
      distressScore: Math.round(distressScore * 100) / 100,
      signals,
      confidence: Math.round((70 + Math.random() * 20)) / 100,
      recommendations
    });
  }, 400);
});

// Lead scoring endpoint
app.post('/api/models/lead-scoring', (req, res) => {
  const { address, taxStatus, occupancyStatus, estimatedEquity } = req.body;
  console.log(`Lead scoring request for property: ${address}`);
  
  // Generate factors that contribute to lead score
  const factors = [];
  
  // Tax status factor
  if (taxStatus === 'DELINQUENT') {
    factors.push({ factor: 'TAX_STATUS', impact: 'HIGH', description: 'Property has delinquent taxes' });
  } else if (taxStatus === 'PARTIAL') {
    factors.push({ factor: 'TAX_STATUS', impact: 'MEDIUM', description: 'Property has partially paid taxes' });
  }
  
  // Occupancy factor
  if (occupancyStatus === 'VACANT') {
    factors.push({ factor: 'OCCUPANCY', impact: 'HIGH', description: 'Property is vacant' });
  } else if (occupancyStatus === 'RENTER_OCCUPIED') {
    factors.push({ factor: 'OCCUPANCY', impact: 'MEDIUM', description: 'Property is renter occupied' });
  }
  
  // Equity factor
  if (estimatedEquity > 100000) {
    factors.push({ factor: 'EQUITY', impact: 'HIGH', description: 'Property has significant equity' });
  } else if (estimatedEquity > 50000) {
    factors.push({ factor: 'EQUITY', impact: 'MEDIUM', description: 'Property has moderate equity' });
  } else {
    factors.push({ factor: 'EQUITY', impact: 'LOW', description: 'Property has limited equity' });
  }
  
  // Calculate score based on factors
  let baseScore = 50 + Math.random() * 20;
  factors.forEach(factor => {
    if (factor.impact === 'HIGH') baseScore += 15;
    else if (factor.impact === 'MEDIUM') baseScore += 8;
    else baseScore += 3;
  });
  
  const score = Math.min(99, Math.round(baseScore));
  
  // Determine classification
  let classification;
  if (score >= 80) classification = 'HOT';
  else if (score >= 60) classification = 'WARM';
  else if (score >= 40) classification = 'LUKEWARM';
  else classification = 'COLD';
  
  // Generate recommendations
  const recommendations = [];
  if (classification === 'HOT') {
    recommendations.push('Immediate follow-up recommended');
    recommendations.push('Prepare competitive cash offer');
  } else if (classification === 'WARM') {
    recommendations.push('Follow up within 48 hours');
    recommendations.push('Highlight flexible purchase options');
  } else if (classification === 'LUKEWARM') {
    recommendations.push('Add to nurture campaign');
    recommendations.push('Follow up in 2 weeks');
  } else {
    recommendations.push('Add to long-term nurture list');
    recommendations.push('Re-evaluate in 60 days');
  }
  
  // Respond with mock data
  setTimeout(() => {
    res.json({
      score,
      classification,
      factors,
      confidence: Math.round((75 + Math.random() * 20)) / 100,
      recommendations
    });
  }, 300);
});

// Contact recommendation endpoint
app.post('/api/models/contact-recommendation', (req, res) => {
  const { name, phone, email } = req.body;
  console.log(`Contact recommendation request for: ${name}`);
  
  // Generate mock contact recommendations
  const contactMethods = ['PHONE', 'EMAIL', 'TEXT', 'DIRECT_MAIL', 'DOOR_KNOCK'];
  const recommendedMethod = contactMethods[Math.floor(Math.random() * 3)]; // Bias toward first 3 methods
  
  // Remove recommended method and shuffle remaining for alternatives
  const alternativeMethods = contactMethods
    .filter(method => method !== recommendedMethod)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  
  // Generate best times based on contact method
  const bestTimes = [];
  if (recommendedMethod === 'PHONE' || recommendedMethod === 'TEXT') {
    bestTimes.push('Weekdays between 5:00 PM and 8:00 PM');
    bestTimes.push('Saturday between 10:00 AM and 2:00 PM');
  } else if (recommendedMethod === 'EMAIL') {
    bestTimes.push('Tuesday or Thursday mornings');
    bestTimes.push('Sunday evenings');
  } else {
    bestTimes.push('Weekdays during business hours');
  }
  
  // Generate personalized message
  let personalizedMessage = '';
  switch (recommendedMethod) {
    case 'PHONE':
      personalizedMessage = `Hi ${name}, I'm reaching out because we specialize in helping homeowners in your area who might be interested in selling their property quickly without the hassle of repairs or listings.`;
      break;
    case 'EMAIL':
      personalizedMessage = `Subject: Quick Offer for Your Property\n\nHi ${name},\n\nI noticed you own the property at [ADDRESS] and wanted to see if you'd be interested in a no-obligation cash offer.`;
      break;
    case 'TEXT':
      personalizedMessage = `Hi ${name}, this is [YOUR NAME] with [COMPANY]. I'm interested in your property and would like to discuss making you a fair cash offer. Are you available for a quick call?`;
      break;
    default:
      personalizedMessage = `Hello ${name}, I'm reaching out about your property. We're investors in the area looking to make competitive offers.`;
  }
  
  // Respond with mock data
  setTimeout(() => {
    res.json({
      recommendedMethod,
      alternativeMethods,
      bestTimes,
      confidence: Math.round((80 + Math.random() * 15)) / 100,
      personalizedMessage
    });
  }, 350);
});

// Action recommendation endpoint
app.post('/api/models/action-recommendation', (req, res) => {
  const { address } = req.body;
  console.log(`Action recommendation request for property: ${address}`);
  
  // Generate mock action recommendations
  const actions = [
    {
      actionType: 'CONTACT_OWNER',
      urgency: 'HIGH',
      description: 'Reach out to property owner to gauge interest in selling'
    },
    {
      actionType: 'RESEARCH_PROPERTY',
      urgency: 'MEDIUM',
      description: 'Conduct more detailed property research including title search'
    },
    {
      actionType: 'PREPARE_OFFER',
      urgency: 'MEDIUM',
      description: 'Prepare preliminary cash offer based on current market analysis'
    },
    {
      actionType: 'DRIVE_BY',
      urgency: 'LOW',
      description: 'Visit property location to assess exterior condition'
    }
  ];
  
  // Shuffle and select 2-4 actions
  const shuffledActions = [...actions].sort(() => Math.random() - 0.5);
  const selectedActions = shuffledActions.slice(0, 2 + Math.floor(Math.random() * 3));
  
  // Set priority ranking
  const priorityRanking = selectedActions.map(action => action.actionType);
  
  // Generate expected outcomes
  const expectedOutcomes = {
    conversionProbability: Math.round((30 + Math.random() * 40)) / 100,
    estimatedTimeToClose: Math.round(30 + Math.random() * 60),
    potentialROI: Math.round((15 + Math.random() * 20)) / 100
  };
  
  // Respond with mock data
  setTimeout(() => {
    res.json({
      actions: selectedActions,
      priorityRanking,
      expectedOutcomes,
      confidence: Math.round((70 + Math.random() * 25)) / 100
    });
  }, 450);
});

// Feedback endpoint
app.post('/api/feedback', (req, res) => {
  console.log('Feedback received:', req.body);
  
  res.json({
    success: true,
    message: 'Feedback received successfully',
    feedbackId: uuidv4()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Mock ML server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/models/property-valuation');
  console.log('  POST /api/models/distress-predictor');
  console.log('  POST /api/models/lead-scoring');
  console.log('  POST /api/models/contact-recommendation');
  console.log('  POST /api/models/action-recommendation');
  console.log('  POST /api/feedback');
});
