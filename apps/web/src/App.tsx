import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkflowsPage from './pages/WorkflowsPage';
import RunsPage from './pages/RunsPage';
import AIBuilderPage from './pages/AIBuilderPage';
import Sidebar from './components/Sidebar';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState('dashboard');

  // Fix: Redirect to root / if user is authenticated but path says /login
  useEffect(() => {
    if (isAuthenticated && (window.location.pathname === '/login' || window.location.pathname.endsWith('/login'))) {
      window.history.pushState({}, '', '/');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'workflows': return <WorkflowsPage />;
      case 'runs': return <RunsPage />;
      case 'ai-builder': return <AIBuilderPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={setPage} />
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
