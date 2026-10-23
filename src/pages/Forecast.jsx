import { useState, useEffect } from 'react';
import {
  LineChart as LineChartIcon,
  Sparkles,
  TrendingUp,
  Package,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { exportToPDF } from '../utils/pdfExport';
import { useRef } from 'react';

function renderAiMessage(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function Forecast({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const contentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        const res = await api.analytics.forecast();
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, []);

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `Forecast_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area" ref={contentRef}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <LineChartIcon size={28} color="#10b981" />
              Demand Forecasting
            </h1>
            <p>AI-powered 14-day predictions based on your historical sales run-rate.</p>
          </div>
          {data && data.daily_forecast.length > 0 && (
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

        {loading ? (
          <div className="loading-state">
            <span className="loading-dots">Analyzing trends<span>.</span><span>.</span><span>.</span></span>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !data || data.daily_forecast.length === 0 ? (
          <div className="empty-state">
            <LineChartIcon size={48} opacity={0.5} />
            <h3>Not enough data</h3>
            <p>We need more historical sales data to generate a forecast.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {}
            {data.insights && (
              <div className="card glass-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#8b5cf6' }}>
                  <Sparkles size={20} />
                  AI Forecast Insights
                </h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {renderAiMessage(data.insights)}
                </div>
              </div>
            )}

            {}
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <TrendingUp size={20} color="#10b981" />
                14-Day Revenue Forecast
              </h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <LineChart data={data.daily_forecast} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9ca3af" 
                      tick={{ fill: '#9ca3af' }}
                      tickFormatter={(val) => val.slice(5)}
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fill: '#9ca3af' }} 
                      tickFormatter={(val) => `৳${val.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value, name) => [name === 'predicted_revenue' ? `৳${value.toLocaleString()}` : value, name === 'predicted_revenue' ? 'Expected Revenue' : 'Expected Orders']}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="predicted_revenue"
                      name="Expected Revenue"
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {}
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Package size={20} color="#f59e0b" />
                Predicted Top Products (Next 14 Days)
              </h3>
              
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th style={{ textAlign: 'right' }}>Expected Demand (Units)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products_forecast.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.product_name}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge badge-purple" style={{ fontSize: '1rem', padding: '0.25rem 0.75rem' }}>
                            {p.predicted_demand_14d}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.top_products_forecast.length === 0 && (
                      <tr>
                        <td colSpan="2" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                          Not enough recent product data to forecast demand.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
