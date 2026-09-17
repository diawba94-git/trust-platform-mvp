import React, { useState } from 'react';
import { Box, Typography, TextField, MenuItem, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { createManagedUser } from '../../services/api';

// Rôles que chaque type d'appelant peut créer — reflète _ALLOWED_TARGET_ROLES côté backend
// (routers/actors.py) : le serveur revalide de toute façon, cette liste ne fait que réduire
// le menu déroulant aux valeurs qui seront effectivement acceptées.
const ALLOWED_ROLES = {
  ISSUER: ['USER'],
  BANK: ['USER'],
  VERIFIER: ['USER', 'VERIFIER'],
};
const ROLE_LABELS = { USER: 'USER (citoyen)', VERIFIER: 'VERIFIER' };

/** Formulaire technique minimal pour créer un compte géré et son DID
 * (POST /actors/create-managed-user) — identité civile demandée uniquement si le rôle
 * choisi est USER, requise côté backend pour ce rôle. */
export default function CreateManagedUserPage() {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const roleOptions = ALLOWED_ROLES[user?.role] || ['USER'];

  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0]);
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const isCitizen = role === 'USER';
  const isFormValid = email
    && (isCitizen ? (firstName && lastName) : fullName)
    && (!isCitizen || (dateOfBirth && placeOfBirth && nationalIdNumber));

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await createManagedUser({
        email,
        full_name: isCitizen ? `${firstName} ${lastName}`.trim() : fullName,
        first_name: isCitizen ? firstName : undefined,
        last_name: isCitizen ? lastName : undefined,
        date_of_birth: isCitizen ? dateOfBirth : undefined,
        place_of_birth: isCitizen ? placeOfBirth : undefined,
        national_id_number: isCitizen ? nationalIdNumber : undefined,
        role,
      });
      setResult(res);
      setEmail('');
      setFullName('');
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setPlaceOfBirth('');
      setNationalIdNumber('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mb: 2.5 }}>
        Créer un compte géré
      </Typography>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity={result.already_existed ? 'info' : 'success'} sx={{ mb: 2 }}>
            {result.already_existed
              ? `DID déjà existant, rattaché à votre organisation : ${result.did}`
              : `DID créé : ${result.did} — clé privée transmise une seule fois : ${result.private_key}`}
          </Alert>
        )}

        <TextField fullWidth size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />

        <TextField
          select fullWidth size="small" label="Rôle" value={role}
          onChange={(e) => setRole(e.target.value)} sx={{ mb: 2 }}
        >
          {roleOptions.map((r) => (
            <MenuItem key={r} value={r}>{ROLE_LABELS[r] || r}</MenuItem>
          ))}
        </TextField>

        {isCitizen ? (
          <>
            <TextField fullWidth size="small" label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth size="small" label="Date de naissance" type="date" InputLabelProps={{ shrink: true }}
              value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} sx={{ mb: 2 }}
            />
            <TextField fullWidth size="small" label="Lieu de naissance" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth size="small" label="N° carte d'identité (CNI)" value={nationalIdNumber}
              onChange={(e) => setNationalIdNumber(e.target.value)} sx={{ mb: 2.5 }}
            />
          </>
        ) : (
          <TextField fullWidth size="small" label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} sx={{ mb: 2.5 }} />
        )}

        <Box
          onClick={!loading && isFormValid ? handleSubmit : undefined}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.3, borderRadius: 2.5,
            bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500,
            cursor: isFormValid ? 'pointer' : 'not-allowed', opacity: isFormValid ? 1 : 0.5,
          }}
        >
          {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Créer le compte'}
        </Box>
      </Box>
    </Box>
  );
}
