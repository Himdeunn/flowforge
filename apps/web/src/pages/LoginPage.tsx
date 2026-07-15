import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginTenantSlug, setLoginTenantSlug] = useState('');

  // Register form
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginTenantSlug, email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(tenantName, tenantSlug, regEmail, regPassword);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">⚡ FlowForge</div>
        <p className="auth-tagline">Real-Time Workflow Orchestration Engine</p>

        <div className="auth-tab-group">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
            id="tab-login"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
            id="tab-register"
          >
            Create Account
          </button>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} id="login-form">
            <div className="form-group">
              <label className="form-label">Organization Slug</label>
              <input
                id="login-tenant-slug"
                className="form-input"
                type="text"
                placeholder="acme-corp"
                value={loginTenantSlug}
                onChange={(e) => setLoginTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="login-email"
                className="form-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} id="register-form">
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input
                id="register-tenant-name"
                className="form-input"
                type="text"
                placeholder="Acme Corp"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Slug (unique ID)</label>
              <input
                id="register-tenant-slug"
                className="form-input"
                type="text"
                placeholder="acme-corp"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="register-email"
                className="form-input"
                type="email"
                placeholder="admin@acme.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="register-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>
            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
