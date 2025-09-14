// LEAD CONTACT CAMPAIGN SYSTEM
// Automated calling and follow-up system for real estate leads

import { DatabaseService } from './src/services/databaseService';
import { logger } from './src/utils/logger';

interface ContactScript {
  leadType: string;
  openingLine: string;
  painPoints: string[];
  valueProposition: string;
  objectionHandlers: Record<string, string>;
  closingQuestions: string[];
}

export class LeadContactSystem {
  private db: DatabaseService;
  private contactScripts: Record<string, ContactScript>;

  constructor() {
    this.db = new DatabaseService();
    this.initializeContactScripts();
  }

  private initializeContactScripts() {
    this.contactScripts = {
      probate_intelligence: {
        leadType: 'Probate',
        openingLine: "Hi {name}, I specialize in helping families who've inherited property navigate their options. I understand you may have recently inherited a property at {address}?",
        painPoints: [
          "Dealing with estate settlement stress",
          "Multiple heirs with different opinions",
          "Property maintenance burden",
          "Tax implications of inherited property",
          "Geographic distance from property"
        ],
        valueProposition: "I can close in 7-14 days, handle all paperwork, and often pay cash above market value to avoid realtor fees and repairs.",
        objectionHandlers: {
          "not_interested": "I understand. Many families feel overwhelmed. What if I could remove all the hassle and close in just 2 weeks?",
          "need_to_think": "Of course. What specific concerns do you have? I've helped dozens of families in similar situations.",
          "too_low_price": "I appreciate that. My offers are typically 85-90% of market value because I buy as-is and close fast. What would make this work for your family?"
        },
        closingQuestions: [
          "When would be convenient for me to take a quick look at the property?",
          "Are there any specific timeframes you're working with for the estate?",
          "What would need to happen for this to be a win-win situation?"
        ]
      },
      
      fsbo_tracking: {
        leadType: 'FSBO',
        openingLine: "Hi {name}, I saw your property at {address} is for sale by owner. I'm a local investor - are you looking for a quick, cash closing?",
        painPoints: [
          "Showing fatigue and scheduling conflicts",
          "Financing contingencies and delays",
          "Repair requests after inspection",
          "Realtor pressure and commissions",
          "Time sensitivity (job relocation, divorce, etc.)"
        ],
        valueProposition: "I can close in 10 days, all cash, no inspections, no repairs needed, and no realtor commissions.",
        objectionHandlers: {
          "price_too_low": "I understand. Since I'm buying cash and as-is, my offers are typically 10-15% below retail. Would a guaranteed 10-day closing make up for that difference?",
          "already_have_buyer": "That's great! Backup offers are smart. What if I could guarantee closing even if your current buyer falls through?",
          "want_retail_price": "I completely understand wanting top dollar. Most FSBO sellers do get retail eventually. What's your timeline if it takes 3-6 months?"
        },
        closingQuestions: [
          "What's driving your timeline for selling?",
          "How important is certainty versus maximizing price?",
          "When could I swing by for a 15-minute walkthrough?"
        ]
      },

      code_violation_tracking: {
        leadType: 'Code Violations',
        openingLine: "Hi {name}, I help property owners resolve code enforcement issues quickly. I understand you may be dealing with violations at {address}?",
        painPoints: [
          "Mounting legal pressure and court dates",
          "Expensive repair estimates",
          "Contractor coordination stress",
          "Potential liens and fines",
          "Property becoming financial burden"
        ],
        valueProposition: "I buy houses with code issues as-is, handle all violation resolution, and can close before your court date.",
        objectionHandlers: {
          "can_fix_myself": "That's great if you have the time and money. What's your budget and timeline for repairs? I might be able to save you the hassle.",
          "violations_not_serious": "I understand. Even minor violations can snowball. What if I could take this completely off your plate for a fair price?",
          "need_higher_price": "I get it. Since I'm taking on significant repair costs and legal issues, my offers reflect that risk. What would make this worthwhile for you?"
        },
        closingQuestions: [
          "When is your next court date or deadline?",
          "How much are contractors estimating for repairs?",
          "What would need to happen to make this a relief rather than a burden?"
        ]
      },

      tax_delinquency: {
        leadType: 'Tax Delinquent',
        openingLine: "Hi {name}, I help property owners avoid foreclosure due to tax issues. I believe you own the property at {address}?",
        painPoints: [
          "Escalating tax debt and penalties",
          "Foreclosure timeline pressure",
          "Difficulty catching up on payments",
          "Property becoming unaffordable",
          "Credit score concerns"
        ],
        valueProposition: "I can pay off all back taxes, stop the foreclosure process, and still put cash in your pocket.",
        objectionHandlers: {
          "can_catch_up": "That's good to hear. What's your plan for catching up? I might be able to provide a safety net if that doesn't work out.",
          "not_that_behind": "I understand. Tax situations can change quickly. What if I could guarantee to solve this completely today?",
          "family_property": "I completely respect that. Sometimes selling to an investor who'll fix it up is the best way to honor a family property."
        },
        closingQuestions: [
          "How much time do you have before the tax sale?",
          "What would it mean to have this completely resolved?",
          "Is there a number that would make this make sense for everyone?"
        ]
      },

      expired_listings: {
        leadType: 'Expired Listing',
        openingLine: "Hi {name}, I noticed your listing at {address} recently expired. Are you still looking to sell?",
        painPoints: [
          "Listing frustration and showing fatigue",
          "Overpricing or market timing issues",
          "Realtor relationship disappointment",
          "Carrying costs while vacant",
          "Changed circumstances or urgency"
        ],
        valueProposition: "I can eliminate all the listing hassles - no showings, no commissions, no repairs, and close on your timeline.",
        objectionHandlers: {
          "relisting_soon": "That makes sense. What are you doing differently this time? I might be a good backup plan if the market doesn't cooperate.",
          "price_was_fine": "The market can be tricky. What if I could get you close to your listing price but guarantee the closing?",
          "just_testing_market": "Smart approach. Since you know what the market said, would a guaranteed sale at a slight discount interest you?"
        },
        closingQuestions: [
          "What was most frustrating about the listing process?",
          "How important is timing versus maximizing price now?",
          "What would make you feel confident about a sale?"
        ]
      },

      high_equity: {
        leadType: 'High Equity',
        openingLine: "Hi {name}, I'm reaching out to property owners in your area. I specialize in helping people unlock their property equity quickly. Do you own {address}?",
        painPoints: [
          "Property equity tied up",
          "Maintenance and management burden",
          "Market timing uncertainty",
          "Portfolio consolidation needs",
          "Capital access for other investments"
        ],
        valueProposition: "I can unlock your equity in 2 weeks with a cash purchase, letting you redeploy capital immediately.",
        objectionHandlers: {
          "not_selling": "I understand. I work with many investors who aren't actively selling. What if the right opportunity came along?",
          "market_going_up": "You might be right. What if I could offer you a way to profit from appreciation while eliminating the headaches?",
          "sentimental_value": "I completely respect that. Sometimes keeping the memories while freeing up the capital makes the most sense."
        },
        closingQuestions: [
          "What would you do with immediate liquidity from this property?",
          "How important is eliminating property management stress?",
          "Is there a number that would make this compelling?"
        ]
      },

      absentee_owner: {
        leadType: 'Absentee Owner',
        openingLine: "Hi {name}, I help out-of-state property owners avoid the headaches of long-distance management. I believe you own property at {address} in Phoenix?",
        painPoints: [
          "Long-distance management challenges",
          "Tenant and maintenance coordination",
          "Property management company fees",
          "Vacant property security concerns",
          "Market unfamiliarity from distance"
        ],
        valueProposition: "I can eliminate all the long-distance headaches with a cash purchase, no repairs needed, and handle everything locally.",
        objectionHandlers: {
          "property_manager_handles": "That's smart. How's that working cost-wise? What if you could eliminate those fees and get your equity out?",
          "good_rental_income": "Rental income is great when it works. What happens when you have vacancy or major repairs from {distance} away?",
          "inherited_recently": "I understand that's emotional. Sometimes honoring family by getting fair value and eliminating stress makes sense."
        },
        closingQuestions: [
          "How often do property issues interrupt your day?",
          "What would it mean to have this completely off your plate?",
          "Are there other investments closer to home that interest you?"
        ]
      }
    };
  }

  /**
   * Generate contact script for a specific lead
   */
  generateContactScript(lead: any): string {
    const script = this.contactScripts[lead.source_type];
    if (!script) {
      return this.generateGenericScript(lead);
    }

    const personalizedScript = `
📞 CONTACT SCRIPT FOR: ${lead.owner_name}
🏠 Property: ${lead.address}
🎯 Lead Type: ${script.leadType}
📊 Score: ${lead.lead_score}/100

═══════════════════════════════════════════════

🗣️  OPENING (Warm & Professional):
"${script.openingLine
  .replace('{name}', lead.owner_name?.split(' ')[0] || 'there')
  .replace('{address}', lead.address)}"

💡 PAIN POINTS TO IDENTIFY:
${script.painPoints.map(point => `• ${point}`).join('\n')}

🎯 VALUE PROPOSITION:
"${script.valueProposition}"

🛡️  OBJECTION HANDLERS:
${Object.entries(script.objectionHandlers)
  .map(([objection, response]) => `• ${objection.toUpperCase()}: "${response}"`)
  .join('\n')}

❓ CLOSING QUESTIONS:
${script.closingQuestions.map(q => `• ${q}`).join('\n')}

💰 OFFER RANGE: $${Math.round(lead.estimated_value * 0.75).toLocaleString()} - $${Math.round(lead.estimated_value * 0.85).toLocaleString()}
⏰ BEST TIME TO CALL: Weekdays 10AM-7PM, Saturday 10AM-4PM

═══════════════════════════════════════════════
`;

    return personalizedScript;
  }

  private generateGenericScript(lead: any): string {
    return `
📞 GENERIC CONTACT SCRIPT FOR: ${lead.owner_name}
🏠 Property: ${lead.address}
📊 Score: ${lead.lead_score}/100

"Hi ${lead.owner_name?.split(' ')[0] || 'there'}, I'm a local real estate investor. 
I help property owners in situations where they need to sell quickly. 
I believe you own the property at ${lead.address}?"

💰 Offer Range: $${Math.round(lead.estimated_value * 0.75).toLocaleString()} - $${Math.round(lead.estimated_value * 0.85).toLocaleString()}
`;
  }

  /**
   * Get today's calling list prioritized by lead score
   */
  async getTodaysCallingList(): Promise<void> {
    console.log('📞 TODAY\'S CALLING LIST - MAKE MONEY NOW!');
    console.log('=' .repeat(50));

    const leads = await this.db.getLeads();
    const callableLeads = leads
      .filter(lead => lead.phone && lead.phone !== 'Need skip trace')
      .sort((a, b) => b.lead_score - a.lead_score);

    for (let i = 0; i < callableLeads.length && i < 8; i++) {
      const lead = callableLeads[i];
      const priority = i < 3 ? '🔥 HIGH PRIORITY' : i < 6 ? '⚡ MEDIUM PRIORITY' : '📞 FOLLOW UP';
      
      console.log(`\n${priority}`);
      console.log(`📱 ${lead.phone} - ${lead.owner_name}`);
      console.log(`🏠 ${lead.address}`);
      console.log(`📊 Score: ${lead.lead_score}/100 | 💰 Value: $${lead.estimated_value?.toLocaleString()}`);
      console.log(`🎯 Type: ${lead.source_type.replace('_', ' ').toUpperCase()}`);
      if (lead.notes) console.log(`📝 ${lead.notes}`);
    }

    console.log('\n💡 PRO TIP: Start with highest scores and probate leads!');
  }

  /**
   * Generate contact script for specific lead by address
   */
  async getContactScript(address: string): Promise<void> {
    const lead = await this.db.getLeadByAddress(address);
    
    if (!lead) {
      console.log(`❌ Lead not found for address: ${address}`);
      return;
    }

    const script = this.generateContactScript(lead);
    console.log(script);
  }

  /**
   * Track call result and update lead
   */
  async recordCallResult(address: string, result: string, notes?: string): Promise<void> {
    const lead = await this.db.getLeadByAddress(address);
    
    if (!lead) {
      console.log(`❌ Lead not found for address: ${address}`);
      return;
    }

    const statusMap: Record<string, string> = {
      'answered': 'contacted',
      'voicemail': 'voicemail',
      'no_answer': 'attempted',
      'interested': 'hot',
      'not_interested': 'cold',
      'appointment': 'appointment',
      'deal': 'contract'
    };

    const newStatus = statusMap[result] || 'attempted';
    const updatedNotes = notes ? `${lead.notes || ''}\nCall ${new Date().toLocaleDateString()}: ${notes}` : lead.notes;

    await this.db.updateLeadStatus(lead.id, newStatus, updatedNotes);
    
    console.log(`✅ Updated lead: ${lead.owner_name} - Status: ${newStatus}`);
    if (notes) console.log(`📝 Notes: ${notes}`);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const contactSystem = new LeadContactSystem();

  if (args.length === 0) {
    await contactSystem.getTodaysCallingList();
  } else if (args[0] === 'script' && args[1]) {
    await contactSystem.getContactScript(args[1]);
  } else if (args[0] === 'record' && args[1] && args[2]) {
    await contactSystem.recordCallResult(args[1], args[2], args[3]);
  } else {
    console.log('Usage:');
    console.log('  tsx contact-system.ts                          # Get today\'s calling list');
    console.log('  tsx contact-system.ts script "address"         # Get contact script for address');
    console.log('  tsx contact-system.ts record "address" result "notes"  # Record call result');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
