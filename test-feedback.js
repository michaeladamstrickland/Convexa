/**
 * Test script to simulate lead feedback
 * 
 * This script can be used to test the lead temperature feedback
 * functionality by sending feedback to random leads
 */

const axios = require('axios');
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Random values from array
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate random feedback
const generateFeedback = () => {
  const labels = ['good', 'bad'];
  return randomFrom(labels);
};

// Get leads
const getLeads = async (limit = 5) => {
  try {
    const response = await axios.post(`${API_URL}/api/search`, {
      limit,
      page: 1,
    });
    
    return response.data.leads;
  } catch (error) {
    console.error('Failed to fetch leads:', error.message);
    return [];
  }
};

// Submit feedback for a lead
const submitFeedback = async (leadId, label) => {
  try {
    console.log(`Submitting ${label} feedback for lead ${leadId}...`);
    const response = await axios.post(`${API_URL}/api/leads/${leadId}/feedback`, { label });
    
    return response.data;
  } catch (error) {
    console.error(`Failed to submit feedback for lead ${leadId}:`, error.message);
    return null;
  }
};

// Score a lead
const scoreLead = async (leadId) => {
  try {
    console.log(`Scoring lead ${leadId}...`);
    const response = await axios.post(`${API_URL}/api/leads/${leadId}/score`);
    
    return response.data;
  } catch (error) {
    console.error(`Failed to score lead ${leadId}:`, error.message);
    return null;
  }
};

// Main function
const testFeedback = async () => {
  console.log('🔥 Testing lead feedback functionality');
  
  // Get some leads
  console.log('Fetching leads...');
  const leads = await getLeads(10);
  
  if (leads.length === 0) {
    console.error('No leads found to test with!');
    return;
  }
  
  console.log(`Found ${leads.length} leads to test with.`);
  
  // Submit random feedback for each lead
  for (const lead of leads) {
    const label = generateFeedback();
    const result = await submitFeedback(lead.id, label);
    
    if (result) {
      console.log(`✅ Feedback submitted for lead ${lead.id}: ${label}`);
      
      // Score the lead
      const scoreResult = await scoreLead(lead.id);
      
      if (scoreResult) {
        console.log(`📊 Lead scored: ${scoreResult.lead.aiScore}, temperature: ${scoreResult.lead.temperatureTag}`);
      }
    }
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('🎉 Testing complete!');
};

// Run the test
testFeedback().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
