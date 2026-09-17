import React from 'react';
import { Box, Typography, Chip, Button, CircularProgress } from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import GavelIcon from '@mui/icons-material/Gavel';
import { useNavigate } from 'react-router-dom';
import { useNotificationsContext } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';

const LABELS = {
  transfer_request: 'Demande de transfert',
  transfer_accepted: 'Transfert accepté',
  transfer_completed: 'Transfert finalisé',
  verification_requested: 'Vérification demandée',
  verification_submitted: 'Vérification soumise',
  notary_requested: 'Validation notariale',
  document_issued: 'Document émis',
};

function getIcon(type) {
  if (!type) return <PendingIcon sx={{ color: '#2563eb' }} />;
  if (type.includes('accepted') || type.includes('completed')) return <CheckCircleIcon sx={{ color: '#059669' }} />;
  if (type.includes('rejected') || type.includes('cancelled')) return <CancelIcon sx={{ color: '#dc2626' }} />;
  if (type.includes('notary')) return <GavelIcon sx={{ color: '#4f46e5' }} />;
  return <PendingIcon sx={{ color: '#f59e0b' }} />;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Page complète des notifications — remplace l'ancien menu déroulant (NotificationBell),
 * reliée à la même NotificationsContext (donc au même WebSocket partagé, aucune connexion
 * supplémentaire). */
export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = getRoleTheme(user?.role);
  const state = useNotificationsContext();
  if (!state) return null;
  const { notifications, unreadCount, loading, isConnected, markAsRead, markAllAsRead, deleteAll } = state;

  function handleClick(n) {
    markAsRead(n.id);
    if (['transfer_request', 'notary_requested', 'transfer_accepted'].includes(n.type)) {
      navigate(`/transfer/${n.workflow_id}`);
    } else if (n.type === 'transfer_completed' && n.token_id) {
      navigate(`/documents/${n.token_id}/history`);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>Notifications</Typography>
          {!isConnected && <Chip label="Hors ligne" size="small" />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {unreadCount > 0 && <Button size="small" onClick={markAllAsRead}>Tout marquer comme lu</Button>}
          {notifications.length > 0 && (
            <Button
              size="small" color="error" startIcon={<DeleteSweepIcon />}
              onClick={() => window.confirm('Supprimer toutes les notifications ?') && deleteAll()}
            >
              Tout supprimer
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', mt: 2.5, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : notifications.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: '#8a90a2', fontSize: 13 }}>Aucune notification.</Typography>
        ) : (
          notifications.map((n, i) => (
            <Box
              key={n.id}
              onClick={() => handleClick(n)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2.25, py: 1.75, cursor: 'pointer',
                borderBottom: i < notifications.length - 1 ? '1px solid #f4f5fa' : 'none',
                bgcolor: n.read ? 'transparent' : `${theme.accent}0a`,
                '&:hover': { bgcolor: '#f9fafd' },
              }}
            >
              {getIcon(n.type)}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: n.read ? 400 : 700 }}>{n.message}</Typography>
                <Typography sx={{ fontSize: 11, color: '#a3a8b8', mt: 0.4 }}>
                  {LABELS[n.type] || n.type} · {formatDate(n.timestamp)}
                </Typography>
              </Box>
              {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.accent, flexShrink: 0 }} />}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
