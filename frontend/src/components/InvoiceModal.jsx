import { useRef, useState } from 'react';
import { X, Download, Receipt } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const toAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[৳,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtCurrency = (value) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(toAmount(value)));

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

export default function InvoiceModal({ order, businessName, onClose }) {
  const contentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!order) return null;

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `Invoice_${order.order_id || order.id}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  const subtotal = toAmount(order.amount);
  const delivery = toAmount(order.delivery_cost);
  const quantity = Number(order.quantity) > 0 ? Number(order.quantity) : 1;
  const total = subtotal + delivery;

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.75)', 
        backdropFilter: 'blur(4px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        zIndex: 9999,
        padding: '2rem'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          background: '#0f172a',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: '850px', 
          width: '100%', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={20} color="#8b5cf6" />
            Invoice Preview
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleExportPDF}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} />
              {isExporting ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button className="btn-close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        {}
        <div style={{ background: '#e2e8f0', flex: 1, overflow: 'auto' }}>
          <div style={{ minWidth: 'max-content', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
            <div 
              ref={contentRef}
              style={{ 
                background: '#ffffff', 
                color: '#0f172a',
                padding: '40px 50px',
                borderRadius: '4px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box',
                width: '794px',
                minHeight: '1123px'
              }}
            >
            {}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '2rem' }}>{businessName || 'Business'}</h1>
                <p style={{ margin: 0, color: '#64748b' }}>Your Trusted Partner in Quality & Service</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', color: '#3b82f6', fontSize: '1.8rem', letterSpacing: '1px' }}>INVOICE</h2>
                <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>Invoice #: {order.order_id || `ORD-${order.id}`}</p>
                <p style={{ margin: 0, color: '#64748b' }}>Date: {fmtDate(order.date)}</p>
              </div>
            </div>

            {}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Bill To</h3>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', fontSize: '1.1rem' }}>{order.customer_name || 'Walk-in Customer'}</p>
              {order.customer_phone && <p style={{ margin: 0, color: '#475569' }}>{order.customer_phone}</p>}
            </div>

            {}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#475569', fontWeight: 600, width: '45%' }}>Description</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#475569', fontWeight: 600, width: '10%' }}>Qty</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569', fontWeight: 600, width: '20%' }}>Unit Price</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569', fontWeight: 600, width: '25%' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 500 }}>{order.product_name || 'General Item'}</div>
                    {order.product_id && (
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                        ID: {order.product_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{quantity}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>{fmtCurrency(subtotal / quantity)}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>{fmtCurrency(subtotal)}</td>
                </tr>
              </tbody>
            </table>

            {}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', color: '#475569' }}>
                  <span>Subtotal</span>
                  <span>{fmtCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <span>Delivery Cost</span>
                  <span>{fmtCurrency(delivery)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', fontWeight: 'bold', fontSize: '1.25rem', color: '#1e293b', marginTop: '0.5rem', borderRadius: '4px' }}>
                  <span>Total Amount</span>
                  <span>{fmtCurrency(total)}</span>
                </div>
              </div>
            </div>

            {}
            <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              <p style={{ margin: 0 }}>If you have any questions about this invoice, please contact us.</p>
              <p style={{ margin: '0.25rem 0 0 0' }}>{businessName}</p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
