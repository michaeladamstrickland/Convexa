// check-na-values.js
// Usage: node check-na-values.js <property-id>
import axios from 'axios';
const propertyId = process.argv[2] || '42116'; // Default to our test property

async function checkProperty(id) {
  try {
    console.log(`Fetching property details for ID ${id}...`);
    const response = await axios.get(`http://localhost:5002/api/attom/property/${id}/detail`);
    
    if (!response.data || !response.data.property) {
      console.error('No property object found in response');
      process.exit(1);
    }
    
    const property = response.data.property;
    
    // Count null and N/A values
    let nullCount = 0;
    let naCount = 0;
    const totalFields = Object.keys(property).length;
    const nullFields = [];
    const naFields = [];
    
    for (const [key, value] of Object.entries(property)) {
      if (value === null) {
        nullCount++;
        nullFields.push(key);
      } else if (value === 'N/A') {
        naCount++;
        naFields.push(key);
      }
    }
    
    // Calculate percentages
    const nullPercentage = Math.round((nullCount / totalFields) * 100);
    const naPercentage = Math.round((naCount / totalFields) * 100);
    const goodValues = totalFields - nullCount - naCount;
    const goodPercentage = Math.round((goodValues / totalFields) * 100);
    
    console.log('===== PROPERTY DATA QUALITY REPORT =====');
    console.log(`Total fields: ${totalFields}`);
    console.log(`Fields with values: ${goodValues} (${goodPercentage}%)`);
    console.log(`Null values: ${nullCount} (${nullPercentage}%)`);
    console.log(`"N/A" values: ${naCount} (${naPercentage}%)`);
    
    if (nullFields.length > 0) {
      console.log('\nFields with null values:');
      console.log(nullFields.join(', '));
    }
    
    if (naFields.length > 0) {
      console.log('\nFields with "N/A" values:');
      console.log(naFields.join(', '));
    }
    
    // Print a few sample fields to verify data
    console.log('\n===== SAMPLE FIELD VALUES =====');
    console.log(`Address: ${property.address}`);
    console.log(`City: ${property.city}, ${property.state} ${property.zipCode}`);
    console.log(`Property Type: ${property.propertyType}`);
    console.log(`Year Built: ${property.yearBuilt}`);
    console.log(`Square Feet: ${property.squareFeet}`);
    console.log(`Bedrooms: ${property.bedrooms}`);
    console.log(`Bathrooms: ${property.bathrooms}`);
    console.log(`Last Sale Price: ${property.lastSalePrice}`);
    console.log(`Last Sale Date: ${property.lastSaleDate}`);
    console.log(`Tax Assessment: ${property.taxAssessedValue}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the check
checkProperty(propertyId);
