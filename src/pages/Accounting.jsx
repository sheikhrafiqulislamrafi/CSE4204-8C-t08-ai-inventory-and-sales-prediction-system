import { useState, useEffect, useRef } from 'react';
import { BookOpen, Download, Calendar as CalendarIcon, TrendingUp, DollarSign } from 'lucide-react';
import FormattedText from '../components/FormattedText';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { exportToPDF } from '../utils/pdfExport';

function Accounting({ user, onLogout }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    fetchPL();
  }, [month]);

  async function fetchPL() {
    if (!month) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.analytics.plStatement(month);
      setData(res);
    } catch (err) {
      console.error(err);
      setError('Failed to load Profit & Loss statement.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `${user?.business_name || 'Business'}_PL_Statement_${month}.pdf`);
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
              <BookOpen size={28} color="#f59e0b" />
              Profit & Loss Statement
            </h1>
            <p>Generate formal income statements for accounting and investor reporting.</p>
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
                <Download size={18} />
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            Generating Accounting Report...
          </div>
        )}

        {!loading && data && (
          <div style={{ background: '#e2e8f0', borderRadius: '12px', padding: '2rem', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
            <div 
              ref={contentRef}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '50px 60px',
                borderRadius: '4px',
                width: '794px',
                minHeight: '1123px',
                boxSizing: 'border-box',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {}
              <div style={{ textAlign: 'center', borderBottom: '3px solid #1e293b', paddingBottom: '2rem', marginBottom: '2rem' }}>
                <h1 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '2.5rem', fontWeight: '800' }}>{user?.business_name || 'Business'}</h1>
                <h2 style={{ margin: '0 0 0.25rem 0', color: '#475569', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Profit & Loss Statement</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '1.1rem' }}>For the month ended {getMonthName(month)}</p>
              </div>
              
              {}
              {data.summary && (
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#334155' }}>Financial Controller's Summary</h3>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.6, fontSize: '0.95rem' }}><FormattedText text={data.summary} /></p>
                </div>
              )}

              {}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
                <tbody>
                  {}
                  <tr>
                    <td colSpan="2" style={{ padding: '1.5rem 0 0.5rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>Revenue</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem 1rem' }}>Gross Sales</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency((data.gross_revenue || 0) + (data.cancelled_returned_amount || 0))}</td>
                  </tr>
                  {(data.cancelled_returned_amount > 0) && (
                    <tr>
                      <td style={{ padding: '0.75rem 1rem' }}>Less: Returns &amp; Cancellations ({data.cancelled_returned_count || 0} orders)</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(data.cancelled_returned_amount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '1rem', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>Net Revenue</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>{formatCurrency(data.gross_revenue)}</td>
                  </tr>

                  {}
                  <tr>
                    <td colSpan="2" style={{ padding: '2rem 0 0.5rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>Cost of Goods Sold (COGS)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem 1rem' }}>Product Costs</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(data.total_cogs)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem 1rem' }}>Delivery & Logistics</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(data.delivery_costs)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '1rem', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>Total COGS</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: '#ef4444', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>- {formatCurrency(data.total_cogs + data.delivery_costs)}</td>
                  </tr>

                  {}
                  <tr style={{ background: '#f8fafc' }}>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: '800', fontSize: '1.2rem', color: '#0f172a' }}>GROSS PROFIT</td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: '800', fontSize: '1.2rem', color: data.gross_profit >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatCurrency(data.gross_profit)}
                    </td>
                  </tr>

                  {}
                  <tr>
                    <td colSpan="2" style={{ padding: '2rem 0 0.5rem', fontWeight: 'bold', color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>Operating Expenses (OPEX)</td>
                  </tr>
                  {data.operating_expenses && data.operating_expenses.length > 0 ? (
                    data.operating_expenses.map((exp, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '0.75rem 1rem' }}>{exp.category}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(exp.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontStyle: 'italic' }}>No operating expenses recorded.</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>- ৳0</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '1rem', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>Total Operating Expenses</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: '#ef4444', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #1e293b' }}>- {formatCurrency(data.total_opex)}</td>
                  </tr>

                  {}
                  <tr style={{ background: data.net_profit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <td style={{ padding: '1.5rem 1rem', fontWeight: '800', fontSize: '1.4rem', color: '#0f172a', borderTop: '4px solid #1e293b' }}>NET INCOME (PROFIT)</td>
                    <td style={{ padding: '1.5rem 1rem', textAlign: 'right', fontWeight: '800', fontSize: '1.4rem', color: data.net_profit >= 0 ? '#059669' : '#dc2626', borderTop: '4px solid #1e293b' }}>
                      {formatCurrency(data.net_profit)}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ marginTop: '4rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                <p>Generated on {new Date().toLocaleDateString()} using myShop AI</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Accounting;
