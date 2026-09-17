import { useEffect } from 'react';
import { useNotificationsContext } from '../context/NotificationsContext';

// Ré-exécute `callback` chaque fois qu'un événement temps réel arrive (nouveau document,
// transfert accepté/finalisé, ...) — évite d'avoir à se déconnecter/reconnecter pour voir
// une liste (documents, démarches, demandes en attente) se mettre à jour.
export function useLiveRefresh(callback) {
  const ctx = useNotificationsContext();
  const lastMessage = ctx?.lastMessage;

  useEffect(() => {
    // "connected"/"pong" sont des signaux techniques de la connexion WebSocket elle-même
    // (accusé de connexion, réponse au ping de maintien de connexion), pas des événements
    // métier — les ignorer évite de rafraîchir la liste à chaque reconnexion.
    if (lastMessage && lastMessage.type !== 'connected' && lastMessage.type !== 'pong') {
      callback();
    }
  }, [lastMessage, callback]);
}
