import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Lazily initialize OpenAI client so the server can start without an API key in dev
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

export interface LeadAnalysis {
  motivationScore: number; // 0-100
  dealScore: number; // 0-100
  dealPotential: 'flip' | 'wholesale' | 'rental' | 'pass';
  motivationFactors: string[];
  distressSignals: string[];
  profitEstimate: number;
  summary: string;
  confidence: number; // 0-100
}

export interface CallAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  motivationScore: number;
  outcome: 'interested' | 'not_interested' | 'callback' | 'no_answer';
  summary: string;
  keyPoints: string[];
  followUpDate?: Date;
  recommendedAction: string;
}

export class AIService {
  /**
   * Analyze a lead's potential based on property and owner data
   */
  async analyzeLeadPotential(leadData: {
    propertyAddress: string;
    listPrice?: number;
    arv?: number;
    estimatedRepairs?: number;
    equity?: number;
    equityPercent?: number;
    timeOnMarket?: number;
    priceReductions?: number;
    ownerName?: string;
    isAbsenteeOwner?: boolean;
    propertyType?: string;
    yearBuilt?: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    tags?: string[];
  }): Promise<LeadAnalysis> {
    try {
      const prompt = this.buildLeadAnalysisPrompt(leadData);
      
      const client = getOpenAIClient();
      if (!client) {
        logger.warn('OPENAI_API_KEY not set - returning default lead analysis');
        return this.getDefaultLeadAnalysis();
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert real estate investor and deal analyzer. Analyze properties for flip, wholesale, and rental potential. 
            Provide detailed scoring and recommendations based on market data, motivation indicators, and profit potential.
            
            Respond with a valid JSON object containing:
            - motivationScore (0-100): How motivated the seller likely is
            - dealScore (0-100): Overall deal quality
            - dealPotential: "flip", "wholesale", "rental", or "pass"
            - motivationFactors: Array of detected motivation indicators
            - distressSignals: Array of distress signals found
            - profitEstimate: Estimated profit potential in dollars
            - summary: Brief analysis summary
            - confidence: Confidence in analysis (0-100)`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content) as LeadAnalysis;
      
      // Validate the response structure
      this.validateLeadAnalysis(analysis);
      
      logger.info(`AI analysis completed for ${leadData.propertyAddress}`);
      return analysis;

    } catch (error) {
      logger.error('Error in AI lead analysis:', error);
      
      // Return default analysis if AI fails
      return this.getDefaultLeadAnalysis();
    }
  }

  /**
   * Analyze a call transcript for motivation and next steps
   */
  async analyzeCallTranscript(
    transcript: string,
    leadContext?: {
      propertyAddress: string;
      listPrice?: number;
      ownerName?: string;
    }
  ): Promise<CallAnalysis> {
    try {
      const prompt = this.buildCallAnalysisPrompt(transcript, leadContext);
      
      const client = getOpenAIClient();
      if (!client) {
        logger.warn('OPENAI_API_KEY not set - returning default call analysis');
        return this.getDefaultCallAnalysis();
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert real estate sales coach analyzing phone calls for motivation and next steps.
            
            Respond with a valid JSON object containing:
            - sentiment: "positive", "neutral", or "negative"
            - motivationScore: Seller motivation level (0-100)
            - outcome: "interested", "not_interested", "callback", or "no_answer"
            - summary: Brief call summary
            - keyPoints: Array of important discussion points
            - followUpDate: ISO date string if follow-up needed (optional)
            - recommendedAction: Next step recommendation`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content) as CallAnalysis;
      
      // Convert followUpDate string to Date if provided
      if (analysis.followUpDate) {
        analysis.followUpDate = new Date(analysis.followUpDate as unknown as string);
      }
      
      logger.info('AI call analysis completed');
      return analysis;

    } catch (error) {
      logger.error('Error in AI call analysis:', error);
      
      // Return default analysis if AI fails
      return this.getDefaultCallAnalysis();
    }
  }

  /**
   * Generate a personalized call script for a lead
   */
  async generateCallScript(leadData: {
    ownerName?: string;
    propertyAddress: string;
    motivationFactors?: string[];
    propertyType?: string;
    timeOnMarket?: number;
  }): Promise<string> {
    try {
      const prompt = `Generate a personalized call script for this real estate lead:
      
      Owner: ${leadData.ownerName || 'Property Owner'}
      Property: ${leadData.propertyAddress}
      Property Type: ${leadData.propertyType || 'Single Family'}
      Time on Market: ${leadData.timeOnMarket || 'Unknown'} days
      Motivation Factors: ${leadData.motivationFactors?.join(', ') || 'None identified'}
      
      Create a warm, professional script that:
      1. Introduces yourself as a local real estate investor
      2. References specific property details
      3. Addresses potential motivation factors
      4. Asks open-ended questions about their situation
      5. Proposes a quick property evaluation
      
      Keep it conversational and under 200 words.`;

      const client = getOpenAIClient();
      if (!client) {
        logger.warn('OPENAI_API_KEY not set - returning default call script');
        return this.getDefaultCallScript(leadData);
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert real estate investor who writes compelling, personalized call scripts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 400,
      });

      return response.choices[0]?.message?.content || this.getDefaultCallScript(leadData);

    } catch (error) {
      logger.error('Error generating call script:', error);
      return this.getDefaultCallScript(leadData);
    }
  }

  private buildLeadAnalysisPrompt(leadData: any): string {
    return `Analyze this real estate lead for investment potential:

PROPERTY DETAILS:
- Address: ${leadData.propertyAddress}
- List Price: $${leadData.listPrice?.toLocaleString() || 'Unknown'}
- ARV: $${leadData.arv?.toLocaleString() || 'Unknown'}
- Estimated Repairs: $${leadData.estimatedRepairs?.toLocaleString() || 'Unknown'}
- Equity: $${leadData.equity?.toLocaleString() || 'Unknown'} (${leadData.equityPercent || 'Unknown'}%)
- Time on Market: ${leadData.timeOnMarket || 'Unknown'} days
- Price Reductions: ${leadData.priceReductions || 0}
- Property Type: ${leadData.propertyType || 'Unknown'}
- Year Built: ${leadData.yearBuilt || 'Unknown'}
- Size: ${leadData.bedrooms || 'Unknown'} bed, ${leadData.bathrooms || 'Unknown'} bath, ${leadData.squareFootage || 'Unknown'} sqft

OWNER DETAILS:
- Owner: ${leadData.ownerName || 'Unknown'}
- Absentee Owner: ${leadData.isAbsenteeOwner ? 'Yes' : 'No'}
- Tags: ${leadData.tags?.join(', ') || 'None'}

Analyze motivation indicators, deal potential, and provide investment recommendations.`;
  }

  private buildCallAnalysisPrompt(transcript: string, context?: any): string {
    let prompt = `Analyze this real estate investor phone call transcript:

TRANSCRIPT:
${transcript}`;

    if (context) {
      prompt += `

LEAD CONTEXT:
- Property: ${context.propertyAddress}
- List Price: $${context.listPrice?.toLocaleString() || 'Unknown'}
- Owner: ${context.ownerName || 'Unknown'}`;
    }

    prompt += `

Analyze the conversation for seller motivation, interest level, and recommend next steps.`;

    return prompt;
  }

  private validateLeadAnalysis(analysis: LeadAnalysis): void {
    if (typeof analysis.motivationScore !== 'number' || 
        analysis.motivationScore < 0 || 
        analysis.motivationScore > 100) {
      throw new Error('Invalid motivationScore');
    }

    if (!['flip', 'wholesale', 'rental', 'pass'].includes(analysis.dealPotential)) {
      throw new Error('Invalid dealPotential');
    }

    if (!Array.isArray(analysis.motivationFactors)) {
      throw new Error('Invalid motivationFactors');
    }
  }

  private getDefaultLeadAnalysis(): LeadAnalysis {
    return {
      motivationScore: 50,
      dealScore: 50,
      dealPotential: 'pass',
      motivationFactors: ['Requires further analysis'],
      distressSignals: [],
      profitEstimate: 0,
      summary: 'AI analysis unavailable. Manual review required.',
      confidence: 0,
    };
  }

  private getDefaultCallAnalysis(): CallAnalysis {
    return {
      sentiment: 'neutral',
      motivationScore: 50,
      outcome: 'no_answer',
      summary: 'AI analysis unavailable. Manual review required.',
      keyPoints: [],
      recommendedAction: 'Schedule follow-up call',
    };
  }

  private getDefaultCallScript(leadData: any): string {
    return `Hi ${leadData.ownerName || 'there'}, this is [Your Name] and I'm a local real estate investor. 

I noticed your property at ${leadData.propertyAddress} and I'm interested in learning more about your situation. I work with homeowners who need to sell quickly for various reasons.

Would you be open to a quick conversation about your property? I might be able to make you a fair cash offer if it's a good fit.

What's your timeline for selling, and are there any particular challenges you're facing with the property?`;
  }
}

// Export singleton instance
export const aiService = new AIService();
