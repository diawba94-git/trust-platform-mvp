import React from 'react';
import { Box, Typography } from '@mui/material';
import IssueDocumentForm from '../../components/IssueDocumentForm';

/** Page hôte générique pour un formulaire d'émission — reproduit l'en-tête "Rôle · Section"
 * du patron "Formulaire" de la maquette, puis délègue la grille formulaire/checklist à
 * `IssueDocumentForm` (qui affiche son propre titre de carte, plus petit). */
export default function IssueDocumentPage({ title, subtitle, crumb, docType, attributeFields, recipientRole, mineOnly }) {
  return (
    <Box sx={{ maxWidth: 1100 }}>
      {crumb && (
        <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>
      )}
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: crumb ? 0.5 : 0 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 13, color: '#8a90a2', mt: 0.75 }}>{subtitle}</Typography>
      )}
      <Box sx={{ mt: 2.5 }}>
        <IssueDocumentForm docType={docType} title={title} attributeFields={attributeFields} recipientRole={recipientRole} mineOnly={mineOnly} />
      </Box>
    </Box>
  );
}
