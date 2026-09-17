import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteAllNotifications } from '../services/api';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      try {
        const response = await getNotifications();
        setNotifications(response);
        setUnreadCount(response.filter(n => !n.read).length);
      } catch (error) {
        console.error('Erreur de chargement des notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [userId]);

  // Le WebSocket passe par Kong, sur la même origine que le reste de l'app.
  const wsUrl = userId
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/${userId}`
    : null;
  const { isConnected, lastMessage, sendMessage } = useWebSocket(userId, wsUrl);

  useEffect(() => {
    // "connected"/"pong" sont des signaux techniques de la connexion WebSocket elle-même
    // (accusé de connexion, réponse au ping de maintien de connexion) — pas des notifications
    // métier à afficher à l'utilisateur.
    if (!lastMessage || lastMessage.type === 'connected' || lastMessage.type === 'pong') return;

    const newNotification = {
      id: lastMessage.id || Date.now(),
      ...lastMessage,
      read: false,
      timestamp: lastMessage.timestamp || new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
  }, [lastMessage]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erreur lors du marquage tout comme lu:', error);
    }
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  }, []);

  const deleteAll = useCallback(async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Erreur lors de la suppression des notifications:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    lastMessage,
    markAsRead,
    markAllAsRead,
    removeNotification,
    deleteAll,
    sendMessage,
  };
}
