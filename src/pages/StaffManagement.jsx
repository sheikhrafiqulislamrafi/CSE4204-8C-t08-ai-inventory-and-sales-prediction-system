import { useState, useEffect } from 'react';
import { UserCog, Plus, Trash2, XCircle, ShieldAlert } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function StaffManagement({ user, onLogout }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (user?.role !== 'owner') return;
    fetchStaff();
  }, [user]);

  async function fetchStaff() {
    try {
      const data = await api.staff.list();
      setStaff(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await api.staff.create(formData);
      setModalOpen(false);
      setFormData({ name: '', email: '', password: '' });
      fetchStaff();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleRemove(id) {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await api.staff.remove(id);
      fetchStaff();
    } catch (err) {
      alert(`Error removing staff: ${err.message}`);
    }
  }

  if (user?.role !== 'owner') {
    return (
      <div className="app-layout">
        <Sidebar user={user} onLogout={onLogout} />
        <div className="main-area flex-center">
          <div className="card text-center" style={{ maxWidth: 400 }}>
            <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h2 style={{ marginBottom: '0.5rem' }}>Access Denied</h2>
            <p className="text-secondary">Only the shop owner can manage staff.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="main-area">
        <div className="page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCog size={28} color="#8b5cf6" />
              Staff Management
            </h1>
            <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
              Manage staff accounts that can log in and manage your shop.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={18} />
              Add Staff
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
            <XCircle size={18} /> {error}
          </div>
        )}

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ padding: '3rem' }}>
                      <div className="spinner"></div>
                      <p style={{ marginTop: '1rem' }} className="text-secondary">Loading staff...</p>
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-secondary" style={{ padding: '3rem' }}>
                      No staff accounts found. Click "Add Staff" to create one.
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>{s.email}</td>
                      <td>
                        <span className="badge badge-gray">Staff</span>
                      </td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem', background: 'transparent', color: '#ef4444' }}
                          onClick={() => handleRemove(s.id)}
                          title="Remove Staff"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {}
      {modalOpen && (
        <div 
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add Staff Member</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)} style={{ padding: '0.25rem' }}>
                <XCircle size={20} />
              </button>
            </div>

            {modalError && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}
            <form id="staffForm" onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name</label>
                <input
                  className="form-input"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahul Hasan"
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@myshop.com"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  className="form-input"
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-ghost" onClick={() => setModalOpen(false)} type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={modalLoading}>
                  {modalLoading ? (
                    <span className="loading-dots">
                      Creating<span>.</span><span>.</span><span>.</span>
                    </span>
                  ) : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
