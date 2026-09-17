import React, { createContext, useContext } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

// Une seule connexion WebSocket par session, partagée par la cloche de notifications et
// par les tableaux de bord — ces derniers s'en servent pour se rafraîchir automatiquement
// (nouveau document reçu, transfert accepté/finalisé, ...) sans attendre une reconnexion.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const notificationsState = useNotifications(user?.id);

  return (
    <NotificationsContext.Provider value={notificationsState}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotificationsContext = () => useContext(NotificationsContext);
