import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getMyWorkflows, submitVerification, getUsers } from '../services/api';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';
import { timeAgo } from '../utils/timeAgo';

const TYPE_LABELS = {
  DIPLOMA_VERIFICATION: 'Demande de vérification',
  LOAN_APPLICATION: 'Demande de prêt',
  LAND_TRANSFER: 'Transfert de titre foncier',
  EMPLOYMENT_VERIFICATION: "Vérification d'emploi",
  ID_CARD_ISSUANCE: "Carte d'identité",
};

// Champs de workflow_data à mettre en avant selon le type de workflow
// (ex: le montant est l'information clé pour la banque qui traite un prêt).
const WORKFLOW_DATA_LABELS = {
  amount: (v) => `Montant demandé : ${Number(v).toLocaleString('fr-FR')} FCFA`,
  message: (v) => `« ${v} »`,
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

// Liste des workflows en attente de vérification par l'utilisateur courant (Université pour
// un diplôme, Banque pour un prêt, Notaire pour un titre foncier, ...) — patron "liste
// compacte" de la maquette (avatar initiales, nom, sous-texte, heure, action).
export default function PendingVerificationsPanel({ title = 'Demandes en attente' }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [requesterNames, setRequesterNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workflows, users] = await Promise.all([getMyWorkflows('AWAITING_VERIFICATION'), getUsers()]);
      // getMyWorkflows renvoie aussi les demandes qu'on a soi-même envoyées (on peut être à la
      // fois émetteur et destinataire de demandes, notamment les citoyens depuis l'ouverture
      // des demandes de vérification de titre foncier à d'autres particuliers) — ce panneau ne
      // doit lister/traiter que celles où on est le destinataire désigné. LAND_TRANSFER est
      // exclu : ce type de workflow passe aussi par AWAITING_VERIFICATION (en attente de la
      // signature de l'acheteur) mais suit son propre circuit à triple signature dédié
      // (routers/transfers.py + page "Offres reçues"/MyOffersPage) — le valider ici via
      // submit-verification le marquerait COMPLETED sans signature acheteur ni notaire.
      setRequests(workflows.filter((w) => w.target_user_id === user?.id && w.type !== 'LAND_TRANSFER'));
      setRequesterNames(Object.fromEntries(users.map((u) => [u.id, u.full_name])));
    } catch (err) {
      console.error('Erreur de chargement des demandes:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const openDialog = (workflow) => {
    setSelected(workflow);
    setNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = async (isValid) => {
    if (!selected) return;
    const documentTokenId = selected.document_token_id;
    setSubmitting(true);
    try {
      await submitVerification({ workflow_id: selected.id, is_valid: isValid, notes });
      setDialogOpen(false);
      // Une fois la demande acceptée, on amène directement le vérificateur sur la fiche du
      // document validé plutôt que de le laisser sur la liste — c'est ce document qu'il
      // vient de traiter et qu'il veut voir.
      if (isValid && documentTokenId != null) {
        navigate(`/documents/${documentTokenId}/detail`);
      } else {
        await load();
      }
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.25, height: '100%' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.25 }}>{title}</Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
      ) : requests.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>Aucune demande en attente.</Typography>
      ) : (
        requests.map((req, i) => {
          const name = requesterNames[req.initiator_id] || TYPE_LABELS[req.type] || req.type;
          const amount = req.workflow_data?.amount;
          return (
            <Box key={req.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
              borderBottom: i < requests.length - 1 ? '1px solid #f4f5fa' : 'none',
            }}>
              <Box sx={{
                width: 34, height: 34, flexShrink: 0, borderRadius: '999px', bgcolor: `${theme.accent}1a`, color: theme.accent,
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {initials(name)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }} noWrap>{name}</Typography>
                <Typography sx={{ fontSize: 11, color: '#8a90a2', mt: 0.3 }} noWrap>
                  {TYPE_LABELS[req.type] || req.type}
                  {amount != null && ` · ${Number(amount).toLocaleString('fr-FR')} FCFA`}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10.5, color: '#a3a8b8', whiteSpace: 'nowrap' }}>{timeAgo(req.created_at)}</Typography>
              <Box
                onClick={() => openDialog(req)}
                sx={{
                  px: 1.5, py: 0.75, borderRadius: '8px', bgcolor: theme.accent, color: '#fff',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Traiter
              </Box>
            </Box>
          );
        })
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vérification — Workflow #{selected?.id}</DialogTitle>
        <DialogContent>
          {selected?.document_token_id != null && (
            <Typography sx={{ fontSize: 12.5, color: '#5b6070', mb: 1.5 }}>
              Document concerné : Token #{selected.document_token_id}
            </Typography>
          )}
          {Object.entries(selected?.workflow_data || {})
            .filter(([key]) => WORKFLOW_DATA_LABELS[key])
            .map(([key, value]) => (
              <Typography key={key} sx={{ fontWeight: key === 'amount' ? 'bold' : 'normal', mb: 1 }}>
                {WORKFLOW_DATA_LABELS[key](value)}
              </Typography>
            ))}
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="normal"
            placeholder="Ajoutez un commentaire..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Box onClick={() => setDialogOpen(false)} sx={{ px: 2, py: 1, borderRadius: '9px', border: '1px solid #e7e9f2', fontSize: 12.5, color: '#3b4054', cursor: 'pointer' }}>
            Annuler
          </Box>
          <Box
            onClick={submitting ? undefined : () => handleSubmit(false)}
            sx={{ px: 2, py: 1, borderRadius: '9px', bgcolor: '#fef2f2', color: '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {submitting ? <CircularProgress size={14} /> : 'Refuser'}
          </Box>
          <Box
            onClick={submitting ? undefined : () => handleSubmit(true)}
            sx={{ px: 2, py: 1, borderRadius: '9px', bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {submitting ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Accepter'}
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
