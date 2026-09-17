import { useEffect, useState, useRef, useCallback } from 'react';

export function useWebSocket(userId, wsUrl) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!userId || !wsUrl) return;

    try {
      if (wsRef.current) {
        // Neutralise le handler onclose de l'ancien socket avant de le fermer : sans ça,
        // ce remplacement volontaire déclenche quand même sa logique de reconnexion, qui
        // vient percuter le nouveau socket qu'on est en train d'ouvrir — boucle de
        // reconnexion qui ne s'arrête jamais.
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({
          type: 'identify',
          user_id: userId
        }));

        // Ping périodique : sans trafic applicatif, un proxy intermédiaire (Kong, nginx, ...)
        // peut considérer la connexion inactive et la couper, provoquant une reconnexion
        // perpétuelle côté client.
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (error) {
          console.error('Erreur de parsing WebSocket:', error);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(5000 * reconnectAttempts.current, 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Erreur de connexion WebSocket:', error);
      setIsConnected(false);
    }
  }, [userId, wsUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket non connecté');
    }
  }, [isConnected]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
  };
}
