import { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Store, Search, XCircle, Users, TrendingUp } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function AdminDashboard({ user, onLogout }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.admin.getShops();
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const displayed = shops.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.business_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q)
    );
  });


  const totalShops = shops.length;
  const ownerShops = shops.filter(s => s.role === 'owner').length;
  const adminShops = shops.filter(s => s.role === 'admin').length;
  
  const totalPlatformRevenue = shops.reduce((sum, s) => sum + (s.total_revenue || 0), 0);


  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.admin.deleteShop(deleteId);
      setDeleteId(null);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteId(null);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldAlert size={26} color="#fbbf24" />
            Platform Admin
          </h1>
          <p>Global oversight of all registered businesses.</p>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <span className="loading-dots">Loading<span>.</span><span>.</span><span>.</span></span>
          </div>
        ) : (
          <>
            {}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p className="kpi-label">Platform Revenue</p>
                  <p className="kpi-value" style={{ color: '#8b5cf6' }}>৳{totalPlatformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <TrendingUp size={22} color="#8b5cf6" />
                </div>
              </div>
              <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p className="kpi-label">Total Users</p>
                  <p className="kpi-value" style={{ color: '#60a5fa' }}>{totalShops}</p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Users size={22} color="#60a5fa" />
                </div>
              </div>
              <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p className="kpi-label">Total Owners</p>
                  <p className="kpi-value" style={{ color: '#34d399' }}>{ownerShops}</p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <Store size={22} color="#34d399" />
                </div>
              </div>
              <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p className="kpi-label">Platform Admins</p>
                  <p className="kpi-value" style={{ color: '#fbbf24' }}>{adminShops}</p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(251,191,36,0.15)' }}>
                  <ShieldAlert size={22} color="#fbbf24" />
                </div>
              </div>
            </div>

            {}
            <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by business name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              {search && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
                  <XCircle size={14} /> Clear
                </button>
              )}
            </div>

            {}
            <div className="glass-card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Business Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Total Orders</th>
                      <th>Total Revenue</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((shop) => (
                      <tr key={shop.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>#{shop.id}</td>
                        <td style={{ fontWeight: 600 }}>{shop.business_name || '—'}</td>
                        <td>{shop.email}</td>
                        <td>
                          <span className={`badge ${shop.role === 'admin' ? 'badge-purple' : shop.role === 'owner' ? 'badge-blue' : 'badge-gray'}`}>
                            {shop.role}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{shop.total_orders || 0}</td>
                        <td style={{ color: '#34d399', fontWeight: 600 }}>৳{(shop.total_revenue || 0).toLocaleString()}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteId(shop.id)}
                            title="Permanently Delete Shop"
                            disabled={shop.id === user.id}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayed.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No shops found.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#f87171' }}>Delete Shop?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you absolutely sure you want to permanently delete this user?
              <strong> This action will cascade and irreversibly destroy all their orders, products, and investments.</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
