import React, { useState } from 'react';
import { Box, Typography, Alert, IconButton, Snackbar, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { createActor } from '../../services/adminApi';
import { getRoleTheme } from '../../theme/roleThemes';

const ACCENT = getRoleTheme('ADMIN').accent;
const ROLE_OPTIONS = [
  { value: 'USER', label: 'Utilisateur' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'ISSUER', label: 'Émetteur (Université)' },
  { value: 'VERIFIER', label: 'Vérificateur (Entreprise)' },
  { value: 'BANK', label: 'Banque' },
  { value: 'NOTARY', label: 'Notaire (État)' },
];
// USER : champs d'identité obligatoires (clé de rapprochement côté back). ADMIN : mêmes
// champs affichés mais facultatifs — utile pour identifier la personne physique derrière
// le compte, sans bloquer la création si elle n'est pas encore connue.
const ROLES_WITH_IDENTITY_FIELDS = ['USER', 'ADMIN'];
const CHECKS = [
  'Un DID (identité numérique) est généré et rattaché à ce compte.',
  "Le compte est financé pour pouvoir signer des transactions sur la blockchain.",
  'La clé privée générée ne sera affichée qu\'une seule fois — transmettez-la de façon sécurisée.',
];

function FlatInput({ label, ...props }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>{label}</Typography>
      <Box component="input" {...props} sx={{
        width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px',
        border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
      }} />
    </Box>
  );
}

const EMPTY_FORM = {
  email: '', full_name: '', first_name: '', last_name: '',
  date_of_birth: '', place_of_birth: '', national_id_number: '', role: 'USER',
};

export default function CreateActor() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [existsDialogOpen, setExistsDialogOpen] = useState(false);
  const isCitizen = formData.role === 'USER';
  const showIdentityFields = ROLES_WITH_IDENTITY_FIELDS.includes(formData.role);
  const requiredFields = [
    'email', ...(showIdentityFields ? ['first_name', 'last_name'] : ['full_name']),
    ...(isCitizen ? ['date_of_birth', 'place_of_birth', 'national_id_number'] : []),
  ];
  const isFormValid = requiredFields.every((k) => formData[k]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const fullName = showIdentityFields
        ? `${formData.first_name} ${formData.last_name}`.trim()
        : formData.full_name;
      const payload = showIdentityFields
        ? { ...formData, full_name: fullName }
        : { ...formData, full_name: fullName, date_of_birth: undefined, place_of_birth: undefined, national_id_number: undefined };
      const data = await createActor(payload);
      setResult(data);
      if (data.already_existed) setExistsDialogOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copié !' });
  };

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>Gestion des identités</Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 2.5 }}>
        Créer un acteur
      </Typography>

      {!result ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2.5, alignItems: 'flex-start' }}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Nouvel acteur</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2.25 }}>
              <FlatInput label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              {showIdentityFields ? (
                <>
                  <FlatInput label="Nom" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                  <FlatInput label="Prénom" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                </>
              ) : (
                <FlatInput label="Nom complet" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              )}
              {showIdentityFields && (
                <>
                  <FlatInput label={`Date de naissance${isCitizen ? '' : ' (optionnel)'}`} type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                  <FlatInput label={`Lieu de naissance${isCitizen ? '' : ' (optionnel)'}`} value={formData.place_of_birth} onChange={(e) => setFormData({ ...formData, place_of_birth: e.target.value })} />
                  <FlatInput label={`N° carte d'identité (CNI)${isCitizen ? '' : ' (optionnel)'}`} value={formData.national_id_number} onChange={(e) => setFormData({ ...formData, national_id_number: e.target.value })} />
                </>
              )}
              <Box>
                <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>Rôle</Typography>
                <Box
                  component="select"
                  value={formData.role}
                  onChange={(e) => setFormData({
                    ...formData, role: e.target.value,
                    ...(!ROLES_WITH_IDENTITY_FIELDS.includes(e.target.value) ? { date_of_birth: '', place_of_birth: '', national_id_number: '' } : {}),
                  })}
                  sx={{
                    width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px',
                    border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25, mt: 2.75 }}>
              <Box
                onClick={!isFormValid || loading ? undefined : handleSubmit}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 2.25, py: 1.3, borderRadius: '10px',
                  bgcolor: ACCENT, color: '#fff', fontSize: 12.5, fontWeight: 500,
                  cursor: !isFormValid || loading ? 'not-allowed' : 'pointer',
                  opacity: !isFormValid || loading ? 0.5 : 1,
                }}
              >
                {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : "Créer l'acteur et générer son DID"}
              </Box>
            </Box>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>

          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Avant de valider</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.75 }}>
              {CHECKS.map((c, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.1 }}>
                  <Box sx={{
                    width: 17, height: 17, flexShrink: 0, borderRadius: '999px', bgcolor: `${ACCENT}1a`, color: ACCENT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, mt: 0.1,
                  }}>✓</Box>
                  <Typography sx={{ fontSize: 12, color: '#5b6070' }}>{c}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75, maxWidth: 700 }}>
          {!result.already_existed && (
            <Alert severity="success" sx={{ mb: 2.5 }}>✅ Acteur créé avec succès — DID généré.</Alert>
          )}

          {[
            { label: 'DID', value: result.did },
            { label: 'Adresse', value: result.address },
          ].map((f) => (
            <Box key={f.label} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>{f.label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{f.value}</Typography>
                <IconButton size="small" onClick={() => copyToClipboard(f.value)}><ContentCopyIcon sx={{ fontSize: 15 }} /></IconButton>
              </Box>
            </Box>
          ))}

          {result.already_existed ? (
            <Typography sx={{ fontSize: 10.5, color: '#a3a8b8' }}>
              📌 La clé privée avait déjà été transmise à son créateur d'origine — elle n'est pas réaffichée ici.
            </Typography>
          ) : (
            <Box>
              <Typography sx={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>⚠️ Clé privée (à transmettre à l'acteur)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, p: '10px 12px', borderRadius: '9px', bgcolor: '#f6f7fb', border: '1px solid #eceef4' }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 10.5, wordBreak: 'break-all', flex: 1 }}>{result.private_key}</Typography>
                <IconButton size="small" onClick={() => copyToClipboard(result.private_key)}><ContentCopyIcon sx={{ fontSize: 15 }} /></IconButton>
              </Box>
              <Typography sx={{ fontSize: 10.5, color: '#a3a8b8', mt: 1 }}>
                📌 Cette clé privée est unique. Remettez-la à l'acteur de manière sécurisée.
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1.25, mt: 2.75 }}>
            <Box
              onClick={() => { setFormData(EMPTY_FORM); setResult(null); setExistsDialogOpen(false); }}
              sx={{ px: 2, py: 1.2, borderRadius: '10px', bgcolor: ACCENT, color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
            >
              Créer un autre acteur
            </Box>
          </Box>
        </Box>
      )}

      <Dialog open={existsDialogOpen} onClose={() => setExistsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>ℹ️ DID déjà existant</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#3b4054' }}>
            Cette personne a un DID depuis le {result && new Date(result.created_at).toLocaleDateString('fr-FR')} —
            aucun doublon n'a été créé, elle vient d'être rattachée à votre organisation.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExistsDialogOpen(false)} sx={{ textTransform: 'none', color: ACCENT }}>
            Compris
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
