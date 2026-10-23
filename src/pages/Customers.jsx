import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  XCircle,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  MessageCircle,
  Sparkles,
  Copy,
  ExternalLink,
  PieChart as PieChartIcon,
  Clock,
  Tag,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const fmtCurrency = (num) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(num || 0));

const fmtDate = (d) => {
  if (!d) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function getCustomerBadge(customer) {
  if (customer.segment === 'VIP') return { label: 'VIP', cls: 'badge-purple' };
  if (customer.segment === 'Loyal') return { label: 'Loyal', cls: 'badge-green' };
  if (customer.segment === 'At-Risk') return { label: 'At-Risk', cls: 'badge-red' };
  return { label: 'New', cls: 'badge-blue' };
}

export default function Customers({ user, onLogout }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | at-risk

  const [winBackOpen, setWinBackOpen] = useState(false);
  const [winBackLoading, setWinBackLoading] = useState(false);
  const [winBackError, setWinBackError] = useState('');
  const [winBackResult, setWinBackResult] = useState(null);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [campaign, setCampaign] = useState({
    discount_percent: 10,
    inactive_days: 30,
    language: 'bn',
    custom_note: '',
    limit: 50,
  });

  useEffect(() => {
    load();
  }, [campaign.inactive_days]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.customers.list(campaign.inactive_days);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const sorted = useMemo(
    () => [...customers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)),
    [customers]
  );

  const filtered = useMemo(() => {
    let rows = sorted;
    if (filter === 'at-risk') rows = rows.filter((c) => c.is_at_risk);
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
  }, [sorted, search, filter]);

  const atRiskCustomers = useMemo(
    () => customers.filter((c) => c.is_at_risk),
    [customers]
  );

  const segmentData = useMemo(() => {
    const counts = { VIP: 0, Loyal: 0, New: 0, 'At-Risk': 0 };
    customers.forEach(c => {
      if (counts[c.segment] !== undefined) counts[c.segment]++;
    });
    return [
      { name: 'VIP', value: counts.VIP, color: '#c084fc' },
      { name: 'Loyal', value: counts.Loyal, color: '#34d399' },
      { name: 'New', value: counts.New, color: '#60a5fa' },
      { name: 'At-Risk', value: counts['At-Risk'], color: '#f87171' },
    ].filter(d => d.value > 0);
  }, [customers]);

  const totalCustomers = customers.length;
  const returning = customers.filter((c) => (c.total_orders || 0) > 1).length;
  const topRevenue = sorted[0]?.total_revenue || 0;
  const atRiskSpend = atRiskCustomers.reduce((sum, c) => sum + (c.total_revenue || 0), 0);

  function toggleSelect(phone) {
    if (!phone) return;
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  function selectAllAtRisk() {
    setSelectedPhones(new Set(atRiskCustomers.map((c) => c.phone).filter(Boolean)));
  }

  function clearSelection() {
    setSelectedPhones(new Set());
  }

  async function generateWinBack() {
    setWinBackLoading(true);
    setWinBackError('');
    setWinBackResult(null);
    try {
      const payload = {
        ...campaign,
        customer_phones:
          selectedPhones.size > 0 ? Array.from(selectedPhones) : undefined,
        selected_customer_name: selectedCustomer?.name || undefined,
        selected_customer_phone: selectedCustomer?.phone || undefined,
      };
      const data = await api.customers.winBackPreview(payload);
      setWinBackResult(data);
    } catch (err) {
      setWinBackError(err.message);
    } finally {
      setWinBackLoading(false);
    }
  }

  async function copyAllMessages() {
    if (!winBackResult?.messages?.length) return;
    const text = winBackResult.messages
      .map(
        (m) =>
          `${m.name || 'Customer'} (${m.phone || 'no phone'})\n${m.message}`
      )
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        <div className="page-header">
          <h1>Customer CRM</h1>
          <p>View customers, identify at-risk buyers, and launch win-back campaigns.</p>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <span className="loading-dots">
              Loading<span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        ) : (
          <>
            <div className="chart-grid-2x2">
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="section-title">
                  <PieChartIcon size={18} color="#60a5fa" />
                  Customer Segmentation
                </div>
                <div style={{ flex: 1, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={segmentData}
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {segmentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            background: 'var(--glass-bg)',
                            border: 'var(--glass-border)',
                            borderRadius: '12px',
                            boxShadow: 'var(--glass-shadow)',
                            color: 'var(--text-primary)'
                          }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="pie-legend" style={{ minWidth: 100 }}>
                    {segmentData.map(d => (
                      <div key={d.name} className="pie-legend-item">
                        <div className="pie-legend-dot" style={{ background: d.color }} />
                        <span>{d.name} <strong style={{ color: 'var(--text-primary)', marginLeft: '0.2rem' }}>({d.value})</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p className="kpi-label">Total Customers</p>
                    <p className="kpi-value" style={{ color: '#60a5fa' }}>{totalCustomers}</p>
                  </div>
                  <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Users size={22} color="#60a5fa" />
                  </div>
                </div>

                <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p className="kpi-label">Returning</p>
                    <p className="kpi-value" style={{ color: '#34d399' }}>{returning}</p>
                  </div>
                  <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <UserCheck size={22} color="#34d399" />
                  </div>
                </div>

                <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p className="kpi-label">At-risk (30+ days)</p>
                    <p className="kpi-value" style={{ color: '#f87171' }}>{atRiskCustomers.length}</p>
                  </div>
                  <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle size={22} color="#f87171" />
                  </div>
                </div>

                <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p className="kpi-label">At-risk Lifetime Spend</p>
                    <p className="kpi-value" style={{ color: '#c084fc' }}>{fmtCurrency(atRiskSpend)}</p>
                  </div>
                  <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
                    <TrendingUp size={22} color="#c084fc" />
                  </div>
                </div>
              </div>
            </div>

            {/* Win-back campaign panel */}
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginBottom: winBackOpen ? '1.25rem' : 0,
                }}
              >
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <MessageCircle size={18} color="#f87171" />
                  At-risk Customer Win-back
                </div>
                <button
                  className="btn btn-purple btn-sm"
                  onClick={() => setWinBackOpen((v) => !v)}
                >
                  <Sparkles size={14} />
                  {winBackOpen ? 'Hide Campaign' : 'Launch Win-back'}
                </button>
              </div>

              {winBackOpen && (
                <>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                    Generate personalized WhatsApp/SMS messages for customers who have not ordered in
                    {` ${campaign.inactive_days}+ days`}. Select specific customers or target all at-risk.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '0.75rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Discount %</label>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={90}
                        value={campaign.discount_percent}
                        onChange={(e) =>
                          setCampaign((c) => ({ ...c, discount_percent: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inactive days</label>
                      <input
                        type="number"
                        className="form-input"
                        min={7}
                        max={365}
                        value={campaign.inactive_days}
                        onChange={(e) =>
                          setCampaign((c) => ({ ...c, inactive_days: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Language</label>
                      <select
                        className="form-input"
                        value={campaign.language}
                        onChange={(e) => setCampaign((c) => ({ ...c, language: e.target.value }))}
                      >
                        <option value="bn">Bangla</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Max messages</label>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={500}
                        value={campaign.limit}
                        onChange={(e) =>
                          setCampaign((c) => ({ ...c, limit: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Custom note (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Free delivery on your next order"
                      value={campaign.custom_note}
                      onChange={(e) => setCampaign((c) => ({ ...c, custom_note: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={selectAllAtRisk}>
                      Select all at-risk ({atRiskCustomers.length})
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                      Clear selection ({selectedPhones.size})
                    </button>
                    {selectedCustomer && (
                      <button className="btn btn-purple btn-sm" onClick={() => { setSelectedPhones(new Set([selectedCustomer.phone])); generateWinBack(); }}>
                        <Sparkles size={14} /> For {selectedCustomer.name || 'selected'}
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={generateWinBack}
                      disabled={winBackLoading || atRiskCustomers.length === 0}
                    >
                      {winBackLoading ? (
                        <span className="loading-dots">Generating<span>.</span><span>.</span></span>
                      ) : (
                        <>
                          <Sparkles size={14} /> Generate Messages
                        </>
                      )}
                    </button>
                  </div>

                  {winBackError && <div className="error-message">{winBackError}</div>}

                  {winBackResult && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                      <p style={{ color: '#c084fc', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Campaign Brief
                      </p>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                        {winBackResult.campaign_brief}
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <span className="badge badge-red">{winBackResult.at_risk_count} messages</span>
                        <span className="badge badge-purple">
                          {fmtCurrency(winBackResult.combined_lifetime_spend)} lifetime spend
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={copyAllMessages}>
                          <Copy size={14} /> Copy all
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 420, overflowY: 'auto' }}>
                        {winBackResult.messages.map((msg, i) => (
                          <div
                            key={`${msg.phone}-${i}`}
                            className="glass-card"
                            style={{ padding: '1rem', background: 'rgba(15,23,42,0.5)' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                              <div>
                                <strong>{msg.name || 'Customer'}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                  {msg.phone || '—'} · {msg.days_inactive ?? '—'} days inactive
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => navigator.clipboard.writeText(msg.message)}
                                >
                                  <Copy size={12} />
                                </button>
                                {msg.whatsapp_url && (
                                  <a
                                    className="btn btn-ghost btn-sm"
                                    href={msg.whatsapp_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <ExternalLink size={12} /> WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.7, fontSize: '0.9rem' }}>
                              {msg.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['all', 'at-risk'].map((key) => (
                  <button
                    key={key}
                    className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setFilter(key)}
                  >
                    {key === 'all' ? 'All Customers' : `At-risk (${atRiskCustomers.length})`}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <Search
                  size={16}
                  color="var(--text-muted)"
                  style={{
                    position: 'absolute',
                    left: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by name or phone..."
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

            <div className="glass-card">
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-muted)' }}>
                  <Users size={48} style={{ marginBottom: '1rem', opacity: 0.35 }} />
                  <p style={{ fontSize: '0.95rem' }}>
                    {filter === 'at-risk'
                      ? 'No at-risk customers — great retention!'
                      : search
                        ? 'No customers match your search.'
                        : 'No customer data yet.'}
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Last Order</th>
                        <th>Days Inactive</th>
                        <th>Fav Category</th>
                        <th>Orders</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((customer, i) => {
                        const badge = getCustomerBadge(customer);
                        const phone = customer.phone;
                        const checked = phone && selectedPhones.has(phone);
                        return (
                          <tr 
                            key={phone || i} 
                            style={{ ...(customer.is_at_risk ? { background: 'rgba(239,68,68,0.04)' } : {}), cursor: 'pointer' }}
                            onClick={() => setSelectedCustomer(customer)}
                            className="hover-row"
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              {customer.is_at_risk && phone ? (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelect(phone)}
                                />
                              ) : null}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                              {i + 1}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    background: customer.is_at_risk
                                      ? 'rgba(239,68,68,0.15)'
                                      : 'rgba(139,92,246,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: customer.is_at_risk ? '#f87171' : '#c084fc',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {(customer.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p style={{ fontWeight: 600, marginBottom: badge ? '0.2rem' : 0 }}>
                                    {customer.name || 'Unknown'}
                                  </p>
                                  {badge && (
                                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>{customer.phone || '—'}</td>
                            <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {fmtDate(customer.last_order)}
                            </td>
                            <td style={{ color: customer.is_at_risk ? '#f87171' : 'var(--text-secondary)', fontWeight: customer.is_at_risk ? 600 : 400 }}>
                              {customer.days_since_last_order != null ? `${customer.days_since_last_order}d` : '—'}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Tag size={12} color="var(--text-muted)" />
                                {customer.favorite_category || '—'}
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{customer.total_orders || 0}</td>
                            <td style={{ fontWeight: 700, color: '#34d399' }}>
                              {fmtCurrency(customer.total_revenue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} color="#60a5fa" />
                Customer Details
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-card" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>Name</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCustomer.name}</p>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{selectedCustomer.phone}</p>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>Segment</p>
                  {getCustomerBadge(selectedCustomer) ? (
                    <span className={`badge ${getCustomerBadge(selectedCustomer).cls}`}>
                      {getCustomerBadge(selectedCustomer).label}
                    </span>
                  ) : <span className="badge badge-gray">{selectedCustomer.segment || 'Unknown'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>Lifetime Spend</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{fmtCurrency(selectedCustomer.total_revenue)}</p>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} color="var(--text-muted)" />
                  Recent Timeline
                </h3>
                {selectedCustomer.timeline && selectedCustomer.timeline.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 15, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.1)' }} />
                    {selectedCustomer.timeline.map((event, i) => (
                      <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.1rem' }}>
                          <ShoppingBag size={14} color="var(--text-secondary)" />
                        </div>
                        <div className="glass-card" style={{ flex: 1, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>{event.product || 'Unknown Product'}</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{fmtDate(event.date)} · <span style={{ color: event.status === 'delivered' ? '#34d399' : event.status === 'cancelled' ? '#f87171' : '#fbbf24', textTransform: 'capitalize' }}>{event.status}</span></p>
                          </div>
                          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {event.amount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No detailed order history available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
