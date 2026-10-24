import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingDown,
  Package,
  Users,
  BrainCircuit,
  Settings,
  Sparkles,
  LogOut,
  ShieldAlert,
  Calendar,
  UserCog,
  ClipboardList,
  LineChart,
  FileText,
  BookOpen,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',  path: '/dashboard' },
  { icon: ShoppingCart,    label: 'Sales',       path: '/sales' },
  { icon: TrendingDown,    label: 'Investments', path: '/investments', roles: ['owner'] },
  { icon: Package,         label: 'Products',    path: '/products' },
  { icon: Users,           label: 'Customers',   path: '/customers' },
  { icon: Calendar,        label: 'Daily Insights', path: '/daily-insights', roles: ['owner'] },
  { icon: BrainCircuit,    label: 'AI Insights', path: '/insights', roles: ['owner'] },
  { icon: Layers,          label: 'Compare',     path: '/compare', roles: ['owner'] },
  { icon: LineChart,       label: 'Forecast',    path: '/forecast', roles: ['owner'] },
  { icon: FileText,        label: 'Reports',     path: '/reports', roles: ['owner'] },
  { icon: BookOpen,        label: 'Accounting',  path: '/accounting', roles: ['owner'] },
  { icon: UserCog,         label: 'Staff',       path: '/staff', roles: ['owner'] },
  { icon: ClipboardList,   label: 'Audit Log',   path: '/audit-log', roles: ['owner'] },
  { icon: Settings,        label: 'Settings',    path: '/settings', roles: ['owner'] },
];

function roleBadgeClass(role) {
  if (role === 'owner') return 'badge badge-blue';
  if (role === 'admin') return 'badge badge-purple';
  return 'badge badge-gray';
}

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(true);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ position: 'fixed', top: 10, left: 10, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(11,12,21,0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 10px', fontSize: '.85rem', cursor: 'pointer' }}
        aria-label="Toggle sidebar"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <aside className="sidebar" style={{ display: open ? 'flex' : 'none', position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 999, background: 'var(--surface)' }}>
      {}
      <div className="nav-brand">
        <Sparkles size={22} color="#8b5cf6" />
        <h2>myShop AI</h2>
      </div>

      {}
      <nav style={{ flex: 1 }}>
        {user?.role !== 'admin' && NAV_ITEMS
          .filter(item => !item.roles || item.roles.includes(user?.role))
          .map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(path)}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}

        {user?.role === 'admin' && (
          <button
            className={`nav-item${location.pathname === '/admin' ? ' active' : ''}`}
            onClick={() => navigate('/admin')}
            style={{ color: '#fbbf24' }}
          >
            <ShieldAlert size={18} />
            Platform Admin
          </button>
        )}
      </nav>

      {}
      <div className="nav-user">
        <div style={{ marginBottom: '0.875rem' }}>
          {user?.business_name && (
            <p
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.2rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.business_name}
            </p>
          )}
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email || ''}
          </p>
          <span className={roleBadgeClass(user?.role)} style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
            {user?.role || 'user'}
          </span>
        </div>

        {}
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          <span style={{ flex: 1, textAlign: 'left' }}>
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <div className={`toggle-track ${theme === 'dark' ? 'active' : ''}`}>
            <div className="toggle-thumb" />
          </div>
        </button>

        <button
          onClick={onLogout}
          className="btn btn-danger btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
    </>
  );
}
