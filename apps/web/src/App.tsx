import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkflowsPage from './pages/WorkflowsPage';
import RunsPage from './pages/RunsPage';
import AIBuilderPage from './pages/AIBuilderPage';
import UsersPage from './pages/UsersPage';
import Sidebar from './components/Sidebar';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;
    if (path === '/workflows') return 'workflows';
    if (path === '/history') return 'runs';
    if (path === '/ai-builder') return 'ai-builder';
    if (path === '/users') return 'users';
    return 'dashboard';
  });

  // Sync state when browser navigation happens (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/workflows') setPage('workflows');
      else if (path === '/history') setPage('runs');
      else if (path === '/ai-builder') setPage('ai-builder');
      else if (path === '/users') setPage('users');
      else setPage('dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate function to change page state and push history path
  const navigateTo = (newPage: string) => {
    setPage(newPage);
    let path = '/';
    if (newPage === 'workflows') path = '/workflows';
    else if (newPage === 'runs') path = '/history';
    else if (newPage === 'ai-builder') path = '/ai-builder';
    else if (newPage === 'users') path = '/users';

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  // Fix: Redirect to root / if user is authenticated but path says /login
  useEffect(() => {
    if (isAuthenticated && (window.location.pathname === '/login' || window.location.pathname.endsWith('/login'))) {
      window.history.pushState({}, '', '/');
      setPage('dashboard');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'workflows': return <WorkflowsPage />;
      case 'runs': return <RunsPage />;
      case 'ai-builder': return <AIBuilderPage />;
      case 'users': return <UsersPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={navigateTo} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
