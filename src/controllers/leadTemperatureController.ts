import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { mapScoreToTemperature, calculateHeuristicScore } from '../utils/temperatureUtils';

// Initialize Prisma client
const prisma = new PrismaClient();

// Need to generate the client again to include our new fields
// For now, let's cast to any where needed

/**
 * Controller for lead feedback
 */
export async function handleLeadFeedback(req: Request, res: Response) {
  const { id } = req.params;
  const { label } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Lead ID is required' });
  }
  
  if (!label || (label !== 'good' && label !== 'bad')) {
    return res.status(400).json({ error: 'Feedback label must be "good" or "bad"' });
  }
  
  try {
    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Cast to any to access the new fields that TypeScript doesn't know about yet
    const typedLead = lead as any;
    
    // Update the feedback count based on label
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        feedback_good: label === 'good' ? (typedLead.feedback_good || 0) + 1 : (typedLead.feedback_good || 0),
        feedback_bad: label === 'bad' ? (typedLead.feedback_bad || 0) + 1 : (typedLead.feedback_bad || 0)
      } as any
    });
    
    return res.json({
      success: true,
      lead: updatedLead
    });
  } catch (error) {
    console.error('Error updating lead feedback:', error);
    return res.status(500).json({ error: 'Failed to update lead feedback' });
  }
}

/**
 * Controller for scoring a lead
 */
export async function handleLeadScoring(req: Request, res: Response) {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: 'Lead ID is required' });
  }
  
  try {
    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Prepare lead data for scoring
    const scoringData = {
      motivation_score: lead.motivation_score,
      equity: lead.equity || undefined,
      estimated_value: lead.estimated_value || undefined,
      is_probate: lead.is_probate,
      is_vacant: lead.is_vacant,
      tax_debt: lead.tax_debt,
      violations: lead.violations,
      days_on_market: lead.days_on_market || undefined
    };
    
    // Calculate score (use OpenAI if key is available, otherwise use heuristic)
    let aiScore: number;
    const openAiKey = process.env.OPENAI_API_KEY;
    
    if (openAiKey && openAiKey !== 'dummy_key_for_testing') {
      // Use OpenAI for scoring
      try {
        aiScore = await calculateAiScore(scoringData);
      } catch (error) {
        console.error('Error calculating AI score with OpenAI:', error);
        // Fallback to heuristic if OpenAI fails
        aiScore = calculateHeuristicScore(scoringData);
      }
    } else {
      // Use heuristic fallback
      aiScore = calculateHeuristicScore(scoringData);
    }
    
    // Map score to temperature
    const temperature = mapScoreToTemperature(aiScore);
    
    // Update lead with score and temperature
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        aiScore,
        temperature_tag: temperature
      }
    });
    
    return res.json({
      success: true,
      lead: updatedLead
    });
  } catch (error) {
    console.error('Error scoring lead:', error);
    return res.status(500).json({ error: 'Failed to score lead' });
  }
}

/**
 * Calculate AI score using OpenAI
 * This is a placeholder implementation that would be replaced with actual OpenAI integration
 */
async function calculateAiScore(lead: {
  motivation_score?: number;
  equity?: number;
  estimated_value?: number;
  is_probate?: boolean;
  is_vacant?: boolean;
  tax_debt?: number;
  violations?: number;
  days_on_market?: number;
}): Promise<number> {
  // This would be replaced with actual OpenAI API call
  // For now, return the heuristic score
  return calculateHeuristicScore(lead);
}
