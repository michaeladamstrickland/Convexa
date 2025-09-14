// Feature flags and environment configuration
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Feature flags with defaults
export const featureFlags = {
  KANBAN_ENABLED: process.env.KANBAN_ENABLED !== 'off',
  EXPORT_ENABLED: process.env.EXPORT_ENABLED !== 'off',
  COST_TRACKING_ENABLED: process.env.COST_TRACKING_ENABLED !== 'off',
};

// Cost tracking limits
export const costLimits = {
  DAILY_CAP_BATCH_CENTS: parseInt(process.env.DAILY_CAP_BATCH_CENTS || '5000', 10),
  DAILY_CAP_OPENAI_CENTS: parseInt(process.env.DAILY_CAP_OPENAI_CENTS || '2000', 10),
};

// Request tracking
export const requestTracking = {
  recentRequests: [] as { id: string; path: string; timestamp: Date }[],
  maxRecentRequests: 100,
};

// Add a new request to tracking
export const trackRequest = (id: string, path: string) => {
  const timestamp = new Date();
  requestTracking.recentRequests.unshift({ id, path, timestamp });
  
  // Keep only the most recent requests
  if (requestTracking.recentRequests.length > requestTracking.maxRecentRequests) {
    requestTracking.recentRequests = requestTracking.recentRequests.slice(0, requestTracking.maxRecentRequests);
  }
};

// Reset daily costs at UTC midnight
let lastResetDay = new Date().getUTCDate();

export const costTracking = {
  spend: {
    batch: {
      cents: 0,
    },
    openai: {
      cents: 0,
    }
  },
  
  // Add to batch cost
  addBatchCost: (cents: number) => {
    checkResetDaily();
    costTracking.spend.batch.cents += cents;
  },
  
  // Add to OpenAI cost
  addOpenAICost: (cents: number) => {
    checkResetDaily();
    costTracking.spend.openai.cents += cents;
  },
  
  // Get all cost data
  getCostData: () => {
    checkResetDaily();
    return {
      perProvider: {
        batch: {
          today_cents: costTracking.spend.batch.cents,
          month_cents: 0, // Would need persistent storage
        },
        openai: {
          today_cents: costTracking.spend.openai.cents,
          month_cents: 0, // Would need persistent storage
        },
      },
      callsToday: {
        batch: 0, // Would need to track separately
        openai: 0, // Would need to track separately
      },
      limits: {
        batch_cents: costLimits.DAILY_CAP_BATCH_CENTS,
        openai_cents: costLimits.DAILY_CAP_OPENAI_CENTS,
      },
    };
  },
  
  // Check if batch cost exceeds daily cap
  isBatchCapExceeded: () => {
    checkResetDaily();
    return costTracking.spend.batch.cents >= costLimits.DAILY_CAP_BATCH_CENTS;
  },
  
  // Check if OpenAI cost exceeds daily cap
  isOpenAICapExceeded: () => {
    checkResetDaily();
    return costTracking.spend.openai.cents >= costLimits.DAILY_CAP_OPENAI_CENTS;
  }
};

// Check if we need to reset daily counters
function checkResetDaily() {
  const currentDay = new Date().getUTCDate();
  if (currentDay !== lastResetDay) {
    // Reset daily counters
    costTracking.spend.batch.cents = 0;
    costTracking.spend.openai.cents = 0;
    lastResetDay = currentDay;
  }
}

// Set up a timer to check daily reset every hour
setInterval(checkResetDaily, 60 * 60 * 1000);
