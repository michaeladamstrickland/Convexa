import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { logger } from './logger';

/**
 * WebSocket service for real-time scraper updates
 */
class ScraperWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, { userId: string }> = new Map();

  /**
   * Initialize the WebSocket server
   * @param server HTTP server to attach the WebSocket server to
   */
  initialize(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/api/ws/scraper' });
    
    this.wss.on('connection', (ws, req) => {
      // Verify authentication if necessary
      if (!this.verifyAuthToken(req)) {
        logger.warn(`WebSocket connection rejected due to invalid authentication`);
        ws.close(4000, 'Invalid authentication');
        return;
      }
      
      // Extract user ID from query params or headers
      const userId = this.getUserIdFromRequest(req) || 'anonymous';
      this.clients.set(ws, { userId });
      
      logger.info(`WebSocket connection established for user: ${userId}`);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        userId,
        timestamp: new Date().toISOString()
      }));
      
      // Handle messages from clients
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug(`WebSocket message received from ${userId}:`, data);
          
          // Handle different message types
          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        logger.info(`WebSocket connection closed for user: ${userId}`);
        this.clients.delete(ws);
      });
    });
    
    logger.info('WebSocket server initialized');
  }
  
  /**
   * Broadcast a scraper job update to all connected clients
   * @param data Update data to broadcast
   */
  broadcastJobUpdate(data: any) {
    if (!this.wss) {
      logger.error('WebSocket server not initialized');
      return;
    }
    
    const message = JSON.stringify({
      type: 'job_update',
      data,
      timestamp: new Date().toISOString()
    });
    
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
    
    logger.debug(`Broadcast job update to ${this.clients.size} clients`);
  }
  
  /**
   * Send a job update to a specific client
   * @param userId User ID to send the update to
   * @param data Update data to send
   */
  sendJobUpdate(userId: string, data: any) {
    if (!this.wss) {
      logger.error('WebSocket server not initialized');
      return;
    }
    
    const message = JSON.stringify({
      type: 'job_update',
      data,
      timestamp: new Date().toISOString()
    });
    
    let sent = false;
    this.clients.forEach((client, ws) => {
      if (client.userId === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sent = true;
      }
    });
    
    if (sent) {
      logger.debug(`Sent job update to user: ${userId}`);
    } else {
      logger.debug(`User not connected: ${userId}`);
    }
  }
  
  /**
   * Extract user ID from the request
   * @param req HTTP request
   * @returns User ID or null
   */
  private getUserIdFromRequest(req: http.IncomingMessage): string | null {
    // Extract from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    return url.searchParams.get('userId');
  }
  
  /**
   * Verify authentication token
   * @param req HTTP request
   * @returns boolean indicating if token is valid
   */
  private verifyAuthToken(req: http.IncomingMessage): boolean {
    // In a production app, this would validate the token against a DB or auth service
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    // For now, simple presence check or allow connections without token
    // In production, implement proper JWT validation or similar
    return !token || token.length > 0;
  }
}

// Create a singleton instance
const scraperWebSocketService = new ScraperWebSocketService();

export default scraperWebSocketService;
