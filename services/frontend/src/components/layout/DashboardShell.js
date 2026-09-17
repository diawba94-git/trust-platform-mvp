import React, { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText, Toolbar,
  Typography, Avatar, IconButton, Badge,
} from '@mui/material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { MenuIcon } from '../../theme/iconMap';
import { useNotificationsContext } from '../../context/NotificationsContext';

const DRAWER_WIDTH = 240;
const SIDEBAR_BG = '#0b0f1e';
const CANVAS_MAX_WIDTH = 1440;

/** Icône de la maquette (bouclier + coche) — reproduite en SVG, pas une émoji. */
function BrandLogo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.4 4.6 5.5v6.1c0 4.5 3.1 8.2 7.4 10 4.3-1.8 7.4-5.5 7.4-10V5.5z"
        fill="#1b2140" stroke="#7f88c4" strokeWidth="1.3"
      />
      <circle cx="12" cy="11.4" r="4.1" stroke="#c9cdec" strokeWidth="1.2" />
      <path d="M10.1 11.5 11.6 13l2.6-2.9" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function flattenPaths(menu) {
  const paths = [];
  for (const item of menu) {
    if (item.path) paths.push(item);
    if (item.children) paths.push(...item.children);
  }
  return paths;
}

/**
 * Habillage commun à toutes les pages authentifiées, reproduisant la maquette de
 * référence : sidebar sombre `#0b0f1e` (groupes de section, sous-menu dépliable),
 * topbar blanche (recherche, notifications, identité, déconnexion).
 */
export default function DashboardShell({ children, pageTitle }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotificationsContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const theme = getRoleTheme(user?.role);
  const [docsOpen, setDocsOpen] = useState(true);
  // Admin et Université (sans pastille de rôle pleine) ont un logo plus grand dans la
  // maquette (40px/19px) que les autres rôles, dont la sidebar affiche une pastille sous
  // le logo (34px/16px).
  const largeLogo = !theme.badge;
  const logoSize = largeLogo ? 40 : 34;
  const titleSize = largeLogo ? 19 : 16;

  const flatItems = flattenPaths(theme.menu);
  const activeItem = flatItems.find((m) => m.path === location.pathname);
  const title = pageTitle || activeItem?.label || 'Tableau de bord';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#eceef4', display: 'flex', justifyContent: 'center', p: { xs: '14px', md: '28px 20px' },
      fontFamily: "'DM Sans', Helvetica, Arial, sans-serif",
    }}>
    <Box sx={{
      display: 'flex', width: '100%', maxWidth: CANVAS_MAX_WIDTH, alignItems: 'flex-start',
      boxShadow: '0 1px 3px rgba(23,26,43,0.10)',
    }}>
      <Box sx={{
        width: DRAWER_WIDTH, flexShrink: 0, bgcolor: SIDEBAR_BG, color: '#fff',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: { xs: '14px', md: '28px' },
        alignSelf: 'flex-start', borderTopLeftRadius: '14px', borderBottomLeftRadius: '14px', overflow: 'hidden',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.3, p: '20px 16px 14px' }}>
          <Box sx={{ width: logoSize, height: logoSize, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BrandLogo size={logoSize} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontSize: titleSize, fontWeight: 700, lineHeight: 1.1 }}>TrustWedge</Typography>
            <Typography sx={{ color: '#9aa1c8', fontSize: 10, mt: 0.4 }}>Plateforme de Confiance</Typography>
          </Box>
        </Box>

        {theme.institution && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.3, p: '12px 16px',
            bgcolor: '#12172c', borderTop: '1px solid #1a1f38', borderBottom: '1px solid #1a1f38',
          }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: theme.accent, fontSize: 13 }}>
              {initials(user?.full_name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#fff', fontSize: 12.5, fontWeight: 500 }} noWrap>{user?.full_name}</Typography>
              <Typography sx={{ color: '#9aa1c8', fontSize: 10.5 }}>{theme.roleLabel}</Typography>
            </Box>
          </Box>
        )}

        {theme.badge && (
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Box
              component="span"
              sx={{
                display: 'inline-block', p: '4px 10px', borderRadius: '6px',
                bgcolor: theme.badgeSoft ? `${theme.accent}22` : theme.accent,
                color: theme.badgeSoft ? theme.accent : '#fff',
                fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em',
              }}
            >
              {theme.badge}
            </Box>
          </Box>
        )}

        <List sx={{ flex: 1, px: '12px', py: '14px 0 0' }}>
          {theme.menu.map((item, i) => {
            if (item.section) {
              return (
                <Typography key={`s${i}`} sx={{
                  p: '0 13px 8px', mt: '18px', fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '0.12em', color: '#6a7099',
                }}>
                  {item.section}
                </Typography>
              );
            }
            if (item.expandable) {
              const childActive = item.children.some((c) => c.path === location.pathname);
              return (
                <Box key={item.label}>
                  <ListItemButton
                    onClick={() => setDocsOpen((v) => !v)}
                    sx={{
                      borderRadius: '9px', mb: '1px', py: '10px', px: '13px', gap: '10px',
                      color: childActive ? '#fff' : '#c3c7e2',
                      bgcolor: childActive ? theme.accent : 'transparent',
                      '&:hover': { bgcolor: childActive ? theme.accent : 'rgba(255,255,255,0.08)', color: '#fff' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 16, color: 'inherit' }}>
                      <MenuIcon name={item.icon} sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: 13, fontWeight: childActive ? 700 : 500 }}>{item.label}</ListItemText>
                    <ExpandMoreIcon sx={{ fontSize: 16, transform: docsOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                  </ListItemButton>
                  {docsOpen && (
                    <Box sx={{ ml: '6px', pl: '8px', borderLeft: '1px solid #22264a', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {item.children.map((c) => {
                        const active = c.path === location.pathname;
                        return (
                          <ListItemButton
                            key={c.path}
                            component={Link}
                            to={c.path}
                            sx={{
                              borderRadius: '8px', py: '8px', px: '13px', gap: '9px',
                              color: active ? '#fff' : '#a8ade0',
                              bgcolor: active ? theme.accent : 'transparent',
                              '&:hover': { bgcolor: active ? theme.accent : 'rgba(255,255,255,0.08)', color: '#fff' },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 14, color: 'inherit' }}>
                              <MenuIcon name={c.icon} sx={{ fontSize: 14 }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: 12.5, fontWeight: active ? 700 : 400 }}>{c.label}</ListItemText>
                          </ListItemButton>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            }
            const active = item.path === location.pathname;
            return (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                sx={{
                  borderRadius: '9px', mb: '1px', py: active ? '11px' : '10px', px: '13px', gap: '10px',
                  color: active ? '#fff' : '#c3c7e2',
                  bgcolor: active ? theme.accent : 'transparent',
                  '&:hover': { bgcolor: active ? theme.accent : 'rgba(255,255,255,0.08)', color: '#fff' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 16, color: 'inherit' }}>
                  <MenuIcon name={item.icon} sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>
                  {item.label}
                </ListItemText>
                {item.path === '/notifications' && unreadCount > 0 && (
                  <Box sx={{
                    minWidth: 18, height: 18, px: '5px', borderRadius: '999px', bgcolor: theme.accent, color: '#fff',
                    fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unreadCount}
                  </Box>
                )}
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ p: '0 12px 12px' }}>
          <Box sx={{
            p: '11px', borderRadius: '12px', bgcolor: '#1b1e3c',
            display: 'flex', alignItems: 'center', gap: 1.3,
          }}>
            <Avatar component={Link} to="/profile" sx={{ width: 34, height: 34, bgcolor: theme.accent, fontSize: 11, textDecoration: 'none' }}>
              {initials(user?.full_name)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 500 }} noWrap>{user?.full_name}</Typography>
              <Typography sx={{ color: '#9aa1c8', fontSize: 10 }} noWrap>{theme.roleLabel}</Typography>
            </Box>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e' }} />
          </Box>
        </Box>
      </Box>

      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: '#f7f8fc',
        borderTopRightRadius: '14px', borderBottomRightRadius: '14px', overflow: 'hidden',
      }}>
        <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #eceef4', display: 'flex', gap: 2.5, minHeight: '62px !important', p: '14px 26px !important' }}>
          <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{title}</Typography>
          <Box sx={{ flex: 1 }} />
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, width: 200, p: '9px 13px',
            borderRadius: '9px', bgcolor: '#f4f5fa', border: '1px solid #eceef4', boxSizing: 'border-box',
          }}>
            <SearchIcon sx={{ fontSize: 15, color: '#b6bacb' }} />
            <Typography sx={{ fontSize: 12.5, color: '#a3a8b8' }}>Rechercher...</Typography>
          </Box>
          <IconButton onClick={() => navigate('/notifications')} sx={{ color: '#5b6070', p: 0.5 }}>
            <Badge badgeContent={unreadCount} sx={{ '& .MuiBadge-badge': { bgcolor: theme.accent, color: '#fff', minWidth: 15, height: 15, fontSize: 9 } }}>
              <NotificationsIcon sx={{ fontSize: 19 }} />
            </Badge>
          </IconButton>
          <Box sx={{ width: '1px', height: '26px', bgcolor: '#eceef4', flexShrink: 0 }} />
          <Box component={Link} to="/profile" sx={{ display: 'flex', alignItems: 'center', gap: 1.2, textDecoration: 'none' }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: `${theme.accent}22`, color: theme.accent, fontSize: 12 }}>
              {initials(user?.full_name)}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: '#171a2b' }}>{user?.full_name}</Typography>
              <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>{theme.roleLabel}</Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleLogout} title="Se déconnecter"
            sx={{ width: 34, height: 34, border: '1px solid #e7e9f2', borderRadius: '9px', color: '#5b6070' }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Toolbar>
        <Box sx={{ flex: 1, p: '22px 26px 30px', boxSizing: 'border-box' }}>
          {children}
        </Box>
      </Box>
    </Box>
    </Box>
  );
}
