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
export declare function useScraperWebSocket(options?: UseScraperWebSocketOptions): {
    isConnected: boolean;
    lastMessage: WebSocketMessage | null;
    jobUpdates: any[];
    connect: () => void;
    disconnect: () => void;
    sendMessage: (data: any) => boolean;
    reconnectCount: number;
};
export {};
//# sourceMappingURL=useScraperWebSocket.d.ts.map