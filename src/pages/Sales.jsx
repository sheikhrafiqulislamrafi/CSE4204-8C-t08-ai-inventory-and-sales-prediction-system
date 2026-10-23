import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import InvoiceModal from '../components/InvoiceModal';


const toAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[৳,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtCurrency = (value) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(toAmount(value)));

const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const STATUS_BADGE = {
  delivered: 'badge-green',
  shipped: 'badge-blue',
  processing: 'badge-purple',
  pending: 'badge-yellow',
  returned: 'badge-red',
  cancelled: 'badge-gray',
};

const EMPTY_FORM = {
  date: todayStr(),
  customer_name: '',
  customer_phone: '',
  order_id: '',
  consignment_id: '',
  product_name: '',
  product_id: '',
  quantity: 1,
  amount: '',
  delivery_cost: '',
  product_cost: '',
  status: 'pending',
  notes: '',
};

function notifyInventoryChanged() {
  window.dispatchEvent(new Event('myshop:inventory-changed'));
}


export default function Sales({ user, onLogout }) {

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState('');


  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');


  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);


  const [activeTab, setActiveTab] = useState('table');


  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);

  const isStaff = user?.role === 'staff';

  useEffect(() => {
    loadOrders();
  }, [page, search, statusFilter, startDate, endDate]);

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, []);

  async function loadOrders() {
    setTableLoading(true);
    setTableError('');
    try {
      const data = await api.orders.list({
        search,
        status: statusFilter,
        start_date: startDate,
        end_date: endDate,
        page,
        limit: 50,
      });
      setOrders(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setTableError(err.message);
    } finally {
      setTableLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const data = await api.customers.list();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    }
  }

  async function loadProducts() {
    try {
      const data = await api.products.list();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    }
  }


  function openAdd() {
    setEditOrder(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(order) {
    setEditOrder(order);
    setForm({
      date: order.date?.split('T')[0] || todayStr(),
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      order_id: order.order_id || '',
      consignment_id: order.consignment_id || '',
      product_name: order.product_name || '',
      product_id: order.product_id || '',
      quantity: order.quantity || 1,
      amount: order.amount ?? '',
      delivery_cost: order.delivery_cost ?? '',
      product_cost: order.product_cost ?? '',
      status: order.status || 'pending',
      notes: order.notes || '',
    });
    setFormError('');
    setShowModal(true);
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCustomerPhoneChange(value) {
    setForm((prev) => {
      const match = customers.find((customer) => customer.phone === value);
      return {
        ...prev,
        customer_phone: value,
        customer_name: match?.name || prev.customer_name,
      };
    });
  }

  function handleProductIdChange(value) {
    setForm((prev) => {
      const match = products.find(p => p.sku && p.sku.toLowerCase() === value.toLowerCase());

      if (match) {
        return {
          ...prev,
          product_id: value,
          product_name: match.name,
          amount: toAmount(match.sell_price) * (Number(prev.quantity) || 1),
          product_cost: toAmount(match.unit_cost) * (Number(prev.quantity) || 1),
        };
      }
      return { ...prev, product_id: value };
    });
  }

  function handleProductChange(value) {
    setForm((prev) => {
      const match = products.find(p => {
        const displayValue = p.sku ? `${p.sku} - ${p.name}` : p.name;
        return displayValue === value || p.name === value;
      });
      
      if (match) {
        return {
          ...prev,
          product_name: match.name,
          product_id: match.sku || '',
          amount: toAmount(match.sell_price) * (Number(prev.quantity) || 1),
          product_cost: toAmount(match.unit_cost) * (Number(prev.quantity) || 1),
        };
      }
      return { ...prev, product_name: value };
    });
  }

  function handleQuantityChange(qty) {
    setForm((prev) => {
      const match = products.find(p => {
        if (prev.product_id && p.sku && p.sku.toLowerCase() === prev.product_id.toLowerCase()) return true;
        const displayValue = p.sku ? `${p.sku} - ${p.name}` : p.name;
        return displayValue === prev.product_name || p.name === prev.product_name;
      });

      if (match) {
        return {
          ...prev,
          quantity: qty,
          amount: toAmount(match.sell_price) * qty,
          product_cost: toAmount(match.unit_cost) * qty,
        };
      }
      return { ...prev, quantity: qty };
    });
  }

  function handleDeliveryCostChange(dc) {
    setForm((prev) => {
      return { ...prev, delivery_cost: dc };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        delivery_cost:
          form.delivery_cost !== '' ? parseFloat(form.delivery_cost) : undefined,
        product_cost:
          form.product_cost !== '' ? parseFloat(form.product_cost) : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') payload[k] = undefined;
      });

      if (editOrder) {
        await api.orders.update(editOrder.id, payload);
      } else {
        await api.orders.create(payload);
      }
      setShowModal(false);
      loadOrders();
      loadCustomers();
      notifyInventoryChanged();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(id) {
    setDeleting(true);
    try {
      await api.orders.remove(id);
      setDeleteId(null);
      loadOrders();
      notifyInventoryChanged();
    } catch (err) {
      setTableError(err.message);
    } finally {
      setDeleting(false);
    }
  }


  async function handleBulkUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const result = await api.orders.bulkUpload(uploadFile);
      setUploadResult(result);
      setUploadFile(null);
      loadOrders();
      loadCustomers();
      notifyInventoryChanged();
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


  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  const hasFilters = search || statusFilter || startDate || endDate;
  const rangeStart = total === 0 ? 0 : (page - 1) * 50 + 1;
  const rangeEnd = Math.min(page * 50, total);

  const selectedProduct = products.find(p => form.product_id && p.sku && p.sku.toLowerCase() === form.product_id.toLowerCase()) 
    || products.find(p => {
      if (!form.product_name) return false;
      const displayValue = p.sku ? `${p.sku} - ${p.name}` : p.name;
      return displayValue.toLowerCase() === form.product_name.toLowerCase() || p.name.toLowerCase() === form.product_name.toLowerCase();
    });


  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        {}
        <div
          className="page-header"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <div>
            <h1>Sales Management</h1>
            <p>Manage orders, track performance, and bulk import data</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Order
          </button>
        </div>

        {}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            className={`btn ${activeTab === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('table')}
          >
            <FileText size={15} /> Orders Table
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
              Bulk Import Orders
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Upload an Excel or CSV file to import multiple orders at once. The AI will also analyze
              your imported data.
            </p>

            {uploadResult ? (
              <div className="success-card">
                <p style={{ color: '#34d399', fontWeight: 700, marginBottom: '0.5rem' }}>
                  ✓ Import Successful!
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Imported <strong style={{ color: 'var(--text-primary)' }}>{uploadResult.imported}</strong> orders
                  &nbsp;·&nbsp; Revenue:{' '}
                  <strong style={{ color: '#60a5fa' }}>{fmtCurrency(uploadResult.total_revenue)}</strong>
                  &nbsp;·&nbsp; Profit:{' '}
                  <strong style={{ color: '#34d399' }}>{fmtCurrency(uploadResult.total_profit)}</strong>
                </p>
                {uploadResult.ai_insights && (
                  <div
                    style={{
                      marginTop: '1rem',
                      borderTop: '1px solid rgba(16,185,129,0.2)',
                      paddingTop: '1rem',
                    }}
                  >
                    <p style={{ color: '#10b981', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      AI Insights:
                    </p>
                    <p style={{ color: '#e2e8f0', lineHeight: 1.9, whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
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
            <div className="filter-bar">
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Search customer, phone, order ID…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              <select
                className="form-input"
                style={{ width: 'auto', minWidth: 140 }}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              />
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              />

              {hasFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {tableError && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>{tableError}</div>
            )}
            {isStaff && (
              <div className="warning-card" style={{ marginBottom: '1rem' }}>
                <strong>Staff View:</strong> Contact an admin or owner to delete orders.
              </div>
            )}

            {}
            <div className="glass-card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Product ID</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Amount</th>
                      <th>Delivery</th>
                      <th>Profit</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      <tr>
                        <td
                          colSpan={10}
                          style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}
                        >
                          <span className="loading-dots">
                            Loading<span>.</span><span>.</span><span>.</span>
                          </span>
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}
                        >
                          No orders found
                          {hasFilters && (
                            <span>
                              {' '}—{' '}
                              <button
                                onClick={clearFilters}
                                style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                              >
                                clear filters
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(order.date)}</td>
                          <td
                            style={{
                              color: 'var(--text-secondary)',
                              fontFamily: 'monospace',
                              fontSize: '0.78rem',
                              maxWidth: 120,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {order.order_id || '—'}
                          </td>
                          <td>
                            <p style={{ fontWeight: 500, marginBottom: '0.1rem' }}>
                              {order.customer_name || '—'}
                            </p>
                            {order.customer_phone && (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                {order.customer_phone}
                              </p>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {order.product_id || '—'}
                          </td>
                          <td
                            style={{
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {order.product_name || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>{order.quantity ?? 1}</td>
                          <td style={{ fontWeight: 600, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                            {fmtCurrency(toAmount(order.amount) + toAmount(order.delivery_cost))}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {fmtCurrency(order.delivery_cost)}
                          </td>
                          <td style={{ fontWeight: 600, color: '#34d399', whiteSpace: 'nowrap' }}>
                            {fmtCurrency(order.profit)}
                          </td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
                              {order.status || 'unknown'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedInvoiceOrder(order)}
                                title="View Receipt"
                              >
                                <FileText size={14} />
                              </button>
                              
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEdit(order)}
                                title="Edit order"
                              >
                                <Pencil size={14} />
                              </button>

                              {!isStaff && (
                                deleteId === order.id ? (
                                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleDelete(order.id)}
                                      disabled={deleting}
                                    >
                                      {deleting ? '…' : 'Yes, delete'}
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => setDeleteId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => setDeleteId(order.id)}
                                    title="Delete order"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {}
              <div className="pagination" style={{ padding: '1rem 1.5rem' }}>
                <span>
                  Showing {rangeStart}–{rangeEnd} of {total} orders
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'rgba(59,130,246,0.1)',
                      borderRadius: 8,
                      color: '#60a5fa',
                      fontSize: '0.85rem',
                      minWidth: 32,
                      textAlign: 'center',
                    }}
                  >
                    {page}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <h2>{editOrder ? 'Edit Order' : 'Add New Order'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={(e) => setField('date', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-input"
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="returned">Returned</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Customer Name</label>
                  <input
                    className="form-input"
                    placeholder="Customer name"
                    value={form.customer_name}
                    onChange={(e) => setField('customer_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Customer Phone</label>
                  <input
                    className="form-input"
                    list="customer-phone-options"
                    placeholder="01XXXXXXXXX"
                    value={form.customer_phone}
                    onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                  />
                  <datalist id="customer-phone-options">
                    {customers.map((customer) => (
                      <option
                        key={customer.phone || customer.name}
                        value={customer.phone || ''}
                        label={customer.name || customer.phone}
                      />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Order ID (optional)</label>
                  <input
                    className="form-input"
                    placeholder="Leave blank to auto-generate"
                    value={form.order_id}
                    onChange={(e) => setField('order_id', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                    <div>
                      <label>Product ID (SKU)</label>
                      <input
                        className="form-input"
                        placeholder="Product ID (e.g. SKU-123)"
                        value={form.product_id}
                        onChange={(e) => handleProductIdChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Product Name</label>
                      <input
                        className="form-input"
                        list="product-options"
                        placeholder="Product name"
                        value={form.product_name}
                        onChange={(e) => handleProductChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <datalist id="product-options">
                    {products.map((p) => {
                      const displayValue = p.sku ? `${p.sku} - ${p.name}` : p.name;
                      const supplierText = p.supplier ? `Supplier: ${p.supplier}` : 'No Supplier';
                      const stockText = `Stock: ${p.current_stock}`;
                      return (
                        <option 
                          key={p.id} 
                          value={displayValue} 
                          label={`${supplierText} | ${stockText}`} 
                        />
                      );
                    })}
                  </datalist>
                  {selectedProduct && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Price:</strong> 
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>{fmtCurrency(selectedProduct.sell_price)}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Cost:</strong> 
                        <span style={{ fontWeight: 500 }}>{fmtCurrency(selectedProduct.unit_cost)}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> 
                        <span style={{ fontWeight: 600, color: selectedProduct.current_stock > 0 ? '#34d399' : '#f87171' }}>
                          {selectedProduct.current_stock > 0 ? `In Stock (${selectedProduct.current_stock})` : 'Out of Stock'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="1"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => handleQuantityChange(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="form-group">
                  <label>Amount (৳) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setField('amount', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Delivery Cost (৳)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    step="0.01"
                    min="0"
                    value={form.delivery_cost}
                    onChange={(e) => handleDeliveryCostChange(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Optional notes…"
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {formError && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>{formError}</div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <span className="loading-dots">
                      Saving<span>.</span><span>.</span><span>.</span>
                    </span>
                  ) : (
                    editOrder ? 'Save Changes' : 'Add Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          businessName={user?.business_name}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
