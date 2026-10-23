import { useState, useEffect } from 'react';
import { Calendar, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const fmtCurrency = (num) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(num || 0));

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const DEFAULT_RANGE_DAYS = 14;

function toDateInputValue(date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split('T')[0];
}

function buildDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return toDateInputValue(date);
}

export default function DailyInsights({ user, onLogout }) {
  const [dailyData, setDailyData] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');
  const [dailyStart, setDailyStart] = useState(buildDefaultStartDate);
  const [dailyEnd, setDailyEnd] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    loadDailyInsights();
  }, [dailyStart, dailyEnd]);

  async function loadDailyInsights() {
    setDailyLoading(true);
    setDailyError('');
    try {
      const data = await api.analytics.daily(dailyStart, dailyEnd);
      setDailyData(Array.isArray(data) ? data : []);
    } catch (err) {
      setDailyError(err.message);
      setDailyData([]);
    } finally {
      setDailyLoading(false);
    }
  }

  const dailySummary = dailyData.reduce(
    (acc, row) => {
      acc.orders += row.orders || 0;
      acc.revenue += row.revenue || 0;
      acc.delivery_cost += row.delivery_cost || 0;
      acc.profit += row.profit || 0;
      if (!acc.bestDay || (row.profit || 0) > (acc.bestDay.profit || 0)) acc.bestDay = row;
      if (!acc.worstDay || (row.profit || 0) < (acc.worstDay.profit || 0)) acc.worstDay = row;
      return acc;
    },
    { orders: 0, revenue: 0, delivery_cost: 0, profit: 0, bestDay: null, worstDay: null }
  );

  const dailyAverageOrder = dailySummary.orders > 0 ? dailySummary.revenue / dailySummary.orders : 0;

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        {}
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BarChart3 size={28} color="#34d399" />
            Daily Insights
          </h1>
          <p>Track your daily performance and trends</p>
        </div>

        {}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
            }}
          >
            <div className="section-title" style={{ marginBottom: 0 }}>
              <BarChart3 size={18} color="#34d399" />
              Per Day Sales Insights
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dailyStart}
                  onChange={(e) => setDailyStart(e.target.value)}
                  style={{ minWidth: 150 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dailyEnd}
                  onChange={(e) => setDailyEnd(e.target.value)}
                  style={{ minWidth: 150 }}
                />
              </div>
            </div>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Track revenue, delivery cost, profit, and average order value day by day over the selected range.
          </p>

          {dailyError && <div className="error-message" style={{ marginBottom: '1rem' }}>{dailyError}</div>}

          <div className="kpi-grid-8" style={{ marginBottom: '1.25rem' }}>
            <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p className="kpi-label">Total Orders</p>
                <p className="kpi-value" style={{ color: '#60a5fa' }}>{dailySummary.orders}</p>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Activity size={22} color="#60a5fa" />
              </div>
            </div>
            <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p className="kpi-label">Revenue</p>
                <p className="kpi-value" style={{ color: '#34d399' }}>{fmtCurrency(dailySummary.revenue)}</p>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <TrendingUp size={22} color="#34d399" />
              </div>
            </div>
            <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p className="kpi-label">Profit</p>
                <p className="kpi-value" style={{ color: (dailySummary.profit || 0) >= 0 ? '#34d399' : '#f87171' }}>{fmtCurrency(dailySummary.profit)}</p>
              </div>
              <div className="kpi-icon" style={{ background: (dailySummary.profit || 0) >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                <TrendingDown size={22} color={(dailySummary.profit || 0) >= 0 ? '#34d399' : '#f87171'} />
              </div>
            </div>
            <div className="glass-card kpi-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p className="kpi-label">Avg Order Value</p>
                <p className="kpi-value" style={{ color: '#c084fc' }}>{fmtCurrency(dailyAverageOrder)}</p>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <Calendar size={22} color="#c084fc" />
              </div>
            </div>
          </div>

          <div className="glass-card chart-container" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
            {dailyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <span className="loading-dots">Loading<span>.</span><span>.</span><span>.</span></span>
              </div>
            ) : dailyData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
                No daily sales data for this date range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dailyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => '৳' + new Intl.NumberFormat('en-BD').format(v)} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#e2e8f0',
                      fontSize: '0.875rem',
                    }}
                    labelFormatter={fmtDate}
                    formatter={(value, name) => [fmtCurrency(value), name]}
                  />
                  <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{value}</span>} />
                  <Bar dataKey="revenue" name="Revenue" fill="rgba(59,130,246,0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivery_cost" name="Delivery Cost" fill="rgba(251,191,36,0.75)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {dailyData.length > 0 && (
            <div className="table-container">
              <table className="monthly-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>Delivery Cost</th>
                    <th>Profit</th>
                    <th>Avg Order</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailyData].reverse().map((row, i) => (
                    <tr key={`${row.date}-${i}`}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(row.date)}</td>
                      <td>{row.orders || 0}</td>
                      <td>{fmtCurrency(row.revenue)}</td>
                      <td style={{ color: '#fbbf24' }}>{fmtCurrency(row.delivery_cost)}</td>
                      <td style={{ color: (row.profit || 0) >= 0 ? '#34d399' : '#f87171' }}>{fmtCurrency(row.profit)}</td>
                      <td>{fmtCurrency(row.average_order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
