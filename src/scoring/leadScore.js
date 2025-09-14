/**
 * leadScore.js
 * Logic for scoring leads based on distress signals and other factors
 */

/**
 * Score a property lead based on various factors
 * @param {Object} lead - Lead object with property data
 * @returns {number} - Score from 0-100
 */
function scoreLead(lead) {
  if (!lead) return 0;
  
  let score = 0;

  // Distress signals (big weight)
  const signals = new Set(lead.distressSignals || []);
  if (signals.has("PROBATE")) score += 25;
  if (signals.has("CODE_VIOLATION")) score += 15;
  if (signals.has("TAX_DELINQUENT")) score += 15;
  if (signals.has("PRE_FORECLOSURE")) score += 20;
  if (signals.has("AUCTION")) score += 18;
  if (signals.has("FSBO")) score += 10;
  if (signals.has("EVICTION")) score += 12;

  // Equity heuristic
  if (lead.avm && lead.lastSale?.amount) {
    const equity = lead.avm - lead.lastSale.amount;
    const equityPercent = equity / Math.max(lead.avm, 1);
    
    if (equityPercent > 0.5) score += 20;
    else if (equityPercent > 0.3) score += 12;
    else if (equityPercent > 0.15) score += 6;
  }

  // Owner-occupied vs absentee
  const ownerMailingZip = lead.ownerMailingZip || 
    (lead.ownerInfo && lead.ownerInfo.mailingAddress && lead.ownerInfo.mailingAddress.zip);
  
  if (ownerMailingZip && lead.address && lead.address.zip && 
      ownerMailingZip !== lead.address.zip) {
    score += 10; // absentee owner
  }

  // Freshness
  if (lead.lastEventDate) {
    const days = (Date.now() - new Date(lead.lastEventDate).getTime()) / 86400000;
    if (days <= 7) score += 10;
    else if (days <= 30) score += 6;
  }

  // Contact information
  if (lead.contacts && lead.contacts.length) {
    // Higher score if we have both phone and email
    const hasPhone = lead.contacts.some(c => c.type === 'phone');
    const hasEmail = lead.contacts.some(c => c.type === 'email');
    
    if (hasPhone && hasEmail) score += 8;
    else if (hasPhone) score += 5;
    else if (hasEmail) score += 3;
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

/**
 * Determine the temperature category based on score
 * @param {number} score - Lead score (0-100)
 * @returns {string} - Temperature category
 */
function temperature(score) {
  if (score >= 80) return "On Fire";
  if (score >= 60) return "Hot";
  if (score >= 35) return "Warm";
  return "Dead";
}

module.exports = { 
  scoreLead, 
  temperature 
};
