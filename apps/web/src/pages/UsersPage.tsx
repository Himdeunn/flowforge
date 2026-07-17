import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../lib/api-helpers';
import { useAuth } from '../contexts/AuthContext';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');

  const [showEdit, setShowEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('viewer');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setEmail('');
      setPassword('');
      setRole('viewer');
    },
    onError: (err: any) => {
      alert(`Failed to create user: ${err.response?.data?.message || err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => usersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEdit(false);
      setEditingUserId(null);
      setEditPassword('');
    },
    onError: (err: any) => {
      alert(`Failed to update user: ${err.response?.data?.message || err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      alert(`Failed to delete user: ${err.response?.data?.message || err.message}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ email, password, role });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { role: editRole, email: editEmail };
    if (editPassword) {
      payload.password = editPassword;
    }
    if (editingUserId) {
      updateMutation.mutate({ id: editingUserId, payload });
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-danger)' }}>Access Denied</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Only administrators can manage users in this organization.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage users and assign access roles (Admin, Editor, Viewer)</p>
        </div>
        <button id="btn-create-user" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Add User
        </button>
      </div>

      {isLoading ? (
        <div className="loading-center"><span className="spinner" /></div>
      ) : !users || users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>No users found</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Access Role</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.email} {u.id === user.id && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400 }}>(You)</span>}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : u.role === 'editor' ? 'badge-warning' : 'badge-neutral'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingUserId(u.id);
                          setEditEmail(u.email);
                          setEditRole(u.role);
                          setShowEdit(true);
                        }}
                      >
                        Edit
                      </button>
                      {u.id !== user.id && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete user "${u.email}"?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2 className="modal-title">Add User</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@organization.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Access Role *</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <span className="spinner" /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2 className="modal-title">Edit User</h2>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="user@organization.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  className="form-input"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Access Role *</label>
                <select className="form-select" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <span className="spinner" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
