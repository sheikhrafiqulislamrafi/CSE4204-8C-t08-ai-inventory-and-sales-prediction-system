import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Link2, RefreshCw, Download, Save, CheckCircle, Info } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

function roleBadgeClass(role) {
  if (role === 'owner') return 'badge badge-blue';
  if (role === 'admin') return 'badge badge-purple';
  return 'badge badge-gray';
}

export default function Settings({ user, onLogout }) {

  const [notifEmail, setNotifEmail] = useState('');
  const [reportTime, setReportTime] = useState('20:00');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const isOwner = user?.role === 'owner';


  const [sheetId, setSheetId] = useState('');
  const [credentialsJson, setCredentialsJson] = useState('');
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [connectingSheet, setConnectingSheet] = useState(false);
  const [sheetMsg, setSheetMsg] = useState('');
  const [sheetError, setSheetError] = useState('');


  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const data = await api.settings.get();
      setNotifEmail(data.notification_email || '');
      setReportTime(data.report_time || '20:00');
      setTelegramToken(data.telegram_bot_token || '');
      setTelegramChatId(data.telegram_chat_id || '');
      setSheetId(data.google_sheet_id || '');
      setCredentialsConfigured(Boolean(data.google_credentials_configured));
      if (data.google_sheet_id) setSheetConnected(true);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    try {
      const payload = {};
      if (notifEmail !== undefined) payload.notification_email = notifEmail;
      if (reportTime !== undefined) payload.report_time = reportTime;
      if (telegramToken !== undefined) payload.telegram_bot_token = telegramToken;
      if (telegramChatId !== undefined) payload.telegram_chat_id = telegramChatId;
      if (sheetId !== undefined) payload.google_sheet_id = sheetId;
      await api.settings.update(payload);
      setSettingsSuccess('Settings saved successfully!');
      setTimeout(() => setSettingsSuccess(''), 4000);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleConnectSheet() {
    if (!sheetId.trim()) return;
    setConnectingSheet(true);
    setSheetMsg('');
    setSheetError('');
    try {
      const data = await api.sheets.connect(
        sheetId.trim(),
        credentialsJson.trim() || undefined
      );
      setSheetMsg(data.message || 'Sheet connected successfully!');
      setSheetConnected(true);
      if (credentialsJson.trim()) {
        setCredentialsConfigured(true);
        setCredentialsJson('');
      }
    } catch (err) {
      setSheetError(err.message);
    } finally {
      setConnectingSheet(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const data = await api.sheets.sync();
      setSyncMsg(data.message || `Synced ${data.synced_rows ?? ''} rows successfully!`);
    } catch (err) {
      setSyncMsg('Error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportMsg('');
    try {
      const data = await api.sheets.importFromSheets();
      setImportMsg(data.message || `Imported ${data.imported ?? ''} rows successfully!`);
    } catch (err) {
      setImportMsg('Error: ' + err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <SettingsIcon size={26} />
            Settings
          </h1>
          <p>Configure your business preferences and integrations</p>
        </div>

        {loadingSettings ? (
          <div style={{ color: 'var(--text-secondary)' }}>
            <span className="loading-dots">
              Loading settings<span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        ) : (
          <div style={{ maxWidth: 720 }}>
            {!isOwner && (
              <div className="warning-card" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(245,158,11,0.1)', borderLeft: '4px solid #fbbf24', borderRadius: '4px' }}>
                <p style={{ color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={16} /> Owner Access Required
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Only the store owner can modify settings and integrations. You are currently viewing this page in read-only mode.
                </p>
              </div>
            )}

            {}
            <div className="glass-card settings-section" style={{ marginBottom: '1.5rem' }}>
              <h2>Business Settings</h2>
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label>Notification Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={notifEmail}
                    disabled={!isOwner}
                    onChange={(e) => setNotifEmail(e.target.value)}
                  />
                </div>

                {}

                <div className="form-group">
                  <label>Daily Report Time (HH:MM)</label>
                  <input
                    type="time"
                    className="form-input"
                    value={reportTime}
                    disabled={!isOwner}
                    onChange={(e) => setReportTime(e.target.value)}
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}>The time you want to receive your daily sales report.</small>
                </div>

                {settingsError && (
                  <div className="error-message" style={{ marginBottom: '1rem' }}>{settingsError}</div>
                )}
                {settingsSuccess && (
                  <div className="success-card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={16} color="#34d399" />
                    <p style={{ color: '#34d399' }}>{settingsSuccess}</p>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={savingSettings || !isOwner}>
                  <Save size={16} />
                  {savingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </form>
            </div>

            {}
            <div className="glass-card settings-section" style={{ marginBottom: '1.5rem' }}>
              <h2>Google Sheets Integration</h2>

              <div className="info-card" style={{ marginBottom: '1.5rem' }}>
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#60a5fa',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                  }}
                >
                  <Info size={15} /> How to Connect
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
                  Connect your Google Sheet to keep your data automatically synchronized.
                  Find your Sheet ID in the URL:
                </p>
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    wordBreak: 'break-all',
                  }}
                >
                  docs.google.com/spreadsheets/d/<strong style={{ color: '#60a5fa' }}>[SHEET_ID]</strong>/edit
                </code>
              </div>

              <div className="form-group">
                <label>Google Sheet ID</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    className="form-input"
                    placeholder="Paste your Google Sheet ID here…"
                    value={sheetId}
                    onChange={(e) => { setSheetId(e.target.value); setSheetConnected(false); }}
                    style={{ flex: 1 }}
                    disabled={!isOwner}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConnectSheet}
                    disabled={!sheetId.trim() || connectingSheet || !isOwner}
                    style={{ flexShrink: 0 }}
                  >
                    <Link2 size={15} />
                    {connectingSheet ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Service Account JSON {credentialsConfigured ? '(configured)' : '(optional)'}</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Paste service-account JSON, or leave blank to use GOOGLE_SERVICE_ACCOUNT_JSON"
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  disabled={!isOwner}
                />
              </div>

              {sheetError && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>{sheetError}</div>
              )}
              {sheetMsg && (
                <div
                  className="success-card"
                  style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <CheckCircle size={16} color="#34d399" />
                  <p style={{ color: '#34d399' }}>{sheetMsg}</p>
                </div>
              )}

              {sheetConnected && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {}
                  <div>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleSync}
                      disabled={syncing}
                    >
                      <RefreshCw size={15} />
                      {syncing ? 'Syncing...' : 'Sync myShop Tabs'}
                    </button>
                    {syncMsg && (
                      <p
                        style={{
                          marginTop: '0.4rem',
                          fontSize: '0.82rem',
                          color: syncMsg.startsWith('Error') ? '#f87171' : '#34d399',
                        }}
                      >
                        {syncMsg}
                      </p>
                    )}
                  </div>

                  {}
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleImport}
                      disabled={importing || !isOwner}
                    >
                      <Download size={15} />
                      {importing ? 'Importing...' : 'Import from Sheets'}
                    </button>
                    {importMsg && (
                      <p
                        style={{
                          marginTop: '0.4rem',
                          fontSize: '0.82rem',
                          color: importMsg.startsWith('Error') ? '#f87171' : '#34d399',
                        }}
                      >
                        {importMsg}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="glass-card settings-section" style={{ marginBottom: '1.5rem' }}>
              <h2>Automated Reports</h2>
              <div className="info-card">
                <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '0.5rem' }}>
                  📧 Daily Email Reports via Google Apps Script
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
                  Your Google Apps Script is configured to send a daily email report with
                  your business summary, top customers, and profit analysis.
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Current Schedule:</strong> Daily at 8:00 AM
                </p>
              </div>
              <a
                href="https:
                href="https://developers.google.com/apps-script/"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '1rem', display: 'inline-flex' }}
              >
                <Link2 size={14} /> View Apps Script Documentation
              </a>
            </div>

            {}
            <div className="glass-card settings-section">
              <h2>Account Information</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Email', value: user?.email },
                  { label: 'Business Name', value: user?.business_name },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        minWidth: 140,
                        fontSize: '0.875rem',
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontWeight: 500 }}>{value || '—'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 140, fontSize: '0.875rem' }}>
                    Role
                  </span>
                  <span className={roleBadgeClass(user?.role)} style={{ textTransform: 'capitalize' }}>
                    {user?.role || 'user'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
