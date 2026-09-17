import SchoolIcon from '@mui/icons-material/School';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import DescriptionIcon from '@mui/icons-material/Description';
import HomeWorkIcon from '@mui/icons-material/HomeWork';

// Libellé français court par type de document — utilisé par les nouveaux tableaux de
// bord (répartitions, listes "récemment émis"). Reprend les mêmes valeurs que les cartes
// déjà affichées ailleurs (AdminDocuments.js, UserDashboard.js) pour rester cohérent.
export const DOC_TYPE_LABELS = {
  DIPLOMA: 'Diplômes',
  EMPLOYMENT: "Attestations emploi",
  LAND_TITLE: 'Titres fonciers',
  ID_CARD: "Cartes d'identité",
  BIRTH_CERTIFICATE: 'Actes de naissance',
  RESIDENCE_CERTIFICATE: 'Attestations de résidence',
};

export function getDocTypeLabel(docType) {
  return DOC_TYPE_LABELS[docType] || docType;
}

// Icône + couleur par type de document — mêmes couleurs que le wallet mobile
// (packages/shared/src/constants.ts, DOC_TYPE_META) pour une identité visuelle cohérente
// entre le web et le mobile.
const DOC_TYPE_META = {
  DIPLOMA: { icon: SchoolIcon, color: '#7c3aed' },
  EMPLOYMENT: { icon: BusinessCenterIcon, color: '#2563eb' },
  LAND_TITLE: { icon: HomeIcon, color: '#059669' },
  ID_CARD: { icon: BadgeIcon, color: '#ea580c' },
  BIRTH_CERTIFICATE: { icon: DescriptionIcon, color: '#db2777' },
  RESIDENCE_CERTIFICATE: { icon: HomeWorkIcon, color: '#0891b2' },
};
const DEFAULT_DOC_TYPE_META = { icon: DescriptionIcon, color: '#8a90a2' };

export function getDocTypeMeta(docType) {
  return DOC_TYPE_META[docType] || DEFAULT_DOC_TYPE_META;
}
