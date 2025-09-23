import fs from 'fs';
import path from 'path';

const PII_PATTERNS_FILE = path.resolve(process.cwd(), 'ops', 'PII', 'patterns.txt');
let redactionRegexes: { regex: RegExp; placeholder: string }[] = [];

// Function to load and compile regex patterns from the file
function loadRedactionPatterns() {
  try {
    const patternsContent = fs.readFileSync(PII_PATTERNS_FILE, 'utf8');
    const lines = patternsContent.split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && line.startsWith('`') && line.endsWith('`'));

    redactionRegexes = lines.map(pattern => {
      // Remove backticks and then determine placeholder
      const cleanPattern = pattern.slice(1, -1); // Remove leading and trailing backticks
      let placeholder = '[REDACTED]';
      if (cleanPattern.includes('@')) placeholder = '[REDACTED_EMAIL]';
      else if (cleanPattern.includes('phone')) placeholder = '[REDACTED_PHONE]';
      else if (cleanPattern.includes('SSN')) placeholder = '[REDACTED_SSN]';
      else if (cleanPattern.includes('Credit Card')) placeholder = '[REDACTED_CC]';
      else if (cleanPattern.includes('IP Address')) placeholder = '[REDACTED_IP]';
      else if (cleanPattern.includes('API Key') || cleanPattern.includes('secret') || cleanPattern.includes('token')) placeholder = '[REDACTED_SECRET]';
      else if (cleanPattern.includes('lead_[0-9a-f]')) placeholder = '[REDACTED_LEAD_ID]';
      else if (cleanPattern.includes('job_[0-9a-f]')) placeholder = '[REDACTED_JOB_ID]';

      return { regex: new RegExp(cleanPattern, 'gi'), placeholder };
    });
    console.log(`Loaded ${redactionRegexes.length} PII redaction patterns.`);
  } catch (error) {
    console.error('Error loading PII redaction patterns:', error);
    redactionRegexes = []; // Ensure it's empty on error
  }
}

// Load patterns on module initialization
loadRedactionPatterns();

// Function to redact PII from a string
export function redactPII(text: string): string {
  let redactedText = text;
  for (const { regex, placeholder } of redactionRegexes) {
    redactedText = redactedText.replace(regex, placeholder);
  }
  return redactedText;
}

// Function to redact PII from an object (e.g., log metadata)
export function redactPIIInObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIInObject(item));
  }

  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        newObj[key] = redactPII(value);
      } else if (typeof value === 'object') {
        newObj[key] = redactPIIInObject(value);
      } else {
        newObj[key] = value;
      }
    }
  }
  return newObj;
}
