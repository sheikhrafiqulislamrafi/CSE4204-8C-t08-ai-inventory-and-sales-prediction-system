import { useState, useEffect } from 'react';
import {
  ClipboardList, Search, Filter, Calendar, Activity, 
  ChevronDown, ChevronUp, User, Package, TrendingUp, Settings, Users
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const ENTITY_ICONS = {
  order: <Package size={14} color="#3b82f6" />,
  product: <Package size={14} color="#a855f7" />,
  investment: <TrendingUp size={14} color="#f97316" />,
  staff: <Users size={14} color="#06b6d4" />,
  settings: <Settings size={14} color="#64748b" />,
};

const ACTION_COLORS = {
  create: 'badge-green',
  update: 'badge-blue',
  delete: 'badge-red',
};

export default function AuditLog({ user, onLogout }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);


  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    search: '',
    start_date: '',
    end_date: ''
  });

  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (user?.role !== 'owner') return;
    fetchLogs();
  }, [page, filters]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const data = await api.auditLog.list({ ...filters, page, limit: 50 });
      setLogs(data.items);
      setTotalPages(data.pages);
      setTotalItems(data.total);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown Date';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const renderDetails = (details) => {
    if (!details) return null;
    

    if (details.old && details.new) {
      const changedKeys = Object.keys(details.new).filter(
        k => details.new[k] !== details.old[k]
      );
      
      if (changedKeys.length === 0) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>No fields changed.</div>;

      return (
        <div style={{ marginTop: '0.75rem', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem', color: 'var(--text-muted)', width: '30%' }}>Field</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem', color: '#ef4444', width: '35%' }}>Old Value</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.5rem', color: '#10b981', width: '35%' }}>New Value</th>
              </tr>
            </thead>
            <tbody>
              {changedKeys.map(key => (
                <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>{key}</td>
                  <td style={{ padding: '0.5rem 0', color: 'rgba(239, 68, 68, 0.9)', wordBreak: 'break-all' }}>{String(details.old[key] ?? 'null')}</td>
                  <td style={{ padding: '0.5rem 0', color: 'rgba(16, 185, 129, 0.9)', wordBreak: 'break-all' }}>{String(details.new[key] ?? 'null')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    

    return (
      <pre style={{ marginTop: '0.75rem', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  };

  if (user?.role !== 'owner') {
    return (
      <div className="app-layout">
        <Sidebar user={user} onLogout={onLogout} />
        <div className="main-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '400px' }}>
            <Activity size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)' }}>Only the business owner can view the audit log.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />
      
      <div className="main-area">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={24} color="#8b5cf6" /> Audit Log
            </h1>
            <p>Track all activities and changes across your business.</p>
          </div>
          <div className="badge badge-purple">
            <Activity size={14} style={{ marginRight: '4px' }} /> {totalItems} events found
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {}
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label><Search size={14} style={{ display: 'inline', marginRight: '4px' }}/> Search</label>
              <input
                className="form-input"
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search summaries or users..."
              />
            </div>
            <div className="form-group" style={{ width: '160px' }}>
              <label><Filter size={14} style={{ display: 'inline', marginRight: '4px' }}/> Entity</label>
              <select className="form-input" name="entity" value={filters.entity} onChange={handleFilterChange}>
                <option value="">All Entities</option>
                <option value="order">Orders</option>
                <option value="product">Products</option>
                <option value="investment">Investments</option>
                <option value="staff">Staff</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            <div className="form-group" style={{ width: '160px' }}>
              <label><Activity size={14} style={{ display: 'inline', marginRight: '4px' }}/> Action</label>
              <select className="form-input" name="action" value={filters.action} onChange={handleFilterChange}>
                <option value="">All Actions</option>
                <option value="create">Created</option>
                <option value="update">Updated</option>
                <option value="delete">Deleted</option>
              </select>
            </div>
            <div className="form-group" style={{ width: '150px' }}>
              <label><Calendar size={14} style={{ display: 'inline', marginRight: '4px' }}/> Start Date</label>
              <input
                className="form-input"
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group" style={{ width: '150px' }}>
              <label><Calendar size={14} style={{ display: 'inline', marginRight: '4px' }}/> End Date</label>
              <input
                className="form-input"
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
              />
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <button
                className="btn btn-ghost"
                style={{ height: '42px' }}
                onClick={() => {
                  setFilters({ entity: '', action: '', search: '', start_date: '', end_date: '' });
                  setPage(1);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading && logs.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <span className="loading-dots">Loading<span>.</span><span>.</span><span>.</span></span>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <ClipboardList size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No audit events found matching your filters.</p>
            </div>
          ) : (
            <div>
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  style={{ 
                    padding: '1.25rem', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    gap: '1.5rem',
                    background: expandedId === log.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                    transition: 'background 0.2s ease'
                  }}
                >
                  {}
                  <div style={{ width: '100px', flexShrink: 0, textAlign: 'right', paddingTop: '4px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                      {formatDate(log.created_at).split(',')[1]?.trim() || formatDate(log.created_at)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {formatDate(log.created_at).split(',')[0]}
                    </div>
                  </div>
                  
                  {}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${ACTION_COLORS[log.action] || 'badge-gray'}`} style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                        {log.action}
                      </span>
                      <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                        {ENTITY_ICONS[log.entity] || <Activity size={14} />} {log.entity}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                        <User size={12} /> {log.user_email}
                      </span>
                    </div>
                    
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.95rem' }}>
                      {log.summary}
                    </p>
                    
                    {}
                    {log.details && expandedId === log.id && (
                      <div className="animate-fade-in">
                        {renderDetails(log.details)}
                      </div>
                    )}
                  </div>

                  {}
                  {log.details && (
                    <div style={{ flexShrink: 0 }}>
                      <button 
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.5rem' }}
                        onClick={() => toggleExpand(log.id)}
                        title={expandedId === log.id ? "Hide Details" : "View Details"}
                      >
                        {expandedId === log.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        {totalPages > 1 && (
          <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-ghost"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-ghost"
              >
                Next
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
