import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  XCircle,
  Search,
  Upload,
  FileText,
  Sparkles,
  TrendingUp,
  ArrowRight,
  ShoppingCart
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import FormattedText from '../components/FormattedText';
import api from '../services/api';


const fmtCurrency = (num) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(num || 0));


function getStatus(product) {
  const stock  = Number(product.current_stock ?? 0);
  const reorder = Number(product.reorder_level ?? 0);
  if (stock === 0) return { label: 'Out of Stock', cls: 'badge-red' };
  if (stock <= reorder) return { label: 'Low Stock',    cls: 'badge-yellow' };
  return { label: 'In Stock',     cls: 'badge-green' };
}

function getRowClass(product) {
  const stock  = Number(product.current_stock ?? 0);
  const reorder = Number(product.reorder_level ?? 0);
  if (stock === 0) return 'row-danger';
  if (stock <= reorder) return 'row-warning';
  return '';
}


const EMPTY_FORM = {
  sku:           '',
  name:          '',
  category:      '',
  supplier:      '',
  unit_cost:     '',
  sell_price:    '',
  current_stock: '',
  reorder_level: '10',
  notes:         '',
};


export default function Products({ user, onLogout }) {
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteId,   setDeleteId]   = useState(null);


  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingRecs, setPricingRecs] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [applyingRec, setApplyingRec] = useState(null);


  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockData, setRestockData] = useState(null);
  const [loadingRestock, setLoadingRestock] = useState(false);


  const [activeTab, setActiveTab] = useState('table');


  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);


  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleInventoryChanged() {
      load();
    }

    window.addEventListener('myshop:inventory-changed', handleInventoryChanged);
    return () => {
      window.removeEventListener('myshop:inventory-changed', handleInventoryChanged);
    };
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.products.list();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  const displayed = products.filter((p) => {

    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (
        (p.name     || '').toLowerCase().includes(q) ||
        (p.sku      || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q)
      );
      if (!match) return false;
    }


    if (statusFilter !== 'All') {
      const pStatus = getStatus(p).label;
      if (pStatus !== statusFilter) return false;
    }

    return true;
  });

  const totalProducts = products.length;
  const lowStock      = products.filter(
    (p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.reorder_level)
  ).length;
  const outOfStock    = products.filter((p) => Number(p.current_stock) === 0).length;


  const sell = parseFloat(form.sell_price);
  const cost = parseFloat(form.unit_cost);
  const profitMargin =
    sell > 0 && cost >= 0 && sell > cost
      ? (((sell - cost) / sell) * 100).toFixed(1)
      : null;


  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setModalError('');
    setShowModal(true);
  }

  function openEdit(product) {
    setEditItem(product);
    setForm({
      sku:           product.sku           || '',
      name:          product.name          || '',
      category:      product.category      || '',
      supplier:      product.supplier      || '',
      unit_cost:     String(product.unit_cost     ?? ''),
      sell_price:    String(product.sell_price    ?? ''),
      current_stock: String(product.current_stock ?? ''),
      reorder_level: String(product.reorder_level ?? '10'),
      notes:         product.notes         || '',
    });
    setModalError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditItem(null);
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setModalError('Product name is required.');
      return;
    }
    const unit_cost     = parseFloat(form.unit_cost)     || 0;
    const sell_price    = parseFloat(form.sell_price)    || 0;
    const current_stock = parseInt(form.current_stock,   10) || 0;
    const reorder_level = parseInt(form.reorder_level,   10) || 10;

    setSaving(true);
    setModalError('');
    try {
      const payload = {
        sku:           form.sku      || undefined,
        name:          form.name.trim(),
        category:      form.category || undefined,
        supplier:      form.supplier || undefined,
        unit_cost,
        sell_price,
        current_stock,
        reorder_level,
        notes:         form.notes    || undefined,
      };
      if (editItem) {
        await api.products.update(editItem.id, payload);
      } else {
        await api.products.create(payload);
      }
      closeModal();
      load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.products.remove(deleteId);
      setDeleteId(null);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteId(null);
    }
  }


  async function handleBulkUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const result = await api.products.bulkUpload(uploadFile);
      setUploadResult(result);
      setUploadFile(null);
      load();
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


  async function fetchPricingAI() {
    setShowPricingModal(true);
    setLoadingPricing(true);
    setPricingRecs([]);
    try {
      const data = await api.analytics.getPricingRecommendations();
      setPricingRecs(data || []);
    } catch(err) {
      alert("Error loading AI recommendations: " + err.message);
    } finally {
      setLoadingPricing(false);
    }
  }

  async function applyPricingRec(rec) {
    setApplyingRec(rec.product_id);
    try {
      const p = products.find(x => x.id === rec.product_id);
      if (!p) return;
      await api.products.update(rec.product_id, {
         ...p,
         sell_price: rec.suggested_price
      });

      setPricingRecs(prev => prev.filter(x => x.product_id !== rec.product_id));
      load();
    } catch(err) {
      alert("Error applying price: " + err.message);
    } finally {
      setApplyingRec(null);
    }
  }


  async function fetchRestockPlan() {
    setShowRestockModal(true);
    setLoadingRestock(true);
    setRestockData(null);
    try {
      const data = await api.analytics.getRestockPlan(14);
      setRestockData(data);
    } catch (err) {
      alert('Error loading restock plan: ' + err.message);
      setShowRestockModal(false);
    } finally {
      setLoadingRestock(false);
    }
  }


  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        {}
        <div
          className="page-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1>Product Management</h1>
            <p>Manage your product catalog and stock levels.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {user?.role === 'owner' && (
              <>
                <button className="btn btn-primary" onClick={fetchRestockPlan} style={{ background: '#0891b2', borderColor: '#0891b2' }}>
                  <ShoppingCart size={16} />
                  Restock AI
                </button>
                <button className="btn btn-primary" onClick={fetchPricingAI} style={{ background: 'var(--brand-purple)', borderColor: 'var(--brand-purple)' }}>
                  <Sparkles size={16} />
                  Pricing AI
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} />
              Add Product
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}
          >
            <span className="loading-dots">
              Loading<span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        ) : (
          <>

        {}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            className={`btn ${activeTab === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('table')}
          >
            <FileText size={15} /> Products Table
          </button>
          <button
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={15} /> Bulk Upload
          </button>
        </div>

        {}
        {activeTab === 'upload' && (
          <div className="glass-card">
            <div className="section-title">
              <Upload size={18} color="#60a5fa" />
              Bulk Import Products
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Upload an Excel or CSV file to import multiple products at once. Required column: Name.
            </p>

            {uploadResult ? (
              <div className="success-card">
                <p style={{ color: '#34d399', fontWeight: 700, marginBottom: '0.5rem' }}>
                  ✓ Import Successful!
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {uploadResult.message}
                </p>
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
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                >
                  <Upload size={36} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                    {uploadFile ? uploadFile.name : 'Drag & drop your file here'}
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
                  <div className="error-message" style={{ marginTop: '0.75rem' }}>{uploadError}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || uploading}
                  >
                    {uploading ? (
                      <span className="loading-dots">
                        Uploading<span>.</span><span>.</span><span>.</span>
                      </span>
                    ) : (
                      <><Upload size={16} /> Upload &amp; Import</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {}
        {activeTab === 'table' && (
          <>
            {}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                className="glass-card kpi-card"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <div>
                  <p className="kpi-label">Total Products</p>
                  <p className="kpi-value" style={{ color: '#60a5fa' }}>
                    {totalProducts}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <Package size={22} color="#60a5fa" />
                </div>
              </div>

              <div
                className="glass-card kpi-card"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <div>
                  <p className="kpi-label">Low Stock</p>
                  <p className="kpi-value" style={{ color: '#fbbf24' }}>
                    {lowStock}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <AlertTriangle size={22} color="#fbbf24" />
                </div>
              </div>

              <div
                className="glass-card kpi-card"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <div>
                  <p className="kpi-label">Out of Stock</p>
                  <p className="kpi-value" style={{ color: '#f87171' }}>
                    {outOfStock}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <XCircle size={22} color="#f87171" />
                </div>
              </div>
            </div>

            {}
            <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
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
                  placeholder="Search by name, SKU, category or supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <div style={{ minWidth: '160px' }}>
                <select
                  className="form-input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
              {search && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSearch('')}
                >
                  <XCircle size={14} /> Clear
                </button>
              )}
            </div>

            {}
            <div className="glass-card">
              {displayed.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3.5rem 2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Package size={48} style={{ marginBottom: '1rem', opacity: 0.35 }} />
                  <p style={{ fontSize: '0.95rem' }}>
                    {search
                      ? 'No products match your search.'
                      : 'No products yet. Add your first product to get started.'}
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Supplier</th>
                        <th>Unit Cost</th>
                        <th>Sell Price</th>
                        <th>Stock</th>
                        <th>Reorder</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((product) => {
                        const status   = getStatus(product);
                        const rowClass = getRowClass(product);
                        return (
                          <tr key={product.id} className={rowClass}>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                              {product.sku || '—'}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {product.name}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {product.category || '—'}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {product.supplier || '—'}
                            </td>
                            <td>{fmtCurrency(product.unit_cost)}</td>
                            <td style={{ fontWeight: 600, color: '#34d399' }}>
                              {fmtCurrency(product.sell_price)}
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {product.current_stock ?? 0}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {product.reorder_level ?? 0}
                            </td>
                            <td>
                              <span className={`badge ${status.cls}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openEdit(product)}
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setDeleteId(product.id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
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
          </>
        )}
      </div>

      {}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal">
            <h2>{editItem ? 'Edit Product' : 'Add Product'}</h2>

            <div className="form-grid-2">
              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SKU-001"
                  value={form.sku}
                  onChange={(e) => setField('sku', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Product name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Electronics"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Supplier</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Supplier name"
                  value={form.supplier}
                  onChange={(e) => setField('supplier', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Unit Cost ৳</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={form.unit_cost}
                  onChange={(e) => setField('unit_cost', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Sell Price ৳</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={form.sell_price}
                  onChange={(e) => setField('sell_price', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Current Stock</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min="0"
                  step="1"
                  value={form.current_stock}
                  onChange={(e) => setField('current_stock', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Reorder Level</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="10"
                  min="0"
                  step="1"
                  value={form.reorder_level}
                  onChange={(e) => setField('reorder_level', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Optional notes..."
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {}
            {profitMargin !== null && (
              <div
                style={{
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Profit Margin:
                </span>
                <span style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem' }}>
                  {profitMargin}%
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                  ({fmtCurrency(sell - cost)} per unit)
                </span>
              </div>
            )}

            {modalError && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>
                {modalError}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <span className="loading-dots">
                    Saving<span>.</span><span>.</span><span>.</span>
                  </span>
                ) : editItem ? (
                  'Update Product'
                ) : (
                  'Add Product'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {deleteId && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2>Delete Product?</h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
                lineHeight: 1.7,
              }}
            >
              This product will be permanently removed from inventory. This action
              cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showPricingModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPricingModal(false)}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--brand-purple)', borderRadius: '12px' }}>
                <Sparkles size={28} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Dynamic Pricing AI</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Smart recommendations based on 30-day sales velocity and current stock levels.</p>
              </div>
            </div>

            {loadingPricing ? (
               <div style={{ padding: '4rem 0', textAlign: 'center' }}>
                 <span className="loading-dots" style={{ fontSize: '1.1rem' }}>Analyzing Market Data<span>.</span><span>.</span><span>.</span></span>
               </div>
            ) : pricingRecs.length === 0 ? (
               <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Sparkles size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
                  <p style={{ fontSize: '1.1rem' }}>Your prices are perfectly optimized right now!</p>
               </div>
            ) : (
              <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Action</th>
                      <th>Unit Cost</th>
                      <th>Current Price</th>
                      <th>Suggested Price</th>
                      <th>AI Reasoning</th>
                      <th style={{ width: '100px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRecs.map((rec) => (
                      <tr key={rec.product_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{rec.sku || 'No SKU'}</div>
                        </td>
                        <td>
                           <span className={rec.action === 'increase' ? 'badge-green' : 'badge-red'}>
                             {rec.action === 'increase' ? (
                               <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <TrendingUp size={12}/> +5% Increase
                               </span>
                             ) : (
                               <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <TrendingUp size={12} style={{ transform: 'scaleY(-1)' }}/> -15% Discount
                               </span>
                             )}
                           </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(rec.unit_cost)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(rec.current_price)}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{fmtCurrency(rec.suggested_price)}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 220, whiteSpace: 'normal', lineHeight: 1.4 }}>{rec.reason}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => applyPricingRec(rec)}
                            disabled={applyingRec === rec.product_id}
                          >
                            {applyingRec === rec.product_id ? 'Applying...' : 'Apply Price'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '2rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowPricingModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {}
      {showRestockModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRestockModal(false)}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(8, 145, 178, 0.12)', color: '#22d3ee', borderRadius: '12px' }}>
                <ShoppingCart size={28} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>AI Restock Planner</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>14-day purchase plan from your sales velocity, stock and reorder levels.</p>
              </div>
            </div>

            {loadingRestock ? (
              <div style={{ padding: '4rem 0', textAlign: 'center' }}>
                <span className="loading-dots" style={{ fontSize: '1.1rem' }}>Building Your Purchase Plan<span>.</span><span>.</span><span>.</span></span>
              </div>
            ) : !restockData || restockData.plan.length === 0 ? (
              <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Package size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
                <p style={{ fontSize: '1.1rem' }}>Add products with stock levels to generate a restock plan.</p>
              </div>
            ) : (
              <>
                {}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="glass-card" style={{ padding: '0.85rem 1.1rem' }}>
                    <p className="kpi-label">Items to Restock</p>
                    <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#22d3ee', margin: 0 }}>
                      {restockData.totals.items_to_restock ?? 0}
                    </p>
                  </div>
                  <div className="glass-card" style={{ padding: '0.85rem 1.1rem' }}>
                    <p className="kpi-label">Total Units to Buy</p>
                    <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#60a5fa', margin: 0 }}>
                      {restockData.totals.total_units ?? 0}
                    </p>
                  </div>
                  <div className="glass-card" style={{ padding: '0.85rem 1.1rem' }}>
                    <p className="kpi-label">Estimated Budget</p>
                    <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399', margin: 0 }}>
                      {fmtCurrency(restockData.totals.total_cost)}
                    </p>
                  </div>
                </div>

                {}
                {restockData.ai_summary && (
                  <div
                    style={{
                      background: 'rgba(8, 145, 178, 0.07)',
                      border: '1px solid rgba(34, 211, 238, 0.2)',
                      borderRadius: 12,
                      padding: '1rem 1.25rem',
                      marginBottom: '1.25rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#22d3ee', fontWeight: 700 }}>
                      <Sparkles size={15} /> Gemma 4 Weekly Plan
                    </div>
                    <FormattedText text={restockData.ai_summary} />
                  </div>
                )}

                {}
                <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Urgency</th>
                        <th>Stock</th>
                        <th>Sold (30d)</th>
                        <th>Days Left</th>
                        <th>Buy Qty</th>
                        <th>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restockData.plan.map((item) => {
                        const urgencyBadge = {
                          critical:    { label: 'Critical',    cls: 'badge-red' },
                          soon:        { label: 'Reorder Soon', cls: 'badge-yellow' },
                          healthy:     { label: 'Healthy',     cls: 'badge-green' },
                          overstocked: { label: 'Overstocked', cls: 'badge-yellow' },
                        }[item.urgency] || { label: item.urgency, cls: 'badge-green' };
                        return (
                          <tr key={item.product_id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {item.supplier ? `Supplier: ${item.supplier}` : item.sku || 'No SKU'}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{item.current_stock}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{item.units_sold_30d}</td>
                            <td style={{ color: item.days_of_stock_left !== null && item.days_of_stock_left <= 7 ? '#f87171' : 'var(--text-secondary)' }}>
                              {item.days_of_stock_left !== null
                                ? `${item.days_of_stock_left} days`
                                : 'No sales'}
                            </td>
                            <td style={{ fontWeight: 700, color: item.suggested_order_qty > 0 ? '#22d3ee' : 'var(--text-muted)' }}>
                              {item.suggested_order_qty > 0 ? item.suggested_order_qty : 'Skip'}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {item.suggested_order_qty > 0 ? fmtCurrency(item.estimated_cost) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-footer" style={{ marginTop: '2rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowRestockModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
