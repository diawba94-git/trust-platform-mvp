import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { getUsers, issueDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';

const CHECKS = [
  'Le document sera enregistré de façon immuable sur la blockchain.',
  'Le destinataire recevra une notification et pourra le consulter dans son wallet.',
  'Cette action ne peut pas être annulée après confirmation.',
];

function FlatInput({ label, ...props }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>{label}</Typography>
      <Box
        component="input"
        {...props}
        sx={{
          width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px',
          border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', color: '#171a2b',
          outline: 'none', '&:focus': { borderColor: props.accentcolor || '#4f46e5' },
        }}
      />
    </Box>
  );
}

function FlatSelect({ label, value, onChange, options, accent }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>{label}</Typography>
      <Box
        component="select"
        value={value}
        onChange={onChange}
        sx={{
          width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px',
          border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', color: '#171a2b',
          outline: 'none', '&:focus': { borderColor: accent || '#4f46e5' },
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Box>
    </Box>
  );
}

// Formulaire réutilisable pour émettre un document (diplôme, attestation d'emploi, titre foncier, ...)
// — patron "Formulaire" générique de la maquette : grille 1.6fr/1fr avec panneau "Avant de valider".
export default function IssueDocumentForm({ docType, title, attributeFields, recipientRole, mineOnly }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [users, setUsers] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [docKey, setDocKey] = useState('');
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getUsers(recipientRole, mineOnly).then(setUsers).catch(() => setUsers([]));
  }, [recipientRole, mineOnly]);

  // recipientId vient d'un <select> natif : sa valeur est toujours une string, même quand
  // l'id utilisateur (JSON) est un number — comparer en string pour ne pas rater le match.
  const recipient = users.find((u) => String(u.id) === String(recipientId));

  const handleSubmit = async () => {
    if (!recipient || !docKey) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const attributes = attributeFields.map((f) => ({
        key: f.key,
        value: String(values[f.key] || ''),
        valueType: f.valueType || 'string',
      }));
      const filename = `${docType.toLowerCase()}_${recipient.full_name.replace(/\s+/g, '_')}.pdf`;
      const response = await issueDocument({
        owner_did: recipient.did,
        doc_type: docType,
        doc_key: docKey,
        attributes,
        file_content: btoa(`${docType} document for ${recipient.full_name}`),
        filename,
        is_transferable: docType === 'LAND_TITLE',
      });
      setResult(response);
      setValues({});
      setRecipientId('');
      setDocKey('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2.5, alignItems: 'flex-start' }}>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{title}</Typography>

        {mineOnly && users.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Vous n'avez pas encore d'employé enregistré. Créez-en un via « Établir DID » avant d'émettre une attestation.
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2.25 }}>
          <FlatSelect
            label="Destinataire"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            options={users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
            accent={theme.accent}
          />
          <FlatInput
            label="Référence du document"
            placeholder="ex : TF-12345, DIP-2026-0042..."
            value={docKey}
            onChange={(e) => setDocKey(e.target.value)}
            accentcolor={theme.accent}
          />
          {attributeFields.map((f) => (
            <FlatInput
              key={f.key}
              label={f.label}
              value={values[f.key] || ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              accentcolor={theme.accent}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.25, mt: 2.75 }}>
          <Box
            onClick={!recipientId || !docKey || loading ? undefined : handleSubmit}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 2.25, py: 1.3, borderRadius: '10px',
              bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500,
              cursor: !recipientId || !docKey || loading ? 'not-allowed' : 'pointer',
              opacity: !recipientId || !docKey || loading ? 0.5 : 1,
            }}
          >
            {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Enregistrer dans le registre'}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            ✅ Document émis avec succès — Token ID : <strong>{result.token_id}</strong>
          </Alert>
        )}
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Avant de valider</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.75 }}>
          {CHECKS.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.1 }}>
              <Box sx={{
                width: 17, height: 17, flexShrink: 0, borderRadius: '999px', bgcolor: `${theme.accent}1a`, color: theme.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, mt: 0.1,
              }}>
                ✓
              </Box>
              <Typography sx={{ fontSize: 12, color: '#5b6070' }}>{c}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
