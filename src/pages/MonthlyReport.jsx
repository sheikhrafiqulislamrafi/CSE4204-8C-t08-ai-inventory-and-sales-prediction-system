import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Sidebar from '../components/Sidebar';
import FormattedText from '../components/FormattedText';
import api from '../services/api';
import { exportToPDF } from '../utils/pdfExport';

export default function MonthlyReport({ user, onLogout }) {

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const contentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [month]);

  async function fetchReport() {
    try {
      setLoading(true);
      setError('');
      const res = await api.analytics.monthlyReport(month);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `${user?.business_name || 'Business'}_Report_${month}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  const formatCurrency = (val) => `৳${new Intl.NumberFormat('en-BD').format(Math.round(val || 0))}`;
  

  const getMonthName = (mStr) => {
    const [y, m] = mStr.split('-');
    const date = new Date(y, parseInt(m) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileText size={28} color="#8b5cf6" />
              Monthly Business Report
            </h1>
            <p>Generate and export formal performance reports for your partners and investors.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <CalendarIcon size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
              <input
                type="month"
                className="form-input"
                style={{ paddingLeft: '2.5rem', width: '200px' }}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            {data && (
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
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="loading-dots">Generating Report<span>.</span><span>.</span><span>.</span></span>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
          </div>
        ) : !data ? null : (
          <div ref={contentRef} style={{ background: '#111827', padding: '1rem', borderRadius: '12px' }}>
            {}
            <div style={{ textAlign: 'center', paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: '#fff' }}>
                {user?.business_name || 'Business'}
              </h2>
              <h3 style={{ fontSize: '1.25rem', color: '#9ca3af', margin: 0, fontWeight: 'normal' }}>
                Performance Report: {getMonthName(month)}
              </h3>
            </div>

            {}
            <div style={{ background: 'linear-gradient(to right, #0f172a, #1e293b)', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Executive Summary</h3>
              <div style={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                <FormattedText text={data.executive_summary} />
              </div>
            </div>

            {}
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Financial Highlights</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                <div className="card glass-card">
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Revenue</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    {formatCurrency(data.total_revenue)}
                  </div>
                </div>
                <div className="card glass-card">
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Expenses</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f43f5e' }}>
                    {formatCurrency(data.total_investment)}
                  </div>
                </div>
                <div className="card glass-card">
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Net Profit</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.net_profit >= 0 ? '#10b981' : '#f43f5e' }}>
                    {formatCurrency(data.net_profit)}
                  </div>
                </div>
                <div className="card glass-card">
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Orders</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                    {data.total_orders}
                  </div>
                </div>
              </div>
            </div>

            {}
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Daily Revenue Trend</h3>
              <div className="card glass-card" style={{ height: 350 }}>
                {data.daily_revenue.length > 0 ? (
                  <ResponsiveContainer>
                    <LineChart data={data.daily_revenue} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9ca3af" 
                        tick={{ fill: '#9ca3af' }}
                        tickFormatter={(val) => val.slice(8, 10)}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        tick={{ fill: '#9ca3af' }} 
                        tickFormatter={(val) => `৳${(val/1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [`৳${value.toLocaleString()}`, 'Revenue']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                    No sales recorded for this month.
                  </div>
                )}
              </div>
            </div>

            {}
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Top Performing Products</h3>
              <div className="card glass-card">
                {data.top_products.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th style={{ textAlign: 'right' }}>Units Sold</th>
                        <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_products.map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.name}</td>
                          <td style={{ textAlign: 'right' }}>{p.qty}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0' }}>
                    No product data for this month.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
