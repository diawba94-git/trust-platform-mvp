import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchoolIcon from '@mui/icons-material/School';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import HistoryIcon from '@mui/icons-material/History';
import VerifiedIcon from '@mui/icons-material/Verified';
import BadgeIcon from '@mui/icons-material/Badge';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import FolderIcon from '@mui/icons-material/Folder';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ShareIcon from '@mui/icons-material/Share';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SellIcon from '@mui/icons-material/Sell';

// Résout un identifiant d'icône (utilisé dans roleThemes.js) vers le composant MUI
// correspondant, pour la sidebar comme pour les cartes de statistiques.
export const ICONS = {
  dashboard: DashboardIcon,
  person_add: PersonAddIcon,
  home_work: HomeIcon,
  description: DescriptionIcon,
  groups: GroupsIcon,
  assignment: AccountTreeIcon,
  settings: SettingsIcon,
  receipt_long: InfoOutlinedIcon,
  school: SchoolIcon,
  workspace_premium: WorkspacePremiumIcon,
  fact_check: FactCheckIcon,
  history: HistoryIcon,
  verified: VerifiedIcon,
  badge: BadgeIcon,
  request_quote: RequestQuoteIcon,
  sync_alt: SyncAltIcon,
  folder: FolderIcon,
  local_offer: LocalOfferIcon,
  account_circle: AccountCircleIcon,
  groups2: Diversity3Icon,
  menu_list: ListAltIcon,
  share: ShareIcon,
  notifications: NotificationsIcon,
  sell: SellIcon,
};

export function MenuIcon({ name, ...props }) {
  const Icon = ICONS[name] || DescriptionIcon;
  return <Icon {...props} />;
}
