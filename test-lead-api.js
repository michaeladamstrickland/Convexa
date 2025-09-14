/**
 * FlipTracker Lead Management API Tests
 * Run with: node test-lead-api.js
 */

const axios = require('axios');
const assert = require('assert').strict;

// Configuration
const API_URL = 'http://localhost:5001';

// Test data
const testLead = {
  address: '123 Test Street',
  city: 'Test City',
  state: 'TX',
  zipCode: '12345',
  ownerName: 'Test Owner',
  phoneNumber: '555-123-4567',
  email: 'test@example.com',
  status: 'New',
  leadSource: 'Test',
  propertyType: 'Single Family',
  notes: 'This is a test lead'
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const url = `${API_URL}${endpoint}`;
    const response = await axios({
      method,
      url,
      data,
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error(`Error in API call to ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Starting Lead Management API Tests');
  let createdLeadId;

  try {
    // Test 1: Health check
    console.log('\n📋 Test 1: Health check');
    const health = await apiCall('GET', '/health');
    console.log('Health check response:', health);
    assert(health.status === 'healthy', 'Health check failed');
    console.log('✅ Health check successful');

    // Test 2: Create a lead
    console.log('\n📋 Test 2: Create a lead');
    const createResponse = await apiCall('POST', '/api/leads', testLead);
    console.log('Created lead ID:', createResponse.id);
    assert(createResponse.address === testLead.address, 'Lead address does not match');
    assert(createResponse.city === testLead.city, 'Lead city does not match');
    createdLeadId = createResponse.id;
    console.log('✅ Lead created successfully');

    // Test 3: Get a lead
    console.log('\n📋 Test 3: Get a lead');
    const getResponse = await apiCall('GET', `/api/leads/${createdLeadId}`);
    console.log('Retrieved lead:', getResponse.id);
    assert(getResponse.address === testLead.address, 'Retrieved lead address does not match');
    console.log('✅ Lead retrieved successfully');

    // Test 4: Update a lead
    console.log('\n📋 Test 4: Update a lead');
    const updateData = { status: 'In Progress', notes: 'Updated test lead' };
    const updateResponse = await apiCall('PUT', `/api/leads/${createdLeadId}`, updateData);
    assert(updateResponse.status === 'In Progress', 'Lead status not updated');
    assert(updateResponse.notes === 'Updated test lead', 'Lead notes not updated');
    console.log('✅ Lead updated successfully');

    // Test 5: Add a tag to a lead
    console.log('\n📋 Test 5: Add a tag to a lead');
    const tagResponse = await apiCall('POST', `/api/leads/${createdLeadId}/tags`, { tag: 'test-tag' });
    assert(tagResponse.tags.includes('test-tag'), 'Tag not added to lead');
    console.log('✅ Tag added successfully');

    // Test 6: Add a communication to a lead
    console.log('\n📋 Test 6: Add a communication to a lead');
    const commData = {
      date: new Date().toISOString(),
      method: 'email',
      notes: 'Test communication'
    };
    const commResponse = await apiCall('POST', `/api/leads/${createdLeadId}/communications`, commData);
    assert(commResponse.method === 'email', 'Communication method does not match');
    console.log('✅ Communication added successfully');

    // Test 7: Get communications for a lead
    console.log('\n📋 Test 7: Get communications for a lead');
    const commsResponse = await apiCall('GET', `/api/leads/${createdLeadId}/communications`);
    assert(Array.isArray(commsResponse), 'Communications response is not an array');
    assert(commsResponse.length > 0, 'No communications returned');
    console.log('✅ Communications retrieved successfully');

    // Test 8: Remove a tag from a lead
    console.log('\n📋 Test 8: Remove a tag from a lead');
    const removeTagResponse = await apiCall('DELETE', `/api/leads/${createdLeadId}/tags/test-tag`);
    assert(!removeTagResponse.tags.includes('test-tag'), 'Tag not removed from lead');
    console.log('✅ Tag removed successfully');

    // Test 9: Delete a lead
    console.log('\n📋 Test 9: Delete a lead');
    const deleteResponse = await apiCall('DELETE', `/api/leads/${createdLeadId}`);
    console.log('Delete response:', deleteResponse.message);
    
    // Verify deletion
    try {
      await apiCall('GET', `/api/leads/${createdLeadId}`);
      assert(false, 'Lead not deleted properly');
    } catch (error) {
      assert(error.response.status === 404, 'Expected 404 error for deleted lead');
      console.log('✅ Lead deleted successfully');
    }

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Clean up if we created a lead but tests failed
    if (createdLeadId) {
      try {
        await apiCall('DELETE', `/api/leads/${createdLeadId}`);
        console.log(`🧹 Cleaned up test lead ${createdLeadId}`);
      } catch (cleanupError) {
        console.error('Error cleaning up test lead:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the tests
runTests();
