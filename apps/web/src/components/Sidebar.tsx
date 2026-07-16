import { useAuth } from '../contexts/AuthContext';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: Props) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '' },
    { id: 'workflows', label: 'Workflows', icon: '' },
    { id: 'runs', label: 'Run History', icon: '' },
    { id: 'ai-builder', label: 'Workflow Generator', icon: '' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">FlowForge</div>

      {navItems.map((item) => (
        <button
          key={item.id}
          id={`nav-${item.id}`}
          className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}

      <div className="sidebar-footer">
        {user && (
          <div style={{ padding: '0 8px', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {user.role}
            </p>
          </div>
        )}
        <button
          id="btn-logout"
          className="sidebar-nav-item"
          onClick={logout}
          style={{ color: 'var(--color-danger)' }}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
