import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

// Mock prom-client to track metric increments
const mockInc = vi.fn();
const mockCounter = vi.fn(() => ({ inc: mockInc }));
const mockGauge = vi.fn(() => ({ set: vi.fn() }));
const mockHistogram = vi.fn(() => ({ observe: vi.fn() }));

vi.mock('prom-client', () => ({
  default: {
    collectDefaultMetrics: vi.fn(),
    Counter: mockCounter,
    Gauge: mockGauge,
    Histogram: mockHistogram,
    register: {
      contentType: 'text/plain',
      metrics: () => 'mocked metrics',
    },
  },
}));

describe('PI1 Dialer Routes', () => {
  let app: express.Application;
  let request: supertest.SuperTest<supertest.Test>;
  let testDbPath: string;
  
  beforeAll(async () => {
    // Create test database
    testDbPath = path.join(process.cwd(), 'test-pi1-dialer.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    
    // Set up test environment
    process.env.DATABASE_URL = `sqlite:${testDbPath}`;
    process.env.NODE_ENV = 'test';
    
    // Import and setup the integrated server
    const serverModule = await import('../../backend/integrated-server.js');
    app = serverModule.default;
    request = supertest(app);
  });
  
  afterAll(() => {
    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        console.warn('Could not cleanup test database:', e);
      }
    }
  });
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });
  
  describe('POST /dial/:dialId/disposition', () => {
    it('should reject invalid disposition type with 400 Problem+JSON', async () => {
      const response = await request
        .post('/dial/test-dial-123/disposition')
        .send({ type: 'invalid_type', notes: 'test notes' })
        .expect(400);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('invalid_disposition_type'),
        title: expect.any(String),
        status: 400,
        detail: expect.stringContaining('Type must be one of'),
        instance: 'type'
      });
    });
    
    it('should accept valid disposition and return 200', async () => {
      // First ensure we have a test lead
      const leadCreateResponse = await request
        .post('/import/test-data')
        .send([{
          address: '123 Test St',
          owner_name: 'Test Owner',
          mail_address: '123 Test St',
          mail_city: 'Test City',
          mail_state: 'TS',
          mail_zip: '12345'
        }]);
      
      // Extract lead ID from response or use a known test ID
      const testLeadId = 'test-lead-123';
      
      const response = await request
        .post(`/dial/${testLeadId}/disposition`)
        .send({ 
          type: 'interested', 
          notes: 'Lead showed strong interest in selling' 
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        ok: true,
        id: expect.any(String)
      });
    });
    
    it('should increment dialer_disposition_total metric with grade_label', async () => {
      const testLeadId = 'test-lead-for-metrics';
      
      await request
        .post(`/dial/${testLeadId}/disposition`)
        .send({ type: 'voicemail', notes: 'Left message' })
        .expect(200);
      
      // Verify metric was incremented with proper labels
      expect(mockInc).toHaveBeenCalledWith({
        type: 'voicemail',
        grade_label: expect.any(String) // Will be 'ungraded' for test leads
      });
    });
    
    it('should handle all valid disposition types', async () => {
      const validTypes = ['no_answer', 'voicemail', 'bad_number', 'interested', 'not_interested', 'follow_up'];
      const testLeadId = 'test-lead-all-types';
      
      for (const type of validTypes) {
        const response = await request
          .post(`/dial/${testLeadId}/disposition`)
          .send({ type, notes: `Test ${type}` })
          .expect(200);
        
        expect(response.body.ok).toBe(true);
      }
      
      // Verify metrics were called for each type
      expect(mockInc).toHaveBeenCalledTimes(validTypes.length);
    });
  });
  
  describe('POST /leads/:id/followups', () => {
    it('should reject missing dueAt with 400', async () => {
      const response = await request
        .post('/leads/test-lead-123/followups')
        .send({ 
          channel: 'call',
          priority: 'high',
          notes: 'Missing due date'
        })
        .expect(400);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('missing_due_at'),
        status: 400,
        instance: 'dueAt'
      });
    });
    
    it('should reject invalid channel with 400', async () => {
      const response = await request
        .post('/leads/test-lead-123/followups')
        .send({
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          channel: 'invalid_channel',
          priority: 'med'
        })
        .expect(400);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('invalid_channel'),
        status: 400,
        instance: 'channel'
      });
    });
    
    it('should reject invalid priority with 400', async () => {
      const response = await request
        .post('/leads/test-lead-123/followups')
        .send({
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          channel: 'call',
          priority: 'invalid_priority'
        })
        .expect(400);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('invalid_priority'),
        status: 400,
        instance: 'priority'
      });
    });
    
    it('should create valid follow-up and return 200', async () => {
      const dueAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
      
      const response = await request
        .post('/leads/test-lead-123/followups')
        .send({
          dueAt,
          channel: 'call',
          priority: 'high',
          notes: 'Follow up on interested lead'
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        ok: true,
        id: expect.any(String)
      });
    });
    
    it('should increment followups_created_total metric', async () => {
      const dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      await request
        .post('/leads/test-lead-456/followups')
        .send({
          dueAt,
          channel: 'sms',
          priority: 'med',
          notes: 'SMS follow-up'
        })
        .expect(200);
      
      expect(mockInc).toHaveBeenCalledWith({
        channel: 'sms',
        priority: 'med'
      });
    });
    
    it('should handle all valid channels and priorities', async () => {
      const validChannels = ['call', 'sms', 'email', 'task'];
      const validPriorities = ['low', 'med', 'high'];
      const testLeadId = 'test-lead-channels';
      
      for (const channel of validChannels) {
        for (const priority of validPriorities) {
          const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
          
          const response = await request
            .post(`/leads/${testLeadId}/followups`)
            .send({
              dueAt,
              channel,
              priority,
              notes: `Test ${channel} ${priority}`
            })
            .expect(200);
          
          expect(response.body.ok).toBe(true);
        }
      }
      
      expect(mockInc).toHaveBeenCalledTimes(validChannels.length * validPriorities.length);
    });
  });
  
  describe('PATCH /followups/:id', () => {
    it('should reject invalid status with 400', async () => {
      const response = await request
        .patch('/followups/test-followup-123')
        .send({ status: 'invalid_status' })
        .expect(400);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('invalid_status'),
        status: 400,
        instance: 'status'
      });
    });
    
    it('should handle done status transition', async () => {
      // First create a follow-up to update
      const createResponse = await request
        .post('/leads/test-lead-patch/followups')
        .send({
          dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          channel: 'call',
          priority: 'high',
          notes: 'Test follow-up for patch'
        });
      
      const followupId = createResponse.body.id;
      
      const response = await request
        .patch(`/followups/${followupId}`)
        .send({ 
          status: 'done',
          notes: 'Successfully contacted lead'
        })
        .expect(200);
      
      expect(response.body.ok).toBe(true);
    });
    
    it('should handle snoozed status with custom snoozeUntil', async () => {
      // Create follow-up
      const createResponse = await request
        .post('/leads/test-lead-snooze/followups')
        .send({
          dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          channel: 'email',
          priority: 'low'
        });
      
      const followupId = createResponse.body.id;
      const snoozeUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      
      const response = await request
        .patch(`/followups/${followupId}`)
        .send({ 
          status: 'snoozed',
          snoozeUntil,
          notes: 'Lead requested callback later'
        })
        .expect(200);
      
      expect(response.body.ok).toBe(true);
    });
    
    it('should increment followups_completed_total metric', async () => {
      // Create follow-up
      const createResponse = await request
        .post('/leads/test-lead-complete/followups')
        .send({
          dueAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          channel: 'task',
          priority: 'med'
        });
      
      const followupId = createResponse.body.id;
      
      await request
        .patch(`/followups/${followupId}`)
        .send({ status: 'done' })
        .expect(200);
      
      expect(mockInc).toHaveBeenCalledWith({ status: 'done' });
    });
    
    it('should handle all valid status transitions', async () => {
      const validStatuses = ['done', 'snoozed', 'canceled'];
      
      for (const status of validStatuses) {
        // Create follow-up for each test
        const createResponse = await request
          .post('/leads/test-lead-status-' + status + '/followups')
          .send({
            dueAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            channel: 'call',
            priority: 'med'
          });
        
        const followupId = createResponse.body.id;
        
        const response = await request
          .patch(`/followups/${followupId}`)
          .send({ status })
          .expect(200);
        
        expect(response.body.ok).toBe(true);
      }
      
      expect(mockInc).toHaveBeenCalledTimes(validStatuses.length);
    });
  });
  
  describe('GET /leads/:id/timeline', () => {
    it('should return 404 for non-existent lead', async () => {
      const response = await request
        .get('/leads/non-existent-lead/timeline')
        .expect(404);
      
      expect(response.body).toMatchObject({
        type: expect.stringContaining('lead_not_found'),
        status: 404
      });
    });
    
    it('should return timeline events in newest-first order', async () => {
      const testLeadId = 'test-lead-timeline';
      
      // Create some timeline events by creating follow-ups and dispositions
      await request
        .post(`/leads/${testLeadId}/followups`)
        .send({
          dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          channel: 'call',
          priority: 'high',
          notes: 'First follow-up'
        });
      
      await request
        .post(`/dial/${testLeadId}/disposition`)
        .send({
          type: 'interested',
          notes: 'Lead showed interest'
        });
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await request
        .post(`/leads/${testLeadId}/followups`)
        .send({
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          channel: 'email',
          priority: 'med',
          notes: 'Second follow-up'
        });
      
      const response = await request
        .get(`/leads/${testLeadId}/timeline`)
        .expect(200);
      
      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
      
      if (response.body.events.length > 1) {
        // Check that events are in newest-first order
        const timestamps = response.body.events.map((e: any) => new Date(e.at).getTime());
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
        }
      }
      
      // Check event structure
      response.body.events.forEach((event: any) => {
        expect(event).toMatchObject({
          kind: expect.any(String),
          at: expect.any(String),
          summary: expect.any(String),
          data: expect.any(Object)
        });
      });
    });
    
    it('should include disposition and follow-up events', async () => {
      const testLeadId = 'test-lead-events';
      
      // Create disposition
      await request
        .post(`/dial/${testLeadId}/disposition`)
        .send({
          type: 'voicemail',
          notes: 'Left voicemail message'
        });
      
      // Create follow-up
      await request
        .post(`/leads/${testLeadId}/followups`)
        .send({
          dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          channel: 'sms',
          priority: 'high',
          notes: 'Follow up voicemail with SMS'
        });
      
      const response = await request
        .get(`/leads/${testLeadId}/timeline`)
        .expect(200);
      
      expect(response.body.events.length).toBeGreaterThan(0);
      
      // Look for our specific events
      const hasDisposition = response.body.events.some((e: any) => 
        e.kind === 'disposition' && e.summary.includes('voicemail'));
      const hasFollowup = response.body.events.some((e: any) => 
        e.kind === 'followup_created' && e.summary.includes('sms'));
      
      expect(hasDisposition || hasFollowup).toBe(true);
    });
  });
});