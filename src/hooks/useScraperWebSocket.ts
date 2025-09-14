import { useState, useEffect, useCallback, useRef } from 'react';

interface UseScraperWebSocketOptions {
  /** Whether to connect automatically */
  autoConnect?: boolean;
  /** Optional user ID to identify the connection */
  userId?: string;
  /** WebSocket URL, defaults to ws://${window.location.host}/api/ws/scraper */
  url?: string;
  /** Reconnect attempts, defaults to 10 */
  maxReconnectAttempts?: number;
  /** Initial reconnect interval in ms, defaults to 1000 */
  initialReconnectInterval?: number;
  /** Max reconnect interval in ms, defaults to 30000 (30 seconds) */
  maxReconnectInterval?: number;
  /** Authentication token for secure connections */
  authToken?: string;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  status?: string;
  timestamp: string;
}

/**
 * Custom hook for connecting to the scraper WebSocket
 */
export function useScraperWebSocket(options: UseScraperWebSocketOptions = {}) {
  const {
    autoConnect = true,
    userId = 'anonymous',
    url = `ws://${window.location.host}/api/ws/scraper`,
    maxReconnectAttempts = 10,
    initialReconnectInterval = 1000,
    maxReconnectInterval = 30000,
    authToken,
  } = options;

  // Build the WebSocket URL with authentication
  const wsUrl = useRef<string>(`${url}?userId=${userId}${authToken ? `&token=${authToken}` : ''}`);
  
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [jobUpdates, setJobUpdates] = useState<any[]>([]);
  const [reconnectCount, setReconnectCount] = useState(0);
  const reconnectIntervalRef = useRef<number>(initialReconnectInterval);

  // Connect to WebSocket with exponential backoff
  const connect = useCallback(() => {
    if (socket !== null) {
      socket.close();
    }

    // Create new WebSocket connection with the URL containing auth token
    const newSocket = new WebSocket(wsUrl.current);
    
    newSocket.addEventListener('open', () => {
      setIsConnected(true);
      setReconnectCount(0);
      // Reset reconnect interval on successful connection
      reconnectIntervalRef.current = initialReconnectInterval;
      console.log('WebSocket connected');
    });

    newSocket.addEventListener('close', (event) => {
      setIsConnected(false);
      console.log(`WebSocket disconnected with code ${event.code}${event.reason ? `: ${event.reason}` : ''}`);
      
      // Attempt to reconnect with exponential backoff
      if (reconnectCount < maxReconnectAttempts) {
        // Calculate next reconnect interval with exponential backoff
        const nextInterval = Math.min(
          reconnectIntervalRef.current * 1.5, // Exponential factor
          maxReconnectInterval
        );
        
        // Update the interval for next time
        reconnectIntervalRef.current = nextInterval;
        
        console.log(`Reconnecting in ${nextInterval}ms (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
          setReconnectCount(prev => prev + 1);
          connect();
        }, reconnectIntervalRef.current);
      } else {
        console.error(`WebSocket reconnection failed after ${maxReconnectAttempts} attempts`);
      }
    });

    newSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        
        // Handle job updates
        if (message.type === 'job_update') {
          setJobUpdates(prev => [message.data, ...prev.slice(0, 19)]); // Keep last 20
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    newSocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    setSocket(newSocket);
  }, [wsUrl, socket, reconnectCount, maxReconnectAttempts, initialReconnectInterval, maxReconnectInterval]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socket !== null) {
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  // Send message to WebSocket
  const sendMessage = useCallback((data: any) => {
    if (socket !== null && isConnected) {
      socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // Send ping to keep connection alive
  const sendPing = useCallback(() => {
    return sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
  }, [sendMessage]);

  // Auto-connect on mount and handle reconnection
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    
    if (autoConnect) {
      connect();
      
      // Send ping every 30 seconds to keep connection alive
      pingInterval = setInterval(() => {
        if (isConnected) {
          sendPing();
        }
      }, 30000);
    }

    // Cleanup
    return () => {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      disconnect();
    };
  }, [autoConnect, connect, disconnect, isConnected, sendPing]);

  return {
    isConnected,
    lastMessage,
    jobUpdates,
    connect,
    disconnect,
    sendMessage,
    reconnectCount,
  };
}
