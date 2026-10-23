import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Users,
  Percent,
  BarChart2,
  Truck,
  Activity,
  FileText,
  Upload,
  Download,
  XCircle,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { exportToPDF } from '../utils/pdfExport';


const fmtCurrency = (num) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(num || 0));

const fmtNumber = (num) => new Intl.NumberFormat('en-BD').format(num || 0);

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
};

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


const PIE_COLORS = [
  '#60a5fa',
  '#34d399',
  '#c084fc',
  '#fb923c',
  '#22d3ee',
  '#f472b6',
  '#fbbf24',
];

const COLOR_MAP = {
  blue:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  green:  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  orange: { bg: 'rgba(249,115,22,0.15)',  color: '#fb923c' },
  purple: { bg: 'rgba(139,92,246,0.15)',  color: '#c084fc' },
  cyan:   { bg: 'rgba(6,182,212,0.15)',   color: '#22d3ee' },
  pink:   { bg: 'rgba(236,72,153,0.15)',  color: '#f472b6' },
  yellow: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  red:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: '0.875rem',
  },
  labelStyle: { color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' },
  itemStyle: { color: '#e2e8f0' },
};

const KPI_CONFIG = [
  {
    key: 'total_revenue',
    label: 'Total Revenue',
    icon: DollarSign,
    color: 'blue',
    format: fmtCurrency,
  },
  {
    key: 'gross_profit',
    label: 'Gross Profit',
    icon: TrendingUp,
    color: 'green',
    format: fmtCurrency,
  },
  {
    key: 'net_cash_flow',
    label: 'Net Cash Flow',
    icon: Activity,
    color: null,
    format: fmtCurrency,
  },
  {
    key: 'total_investment',
    label: 'Total Investment',
    icon: TrendingDown,
    color: 'orange',
    format: fmtCurrency,
  },
  {
    key: 'total_orders',
    label: 'Total Orders',
    icon: ShoppingBag,
    color: 'purple',
    format: fmtNumber,
  },
  {
    key: 'gross_margin',
    label: 'Gross Margin',
    icon: Percent,
    color: 'cyan',
    format: (v) => (v || 0).toFixed(1) + '%',
  },
  {
    key: 'avg_order_value',
    label: 'Avg Order Value',
    icon: BarChart2,
    color: 'pink',
    format: fmtCurrency,
  },
  {
    key: 'total_delivery_cost',
    label: 'Delivery Cost',
    icon: Truck,
    color: 'yellow',
    format: fmtCurrency,
  },
  {
    key: 'cancelled_returned_amount',
    label: 'Cancel/Return Loss',
    icon: XCircle,
    color: 'red',
    format: fmtCurrency,
  },
];


function KpiCard({ item, value }) {
  const { label, icon: Icon, color, format } = item;
  let c;
  if (color === null) {
    c =
      (value || 0) >= 0
        ? { bg: 'rgba(16,185,129,0.15)', color: '#34d399' }
        : { bg: 'rgba(239,68,68,0.15)', color: '#f87171' };
  } else {
    c = COLOR_MAP[color];
  }
  return (
    <div
      className="glass-card kpi-card"
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
    >
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value" style={{ color: c.color }}>
          {format(value)}
        </p>
      </div>
      <div className="kpi-icon" style={{ background: c.bg }}>
        <Icon size={22} color={c.color} />
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 180,
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}
    >
      {message}
    </div>
  );
}


export default function Dashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [catData, setCatData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const contentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  
  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }


  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    loadAll();
  }, [user?.role]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const requests = [
        api.analytics.summary(),
        api.analytics.monthly(),
        api.analytics.topCustomers(5),
      ];
      if (user?.role === 'owner') requests.push(api.analytics.investmentsByCategory());

      const [sum, monthly, customers, cats = []] = await Promise.all(requests);
      setSummary(sum);
      setMonthlyData(Array.isArray(monthly) ? monthly : []);
      setCatData(Array.isArray(cats) ? cats : []);
      setTopCustomers(Array.isArray(customers) ? customers : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const result = await api.orders.bulkUpload(uploadFile);
      setUploadResult(result);
      setUploadFile(null);
      loadAll();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setUploadFile(f);
  }

  const hasData = summary && summary.total_orders > 0;


  const customerChartData = topCustomers.map((c) => ({
    name: c.name || c.customer_name || c.customer_phone || 'Unknown',
    revenue: c.spent || c.total_revenue || 0,
  }));

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar user={user} onLogout={onLogout} />
        <div
          className="main-area"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="loading-dots">
            Loading<span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area" ref={contentRef}>
        {}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Dashboard</h1>
            <p>
              Welcome back, {user?.business_name || user?.email}! Here&apos;s your business overview.
            </p>
          </div>
          {hasData && (
            <button 
              className="btn btn-secondary" 
              onClick={handleExportPDF}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} />
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {!hasData ? (
          
          <div
            className="glass-card"
            style={{ textAlign: 'center', padding: '4rem 2rem', marginBottom: '2rem' }}
          >
            <FileText
              size={56}
              color="var(--text-muted)"
              style={{ marginBottom: '1.5rem' }}
            />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>No Sales Data Yet</h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                maxWidth: 440,
                margin: '0 auto 2rem',
                lineHeight: 1.7,
              }}
            >
              Upload your first sales file below, or head to the Sales page, to get started with
              analytics and AI insights.
            </p>
          </div>
        ) : (
          <>
            {}
            <div className="kpi-grid-8">
              {KPI_CONFIG
                .filter((item) => user?.role === 'owner' || !['net_cash_flow', 'total_investment'].includes(item.key))
                .map((item) => (
                  <KpiCard key={item.key} item={item} value={summary?.[item.key] ?? 0} />
                ))}
            </div>

            {}
            <div className="chart-grid-2x2">
              {}
              <div className="glass-card chart-container">
                <div className="section-title">
                  <BarChart2 size={18} color="#60a5fa" />
                  Monthly Revenue vs Net Cash Flow
                </div>
                {monthlyData.length === 0 ? (
                  <EmptyChart message="No monthly data yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart
                      data={monthlyData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="month"
                        tickFormatter={fmtMonth}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          '৳' + new Intl.NumberFormat('en-BD').format(v)
                        }
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v, name) => [fmtCurrency(v), name]}
                        labelFormatter={fmtMonth}
                      />
                      <Legend
                        formatter={(val) => (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{val}</span>
                        )}
                      />
                      <ReferenceLine
                        y={0}
                        stroke="rgba(255,255,255,0.15)"
                        strokeDasharray="4 4"
                      />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="rgba(59,130,246,0.65)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="net_cash_flow"
                        name="Net Cash Flow"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {}
              <div className="glass-card chart-container">
                <div className="section-title">
                  <TrendingDown size={18} color="#fb923c" />
                  Investment by Category
                </div>
                {catData.length === 0 ? (
                  <EmptyChart message="No investment data yet." />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <PieChart width={180} height={180}>
                      <Pie
                        data={catData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={82}
                        dataKey="amount"
                        paddingAngle={2}
                      >
                        {catData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          color: '#e2e8f0',
                          fontSize: '0.875rem',
                        }}
                        formatter={(v) => [fmtCurrency(v), '']}
                      />
                    </PieChart>
                    <div className="pie-legend" style={{ flex: 1 }}>
                      {catData.map((item, i) => (
                        <div key={i} className="pie-legend-item">
                          <div
                            className="pie-legend-dot"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span>
                            {item.category}: {fmtCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {}
              <div className="glass-card chart-container">
                <div className="section-title">
                  <Truck size={18} color="#fbbf24" />
                  Monthly Delivery Cost
                </div>
                {monthlyData.length === 0 ? (
                  <EmptyChart message="No delivery data yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="month"
                        tickFormatter={fmtMonth}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          '৳' + new Intl.NumberFormat('en-BD').format(v)
                        }
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={72}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [fmtCurrency(v), 'Delivery Cost']}
                        labelFormatter={fmtMonth}
                      />
                      <Bar
                        dataKey="delivery_cost"
                        name="Delivery Cost"
                        fill="#fbbf24"
                        fillOpacity={0.8}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {}
              <div className="glass-card chart-container">
                <div className="section-title">
                  <Users size={18} color="#c084fc" />
                  Top Customers by Revenue
                </div>
                {customerChartData.length === 0 ? (
                  <EmptyChart message="No customer data yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={customerChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) =>
                          '৳' + new Intl.NumberFormat('en-BD').format(v)
                        }
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [fmtCurrency(v), 'Revenue']}
                      />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="#c084fc"
                        fillOpacity={0.85}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {}
            {monthlyData.length > 0 && (
              <div className="glass-card" style={{ marginBottom: '2rem' }}>
                <div className="section-title">
                  <Activity size={18} color="#60a5fa" />
                  Monthly Performance Snapshot
                </div>
                <div className="table-container">
                  <table className="monthly-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        <th>Orders</th>
                        <th>Gross Profit</th>
                        <th>Investment</th>
                        <th>Net Cash Flow</th>
                        <th>Gross Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthlyData].reverse().map((row, i) => {
                        const cashPositive = (row.net_cash_flow || 0) >= 0;
                        const margin = row.gross_margin || 0;
                        const marginColor =
                          margin >= 30
                            ? '#34d399'
                            : margin >= 15
                            ? '#fbbf24'
                            : '#f87171';
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>
                              {fmtMonth(row.month)}
                            </td>
                            <td>{fmtCurrency(row.revenue)}</td>
                            <td>{fmtNumber(row.orders)}</td>
                            <td style={{ color: '#34d399' }}>
                              {fmtCurrency(row.gross_profit)}
                            </td>
                            <td style={{ color: '#fb923c' }}>
                              {fmtCurrency(row.investment)}
                            </td>
                            <td className={cashPositive ? 'positive' : 'negative'}>
                              {fmtCurrency(row.net_cash_flow)}
                            </td>
                            <td style={{ color: marginColor }}>
                              {margin.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {}
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="section-title">
                <Activity size={18} color="#8b5cf6" />
                Shop Control Center
              </div>
              <div className="control-center">
                <div className="control-stat">
                  <div className="label">🏆 Top Customer</div>
                  <div className="value">
                    {topCustomers[0]?.name || topCustomers[0]?.customer_name || topCustomers[0]?.customer_phone || '—'}
                  </div>
                </div>
                <div className="control-stat">
                  <div className="label">📅 Last Sale Date</div>
                  <div className="value">
                    {fmtDate(summary?.last_sale_date || summary?.last_order_date)}
                  </div>
                </div>
                <div className="control-stat">
                  <div className="label">💸 Total Delivery Cost</div>
                  <div className="value" style={{ color: '#fbbf24' }}>
                    {fmtCurrency(summary?.total_delivery_cost)}
                  </div>
                </div>
                <div className="control-stat">
                  <div className="label">📊 Investment Entries</div>
                  <div className="value">
                    {fmtNumber(
                      summary?.investment_count ??
                        summary?.investment_entries ??
                        catData.length
                    )}
                  </div>
                </div>
                <div className="control-stat">
                  <div className="label">💰 Net Cash Flow</div>
                  <div
                    className={`value ${
                      (summary?.net_cash_flow || 0) >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {fmtCurrency(summary?.net_cash_flow)}
                  </div>
                </div>
                <div className="control-stat">
                  <div className="label">Highest Order Value</div>
                  <div className="value" style={{ color: '#f472b6' }}>
                    {fmtCurrency(summary?.highest_order_value)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {}
        <div className="glass-card">
          <div className="section-title">
            <Upload size={18} color="#60a5fa" />
            Quick Upload
          </div>

          {uploadResult ? (
            <div className="success-card">
              <p style={{ color: '#34d399', fontWeight: 700, marginBottom: '0.5rem' }}>
                ✓ Import Successful!
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Imported{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {uploadResult.imported}
                </strong>{' '}
                orders &nbsp;·&nbsp; Revenue:{' '}
                <strong style={{ color: '#60a5fa' }}>
                  {fmtCurrency(uploadResult.total_revenue)}
                </strong>
                &nbsp;·&nbsp; Profit:{' '}
                <strong style={{ color: '#34d399' }}>
                  {fmtCurrency(uploadResult.total_profit)}
                </strong>
              </p>
              {uploadResult.ai_insights && (
                <div
                  style={{
                    marginTop: '1rem',
                    borderTop: '1px solid rgba(16,185,129,0.2)',
                    paddingTop: '1rem',
                  }}
                >
                  <p
                    style={{
                      color: '#10b981',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    AI Insights:
                  </p>
                  <p
                    style={{
                      color: '#e2e8f0',
                      lineHeight: 1.9,
                      whiteSpace: 'pre-line',
                      fontSize: '0.9rem',
                    }}
                  >
                    {uploadResult.ai_insights}
                  </p>
                </div>
              )}
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '1rem' }}
                onClick={() => setUploadResult(null)}
              >
                Upload Another File
              </button>
            </div>
          ) : (
            <>
              <div
                className={`upload-area${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <Upload
                  size={36}
                  color="var(--text-muted)"
                  style={{ marginBottom: '1rem' }}
                />
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '0.4rem',
                    fontWeight: 500,
                  }}
                >
                  {uploadFile ? uploadFile.name : 'Drag & drop your sales file here'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Supports .xlsx, .xls, .csv &nbsp;·&nbsp; Click to browse
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                />
              </div>

              {uploadError && (
                <div className="error-message" style={{ marginTop: '0.75rem' }}>
                  {uploadError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                >
                  {uploading ? (
                    <span className="loading-dots">
                      Uploading<span>.</span><span>.</span><span>.</span>
                    </span>
                  ) : (
                    <>
                      <Upload size={16} /> Upload &amp; Analyze
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
