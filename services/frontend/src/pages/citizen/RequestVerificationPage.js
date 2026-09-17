import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, CircularProgress, Alert, Snackbar,
} from '@mui/material';
import { getMyDocuments, getUsers, initiateWorkflow } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { getDocTypeLabel, getDocTypeMeta } from '../../theme/docTypeLabels';

// Type de document -> workflow à déclencher, rôle(s) du destinataire à solliciter, et éventuel
// champ propre au workflow (ex: le montant du prêt, indispensable pour la banque).
// allActors : le destinataire peut être n'importe quel acteur institutionnel (Admin,
// Université, Entreprise, Banque, Notaire), pas un seul rôle fixe — les citoyens (USER) en
// sont exclus sauf sur LAND_TITLE (includeCitizens), qui peut aussi concerner un particulier
// (ex. co-indivisaire) et bascule alors sur une recherche nom/prénom/CNI plutôt qu'un menu.
// EMPLOYMENT reste restreint à BANK : une demande de prêt n'a de sens que pour une banque.
const DOC_TYPE_TO_WORKFLOW = {
  DIPLOMA: { workflow_type: 'DIPLOMA_VERIFICATION', allActors: true, actionLabel: 'Demander une vérification' },
  LAND_TITLE: { workflow_type: 'DIPLOMA_VERIFICATION', allActors: true, includeCitizens: true, actionLabel: 'Demander une vérification' },
  ID_CARD: { workflow_type: 'DIPLOMA_VERIFICATION', allActors: true, actionLabel: 'Demander une vérification' },
  BIRTH_CERTIFICATE: { workflow_type: 'DIPLOMA_VERIFICATION', allActors: true, actionLabel: 'Demander une vérification' },
  RESIDENCE_CERTIFICATE: { workflow_type: 'DIPLOMA_VERIFICATION', allActors: true, actionLabel: 'Demander une vérification' },
  EMPLOYMENT: {
    workflow_type: 'LOAN_APPLICATION', role: 'BANK', actionLabel: 'Demander un prêt',
    extraField: { key: 'amount', label: 'Montant du prêt (FCFA)', type: 'number' },
  },
};

// Libellés courts des rôles institutionnels, affichés à côté du nom quand le destinataire
// peut être n'importe quel acteur (allActors) pour distinguer qui est qui dans la liste.
const ROLE_LABELS = {
  ADMIN: 'Administrateur', ISSUER: 'Université', VERIFIER: 'Entreprise', BANK: 'Banque', NOTARY: 'Notaire',
};

// Ordre d'affichage des catégories de documents dans la liste (regroupement par type).
const CATEGORY_ORDER = ['DIPLOMA', 'ID_CARD', 'LAND_TITLE', 'BIRTH_CERTIFICATE', 'RESIDENCE_CERTIFICATE', 'EMPLOYMENT'];

export default function RequestVerificationPage({ title = 'Demander une vérification', crumb = 'Mon espace' }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentIds, setSentIds] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const docs = await getMyDocuments();
      setDocuments(docs.filter((d) => DOC_TYPE_TO_WORKFLOW[d.doc_type]));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const openDialog = async (doc) => {
    const config = DOC_TYPE_TO_WORKFLOW[doc.doc_type];
    setSelectedDoc(doc);
    setTargetId('');
    setMessage('');
    setExtraValue('');
    // allActors : pas de rôle unique côté API — on part sur la liste complète puis on retire
    // les citoyens (USER) sauf pour includeCitizens (LAND_TITLE), affinée ensuite par la
    // recherche nom/prénom/CNI.
    let list;
    if (config.allActors) {
      list = await getUsers().catch(() => []);
      if (!config.includeCitizens) list = list.filter((c) => c.role !== 'USER');
    } else {
      list = await getUsers(config.role).catch(() => []);
    }
    setCandidates(list);
    setDialogOpen(true);
  };

  // Recherche serveur (nom/prénom ou n° CNI) pour le cas allActors : le menu déroulant seul
  // ne tiendrait pas la charge une fois la base de citoyens plus grande que quelques comptes.
  const searchCandidates = (queryText) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!queryText || queryText.length < 2) return;
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await getUsers(undefined, false, queryText);
        setCandidates((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          results.forEach((c) => byId.set(c.id, c));
          return Array.from(byId.values());
        });
      } catch {
        // on garde la liste déjà chargée en cas d'échec de la recherche
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSubmit = async () => {
    if (!selectedDoc || !targetId) return;
    const config = DOC_TYPE_TO_WORKFLOW[selectedDoc.doc_type];
    if (config.extraField && !extraValue) return;
    setSubmitting(true);
    try {
      const workflow_data = { message };
      if (config.extraField) {
        workflow_data[config.extraField.key] = config.extraField.type === 'number' ? Number(extraValue) : extraValue;
      }
      await initiateWorkflow({
        workflow_type: config.workflow_type,
        target_user_id: targetId,
        document_token_id: selectedDoc.token_id,
        workflow_data,
      });
      setSentIds((ids) => [...ids, selectedDoc.id]);
      setSnackbar({ open: true, message: 'Demande envoyée avec succès !' });
      setDialogOpen(false);
    } catch (e) {
      setSnackbar({ open: true, message: 'Erreur : ' + e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const config = selectedDoc && DOC_TYPE_TO_WORKFLOW[selectedDoc.doc_type];

  const groupedDocuments = useMemo(() => {
    const byType = {};
    documents.forEach((doc) => {
      (byType[doc.doc_type] = byType[doc.doc_type] || []).push(doc);
    });
    return CATEGORY_ORDER
      .filter((t) => byType[t]?.length)
      .map((t) => ({ type: t, docs: byType[t] }));
  }, [documents]);

  return (
    <Box sx={{ maxWidth: 900 }}>
      {crumb && <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>}
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 0.75 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mb: 2.5 }}>
        Envoyez un de vos documents à un vérificateur ou à une banque.
      </Typography>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.25 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : documents.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>Aucun document éligible pour le moment.</Typography>
        ) : (
          groupedDocuments.map((group, gi) => (
            <Box key={group.type} sx={{ mt: gi > 0 ? 2 : 0 }}>
              <Typography sx={{
                fontSize: 11, fontWeight: 700, color: '#a3a8b8',
                textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5,
              }}>
                {getDocTypeLabel(group.type)}
              </Typography>
              {group.docs.map((doc, i) => {
                const docConfig = DOC_TYPE_TO_WORKFLOW[doc.doc_type];
                const meta = getDocTypeMeta(doc.doc_type);
                const sent = sentIds.includes(doc.id);
                return (
                  <Box key={doc.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
                    borderBottom: i < group.docs.length - 1 ? '1px solid #f4f5fa' : 'none',
                  }}>
                    <Box sx={{
                      width: 32, height: 32, flexShrink: 0, borderRadius: '9px',
                      bgcolor: `${meta.color}1a`, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <meta.icon sx={{ fontSize: 17 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{getDocTypeLabel(doc.doc_type)}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#8a90a2', mt: 0.3 }} noWrap>
                        {doc.doc_key ? `${doc.doc_key} · ` : ''}Émis par {doc.issuer}
                      </Typography>
                    </Box>
                    <Box
                      onClick={sent ? undefined : () => openDialog(doc)}
                      sx={{
                        px: 1.5, py: 0.75, borderRadius: '8px', fontSize: 11.5, fontWeight: 600, flexShrink: 0,
                        cursor: sent ? 'default' : 'pointer',
                        bgcolor: sent ? '#ecfdf5' : theme.accent,
                        color: sent ? '#059669' : '#fff',
                      }}
                    >
                      {sent ? 'Demande envoyée' : docConfig.actionLabel}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{config?.actionLabel}</DialogTitle>
        <DialogContent>
          {config?.includeCitizens ? (
            <Autocomplete
              options={candidates}
              loading={searchLoading}
              getOptionLabel={(c) => c.full_name || ''}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={candidates.find((c) => c.id === targetId) || null}
              onChange={(e, val) => setTargetId(val ? val.id : '')}
              onInputChange={(e, val) => searchCandidates(val)}
              filterOptions={(opts) => opts}
              renderOption={(props, c) => (
                <li {...props} key={c.id}>
                  <Box>
                    <Typography sx={{ fontSize: 13 }}>{c.full_name}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>
                      {c.role === 'USER' ? 'Citoyen' : (ROLE_LABELS[c.role] || c.role)}
                      {c.national_id_number ? ` · CNI ${c.national_id_number}` : ''} · {c.email}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Destinataire"
                  placeholder="Nom, prénom ou CNI..."
                  margin="normal"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchLoading ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          ) : (
            <FormControl fullWidth margin="normal">
              <InputLabel>Destinataire</InputLabel>
              <Select value={targetId} label="Destinataire" onChange={(e) => setTargetId(e.target.value)}>
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.full_name}{config?.allActors ? ` — ${ROLE_LABELS[c.role] || c.role}` : ''} ({c.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {config?.extraField && (
            <TextField
              fullWidth
              required
              type={config.extraField.type}
              label={config.extraField.label}
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              margin="normal"
            />
          )}
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            margin="normal"
            placeholder="Ajoutez un message..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Box onClick={() => setDialogOpen(false)} sx={{ px: 2, py: 1, borderRadius: '9px', border: '1px solid #e7e9f2', fontSize: 12.5, color: '#3b4054', cursor: 'pointer' }}>
            Annuler
          </Box>
          <Box
            onClick={submitting ? undefined : handleSubmit}
            sx={{
              px: 2, py: 1, borderRadius: '9px', bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', opacity: !targetId || (config?.extraField && !extraValue) ? 0.5 : 1,
            }}
          >
            {submitting ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Envoyer'}
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
