/**
 * Phone number utilities for standardization, formatting, and validation
 */

/**
 * Normalize a phone number to E.164 format (e.g., +14155552671)
 * @param {string} phoneNumber - The phone number to normalize
 * @param {string} defaultCountry - Default country code (default: 'US')
 * @returns {string|null} - E.164 formatted phone number or null if invalid
 */
function normalizePhoneNumber(phoneNumber, defaultCountry = 'US') {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters
  let digits = phoneNumber.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.length === 10) {
    // Standard US 10-digit number
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length > 11) {
    // Try to parse international number
    // This is simplified; a real implementation would use a library like libphonenumber
    return `+${digits}`;
  }
  
  // Return null for unparseable numbers
  return null;
}

/**
 * Format a phone number for display (e.g., (415) 555-2671)
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number for display
 */
function formatPhoneForDisplay(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length > 11) {
    // International format
    return `+${digits}`;
  }
  
  // Return original if we can't format it
  return phoneNumber;
}

/**
 * Check if a phone number is valid
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber) return false;
  
  // Simple validation: check if we get a non-null result from normalization
  return normalizePhoneNumber(phoneNumber) !== null;
}

/**
 * Check if a number should be considered a mobile phone
 * @param {string} phoneType - The phone type from the API
 * @returns {boolean} - Whether the phone is likely a mobile
 */
function isMobilePhone(phoneType) {
  if (!phoneType) return false;
  
  const type = phoneType.toLowerCase();
  return type.includes('mobile') || 
         type.includes('cell') || 
         type.includes('wireless');
}

/**
 * Determine if the current time is within quiet hours for a given timezone
 * @param {string} timezone - Timezone identifier (e.g., 'America/Los_Angeles')
 * @returns {boolean} - Whether it's currently quiet hours in the timezone
 */
function isQuietHours(timezone = 'America/New_York') {
  try {
    // Get current hour in the specified timezone
    const options = { timeZone: timezone, hour: 'numeric', hour12: false };
    const currentHour = parseInt(new Date().toLocaleString('en-US', options));
    
    // Define quiet hours (9 PM to 9 AM)
    return currentHour < 9 || currentHour >= 21;
  } catch (error) {
    console.error(`Error checking quiet hours: ${error.message}`);
    // Default to safe behavior - assume it is quiet hours
    return true;
  }
}

export {
  normalizePhoneNumber,
  formatPhoneForDisplay,
  isValidPhoneNumber,
  isMobilePhone,
  isQuietHours
};
