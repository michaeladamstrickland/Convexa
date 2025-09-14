"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useScraperWebSocket = useScraperWebSocket;
const react_1 = require("react");
/**
 * Custom hook for connecting to the scraper WebSocket
 */
function useScraperWebSocket(options = {}) {
    const { autoConnect = true, userId = 'anonymous', url = `ws://${window.location.host}/api/ws/scraper`, maxReconnectAttempts = 10, initialReconnectInterval = 1000, maxReconnectInterval = 30000, authToken, } = options;
    // Build the WebSocket URL with authentication
    const wsUrl = (0, react_1.useRef)(`${url}?userId=${userId}${authToken ? `&token=${authToken}` : ''}`);
    const [socket, setSocket] = (0, react_1.useState)(null);
    const [isConnected, setIsConnected] = (0, react_1.useState)(false);
    const [lastMessage, setLastMessage] = (0, react_1.useState)(null);
    const [jobUpdates, setJobUpdates] = (0, react_1.useState)([]);
    const [reconnectCount, setReconnectCount] = (0, react_1.useState)(0);
    const reconnectIntervalRef = (0, react_1.useRef)(initialReconnectInterval);
    // Connect to WebSocket with exponential backoff
    const connect = (0, react_1.useCallback)(() => {
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
                const nextInterval = Math.min(reconnectIntervalRef.current * 1.5, // Exponential factor
                maxReconnectInterval);
                // Update the interval for next time
                reconnectIntervalRef.current = nextInterval;
                console.log(`Reconnecting in ${nextInterval}ms (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
                setTimeout(() => {
                    setReconnectCount(prev => prev + 1);
                    connect();
                }, reconnectIntervalRef.current);
            }
            else {
                console.error(`WebSocket reconnection failed after ${maxReconnectAttempts} attempts`);
            }
        });
        newSocket.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data);
                setLastMessage(message);
                // Handle job updates
                if (message.type === 'job_update') {
                    setJobUpdates(prev => [message.data, ...prev.slice(0, 19)]); // Keep last 20
                }
            }
            catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });
        newSocket.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
        });
        setSocket(newSocket);
    }, [wsUrl, socket, reconnectCount, maxReconnectAttempts, initialReconnectInterval, maxReconnectInterval]);
    // Disconnect from WebSocket
    const disconnect = (0, react_1.useCallback)(() => {
        if (socket !== null) {
            socket.close();
            setSocket(null);
            setIsConnected(false);
        }
    }, [socket]);
    // Send message to WebSocket
    const sendMessage = (0, react_1.useCallback)((data) => {
        if (socket !== null && isConnected) {
            socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }, [socket, isConnected]);
    // Send ping to keep connection alive
    const sendPing = (0, react_1.useCallback)(() => {
        return sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
    }, [sendMessage]);
    // Auto-connect on mount and handle reconnection
    (0, react_1.useEffect)(() => {
        let pingInterval;
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
//# sourceMappingURL=useScraperWebSocket.js.map