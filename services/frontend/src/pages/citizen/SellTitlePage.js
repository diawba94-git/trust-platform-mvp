import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Alert, Snackbar,
} from '@mui/material';
import { getMyDocuments, initiateTransfer } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { getDocTypeMeta } from '../../theme/docTypeLabels';

const LAND_TITLE_META = getDocTypeMeta('LAND_TITLE');

export default function SellTitlePage({ title = 'Mettre en vente un titre', crumb = 'Mon espace' }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [sellDoc, setSellDoc] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [selling, setSelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const docs = await getMyDocuments();
      setTitles(docs.filter((d) => d.doc_type === 'LAND_TITLE' && d.is_transferable));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const openDialog = (doc) => {
    setSellDoc(doc);
    setBuyerEmail('');
    setDialogOpen(true);
  };

  const handleSell = async () => {
    if (!sellDoc || !buyerEmail) return;
    setSelling(true);
    try {
      await initiateTransfer({ token_id: sellDoc.token_id, buyer_email: buyerEmail });
      setSnackbar({ open: true, message: "Offre de vente envoyée à l'acheteur !" });
      setDialogOpen(false);
      await load();
    } catch (e) {
      setSnackbar({ open: true, message: 'Erreur : ' + e.message });
    } finally {
      setSelling(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      {crumb && <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>}
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 0.75 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mb: 2.5 }}>
        Choisissez un titre foncier à céder et renseignez l'acheteur.
      </Typography>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.25 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : titles.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>Aucun titre foncier disponible à la vente.</Typography>
        ) : (
          titles.map((doc, i) => (
            <Box key={doc.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
              borderBottom: i < titles.length - 1 ? '1px solid #f4f5fa' : 'none',
            }}>
              <Box sx={{
                width: 32, height: 32, flexShrink: 0, borderRadius: '9px',
                bgcolor: `${LAND_TITLE_META.color}1a`, color: LAND_TITLE_META.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LAND_TITLE_META.icon sx={{ fontSize: 17 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>Titre foncier #{doc.token_id}</Typography>
                <Typography sx={{ fontSize: 11, color: '#8a90a2', mt: 0.3 }} noWrap>
                  {doc.doc_key ? `${doc.doc_key} · ` : ''}Émis par {doc.issuer}
                </Typography>
              </Box>
              <Box
                onClick={() => openDialog(doc)}
                sx={{
                  px: 1.5, py: 0.75, borderRadius: '8px', fontSize: 11.5, fontWeight: 600, flexShrink: 0,
                  cursor: 'pointer', bgcolor: theme.accent, color: '#fff',
                }}
              >
                Vendre
              </Box>
            </Box>
          ))
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vendre le titre foncier #{sellDoc?.token_id}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Renseignez l'email de l'acheteur (il doit déjà avoir un compte sur la plateforme).
            Vous signerez immédiatement l'offre avec votre clé privée ; l'acheteur devra ensuite
            l'accepter, puis un notaire finalisera le transfert.
          </Typography>
          <TextField
            fullWidth
            type="email"
            label="Email de l'acheteur"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Box onClick={() => setDialogOpen(false)} sx={{ px: 2, py: 1, borderRadius: '9px', border: '1px solid #e7e9f2', fontSize: 12.5, color: '#3b4054', cursor: 'pointer' }}>
            Annuler
          </Box>
          <Box
            onClick={selling ? undefined : handleSell}
            sx={{
              px: 2, py: 1, borderRadius: '9px', bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', opacity: !buyerEmail ? 0.5 : 1,
            }}
          >
            {selling ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : "Signer et envoyer l'offre"}
          </Box>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
