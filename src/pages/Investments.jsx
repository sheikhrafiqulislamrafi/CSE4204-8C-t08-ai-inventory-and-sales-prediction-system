import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  TrendingDown,
  CalendarDays,
  Hash,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
} from 'lucide-react';
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
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};


const CATEGORIES = [
  'Inventory Purchase',
  'Marketing & Ads',
  'Staff Salary',
  'Shipping Setup',
  'Rent & Utilities',
  'Equipment',
  'Other',
];

const CATEGORY_BADGE = {
  'Inventory Purchase': 'badge-blue',
  'Marketing & Ads':   'badge-purple',
  'Staff Salary':      'badge-green',
  'Shipping Setup':    'badge-yellow',
  'Rent & Utilities':  'badge-orange',
  'Equipment':         'badge-cyan',
  'Other':             'badge-gray',
};

const PAGE_SIZE = 20;

const localDateStr = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const EMPTY_FORM = {
  date:     localDateStr(),
  category: 'Inventory Purchase',
  amount:   '',
  notes:    '',
};


export default function Investments({ user, onLogout }) {
  const [allItems,    setAllItems]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [catFilter,   setCatFilter]   = useState('');
  const [dateStart,   setDateStart]   = useState('');
  const [dateEnd,     setDateEnd]     = useState('');
  const [page,        setPage]        = useState(1);
  const [showModal,   setShowModal]   = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState('');
  const [deleteId,    setDeleteId]    = useState(null);


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

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.investments.list({ page: 1, limit: 1000 });
      setAllItems(res.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  const filtered = allItems
    .filter((item) => catFilter === '' || item.category === catFilter)
    .filter((item) => !dateStart || (item.date || '') >= dateStart)
    .filter((item) => !dateEnd   || (item.date || '') <= dateEnd)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalInvestment = allItems.reduce((s, i) => s + (i.amount || 0), 0);
  const currentMonth    = localDateStr().slice(0, 7);
  const thisMonth       = allItems
    .filter((i) => (i.date || '').slice(0, 7) === currentMonth)
    .reduce((s, i) => s + (i.amount || 0), 0);


  function openAdd() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, date: localDateStr() });
    setModalError('');
    setShowModal(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      date:     item.date     || '',
      category: item.category || 'Inventory Purchase',
      amount:   String(item.amount ?? ''),
      notes:    item.notes    || '',
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
    if (!form.date) { setModalError('Date is required.'); return; }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) {
      setModalError('Amount must be a positive number.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const payload = {
        date:     form.date,
        category: form.category,
        amount,
        notes:    form.notes || undefined,
      };
      if (editItem) {
        await api.investments.update(editItem.id, payload);
      } else {
        await api.investments.create(payload);
      }
      closeModal();
      setPage(1);
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
      await api.investments.remove(deleteId);
      setDeleteId(null);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteId(null);
    }
  }

  function clearFilters() {
    setCatFilter('');
    setDateStart('');
    setDateEnd('');
    setPage(1);
  }

  const hasFilters = catFilter || dateStart || dateEnd;


  async function handleBulkUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const result = await api.investments.bulkUpload(uploadFile);
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
            <h1>Investments &amp; Expenses</h1>
            <p>Track all business expenses and investments.</p>
          </div>
          <button className="btn btn-orange" onClick={openAdd}>
            <Plus size={16} />
            Add Expense
          </button>
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
            <FileText size={15} /> Investments Table
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
              Bulk Import Investments
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Upload an Excel or CSV file to import multiple investments at once. Required columns: Date, Category, Amount.
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
                  <p className="kpi-label">Total Investment</p>
                  <p className="kpi-value" style={{ color: '#fb923c' }}>
                    {fmtCurrency(totalInvestment)}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(249,115,22,0.15)' }}>
                  <TrendingDown size={22} color="#fb923c" />
                </div>
              </div>

              <div
                className="glass-card kpi-card"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <div>
                  <p className="kpi-label">This Month</p>
                  <p className="kpi-value" style={{ color: '#60a5fa' }}>
                    {fmtCurrency(thisMonth)}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <CalendarDays size={22} color="#60a5fa" />
                </div>
              </div>

              <div
                className="glass-card kpi-card"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <div>
                  <p className="kpi-label">Number of Entries</p>
                  <p className="kpi-value" style={{ color: '#c084fc' }}>
                    {allItems.length}
                  </p>
                </div>
                <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <Hash size={22} color="#c084fc" />
                </div>
              </div>
            </div>

            {}
            <div
              className="glass-card filter-bar"
              style={{ padding: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}
            >
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: 180 }}
                value={catFilter}
                onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={dateStart}
                onChange={(e) => { setDateStart(e.target.value); setPage(1); }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto' }}
                value={dateEnd}
                onChange={(e) => { setDateEnd(e.target.value); setPage(1); }}
              />

              {hasFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {}
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3.5rem 2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <TrendingDown
                    size={48}
                    style={{ marginBottom: '1rem', opacity: 0.35 }}
                  />
                  <p style={{ fontSize: '0.95rem' }}>
                    {hasFilters
                      ? 'No entries match your filters.'
                      : 'No investment entries yet. Add your first expense to get started.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Amount</th>
                          <th>Notes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item) => (
                          <tr key={item.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {fmtDate(item.date)}
                            </td>
                            <td>
                              <span
                                className={`badge ${CATEGORY_BADGE[item.category] || 'badge-gray'}`}
                              >
                                {item.category || 'Other'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#fb923c' }}>
                              {fmtCurrency(item.amount)}
                            </td>
                            <td
                              style={{
                                color: 'var(--text-secondary)',
                                maxWidth: 260,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.notes || '—'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openEdit(item)}
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setDeleteId(item.id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {}
                  {totalPages > 1 && (
                    <div className="pagination" style={{ padding: '1rem 1rem 0' }}>
                      <span>
                        Showing {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                        {filtered.length} entries
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ padding: '0 0.5rem', lineHeight: '2rem' }}>
                          {page} / {totalPages}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page === totalPages}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
            <h2>{editItem ? 'Edit Expense' : 'Add Expense'}</h2>

            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                className="form-input"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Amount ৳ *</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Optional description or notes..."
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

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
                  'Update'
                ) : (
                  'Save'
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
            <h2>Delete Entry?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              This expense entry will be permanently deleted. This action cannot be undone.
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
    </div>
  );
}
