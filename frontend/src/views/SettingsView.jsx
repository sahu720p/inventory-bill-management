import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Percent,
  Lock,
  Database,
  Save,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Instagram,
  Phone,
  Trash2,
  Server,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { db } from '../db/db';
import { settingsApi, migrationApi } from '../services/api';
import { migrateDexieToMongoDB } from '../services/migrationService';
import { changeAdminPassword } from '../services/authService';
import { seedDemoData, clearAllStoreData } from '../db/seedData';
import { resetInvoiceSequence, repairAllInvoices, getNextInvoiceNumber } from '../services/invoiceService';
import ConfirmModal from '../components/common/ConfirmModal';

export default function SettingsView({
  onShowToast
}) {
  const [shopSettings, setShopSettings] = useState({
    shop_name: 'OM SAHU VASTRALAYA',
    shop_subtitle: 'Clothing • Fashion • Quality',
    shop_address: 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
    shop_phone: '+91 8368429410',
    shop_instagram: 'omsahuvastralaya009',
    default_gst_percent: 5,
    default_profit_percent: 20
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [mongoStatus, setMongoStatus] = useState({
    connected: false,
    checking: true,
    stats: null,
    message: ''
  });

  const [isMigrating, setIsMigrating] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Invoice Sequence & Repair States
  const [invoiceSeqInput, setInvoiceSeqInput] = useState('0');
  const [nextInvoicePreview, setNextInvoicePreview] = useState('');
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    loadSettings();
    checkMongoHealth();
  }, []);

  const checkMongoHealth = async () => {
    try {
      setMongoStatus(prev => ({ ...prev, checking: true }));
      const res = await migrationApi.getHealth();
      if (res.connected) {
        setMongoStatus({
          connected: true,
          checking: false,
          stats: res.stats,
          message: 'Connected & Active'
        });
      } else {
        setMongoStatus({
          connected: false,
          checking: false,
          stats: null,
          message: res.message || 'Disconnected'
        });
      }
    } catch (err) {
      setMongoStatus({
        connected: false,
        checking: false,
        stats: null,
        message: 'Server unreachable or MongoDB offline'
      });
    }
  };

  const loadSettings = async () => {
    try {
      // 1. Try MongoDB API
      let loaded = false;
      try {
        const res = await settingsApi.getAll();
        if (res.success && res.map) {
          setShopSettings(prev => ({
            ...prev,
            ...res.map
          }));
          loaded = true;
        }
      } catch (apiErr) {
        console.warn('API error fetching settings, using local:', apiErr.message);
      }

      // 2. Fallback to local Dexie
      if (!loaded) {
        const allSettings = await db.settings.toArray();
        const settingsMap = {};
        allSettings.forEach(s => { settingsMap[s.key] = s.value; });

        setShopSettings(prev => ({
          ...prev,
          ...settingsMap
        }));
      }

      // Load invoice sequence info
      try {
        const nextInfo = await getNextInvoiceNumber();
        setNextInvoicePreview(nextInfo.formattedNumber);
        const counterRec = await db.counters.get('invoice_sequence');
        if (counterRec) setInvoiceSeqInput(String(counterRec.value || 0));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Save / Reset Invoice Sequence Counter
  const handleSaveSequence = async (e) => {
    if (e) e.preventDefault();
    try {
      const val = Math.max(0, parseInt(invoiceSeqInput, 10) || 0);
      const res = await resetInvoiceSequence(val);
      setNextInvoicePreview(res.formattedNumber);
      if (onShowToast) {
        onShowToast(`Invoice sequence counter updated! Next bill: ${res.formattedNumber}`, 'success');
      }
    } catch (err) {
      alert('Error updating counter: ' + err.message);
    }
  };

  // Run Auto-Repair for All Invoices
  const handleAutoRepairInvoices = async () => {
    setIsRepairing(true);
    try {
      const result = await repairAllInvoices();
      if (onShowToast) {
        onShowToast(`All invoices verified & healed! Local: ${result.localRepaired}, MongoDB: ${result.backendRepaired}`, 'success');
      }
      await loadSettings();
    } catch (err) {
      alert('Repair failed: ' + err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  // Save Shop & Pricing Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      try {
        await settingsApi.updateBulk(shopSettings);
      } catch (apiErr) {
        console.warn('Backend settings save error, saving locally:', apiErr.message);
      }

      for (const [key, value] of Object.entries(shopSettings)) {
        await db.settings.put({ key, value });
      }

      if (onShowToast) onShowToast('Shop settings saved to MongoDB successfully!', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle 1-Click Migration from Local Browser Dexie to MongoDB
  const handleMigrateToMongoDB = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateDexieToMongoDB();
      if (result.success) {
        if (onShowToast) {
          onShowToast('Successfully transferred all local data to MongoDB!', 'success');
        }
        await checkMongoHealth();
      } else {
        alert('Migration error: ' + result.error);
      }
    } catch (err) {
      alert('Migration error: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert('Password should be at least 6 characters long.');
      return;
    }

    try {
      await changeAdminPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      if (onShowToast) onShowToast('Admin password changed successfully!', 'success');
    } catch (err) {
      alert(err.message || 'Password update failed');
    }
  };

  // Export Full JSON Backup
  const handleExportBackup = async () => {
    try {
      let backupData;
      try {
        const mongoBackup = await migrationApi.exportData();
        if (mongoBackup.success) {
          backupData = mongoBackup;
        }
      } catch (e) {}

      if (!backupData) {
        backupData = {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          database: 'IndexedDB',
          products: await db.products.toArray(),
          purchaseBills: await db.purchaseBills.toArray(),
          purchaseItems: await db.purchaseItems.toArray(),
          invoices: await db.invoices.toArray(),
          invoiceItems: await db.invoiceItems.toArray(),
          settings: await db.settings.toArray(),
          counters: await db.counters.toArray()
        };
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OmSahuVastralaya_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      if (onShowToast) onShowToast('Database backup downloaded successfully.', 'success');
    } catch (err) {
      console.error('Backup failed:', err);
    }
  };

  // Restore JSON Backup
  const handleRestoreBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const data = imported.data || imported;

        // Try importing to MongoDB
        try {
          await migrationApi.importData(data);
        } catch (apiErr) {
          console.warn('API import error, restoring locally:', apiErr.message);
        }

        // Also restore locally
        await db.transaction('rw', db.products, db.purchaseBills, db.purchaseItems, db.invoices, db.invoiceItems, db.settings, db.counters, async () => {
          if (data.products) {
            await db.products.clear();
            await db.products.bulkAdd(data.products);
          }
          if (data.purchaseBills) {
            await db.purchaseBills.clear();
            await db.purchaseBills.bulkAdd(data.purchaseBills);
          }
          if (data.purchaseItems) {
            await db.purchaseItems.clear();
            await db.purchaseItems.bulkAdd(data.purchaseItems);
          }
          if (data.invoices) {
            await db.invoices.clear();
            await db.invoices.bulkAdd(data.invoices);
          }
          if (data.invoiceItems) {
            await db.invoiceItems.clear();
            await db.invoiceItems.bulkAdd(data.invoiceItems);
          }
          if (data.counters) {
            await db.counters.bulkPut(data.counters);
          }
        });

        if (onShowToast) onShowToast('Database successfully restored from backup file!', 'success');
        loadSettings();
        checkMongoHealth();
      } catch (err) {
        console.error('Restore failed:', err);
        alert('Failed to restore backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset to Demo Data
  const handleResetDemoData = async () => {
    try {
      await seedDemoData();
      await handleMigrateToMongoDB();
      if (onShowToast) onShowToast('Database reset to clean sample catalog.', 'success');
      loadSettings();
      checkMongoHealth();
    } catch (err) {
      console.error('Demo reset failed:', err);
    } finally {
      setIsResetConfirmOpen(false);
    }
  };

  // Clear All Store Data
  const handleClearAllStoreData = async () => {
    try {
      await clearAllStoreData();
      try {
        await migrationApi.clearAllData();
      } catch (e) {}
      if (onShowToast) onShowToast('All store records cleared. Database starts fresh from invoice 1!', 'success');
      loadSettings();
      checkMongoHealth();
    } catch (err) {
      console.error('Clear all data failed:', err);
    } finally {
      setIsClearAllConfirmOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Settings & Configuration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Configure shop details, pricing formulas, MongoDB database status, and security settings.
        </p>
      </div>

      {/* MongoDB Status Banner */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          background: mongoStatus.connected
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)',
          border: mongoStatus.connected
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: mongoStatus.connected ? '#10B981' : '#F59E0B',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Server size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                MongoDB Database
              </span>
              <span
                className={`badge ${mongoStatus.connected ? 'badge-emerald' : 'badge-gold'}`}
                style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}
              >
                {mongoStatus.checking ? 'Checking...' : mongoStatus.connected ? 'Connected' : 'Offline / Local'}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {mongoStatus.connected ? (
                <span>Cloud Database connected & synchronized with your store</span>
              ) : (
                <span>{mongoStatus.message || 'Offline'} (Using local offline storage with automatic synchronization)</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={checkMongoHealth}
            className="btn btn-secondary btn-sm"
            title="Refresh connection status"
          >
            <RefreshCw size={14} />
            <span>Check Status</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Store Details & Formula */}
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={20} style={{ color: 'var(--gold-500)' }} />
            <span>Shop Details & Header</span>
          </h2>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Shop Name (Displayed on Invoices)</label>
              <input
                type="text"
                required
                value={shopSettings.shop_name}
                onChange={(e) => setShopSettings({ ...shopSettings, shop_name: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subtitle / Tagline</label>
              <input
                type="text"
                value={shopSettings.shop_subtitle}
                onChange={(e) => setShopSettings({ ...shopSettings, shop_subtitle: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                rows="2"
                value={shopSettings.shop_address}
                onChange={(e) => setShopSettings({ ...shopSettings, shop_address: e.target.value })}
                className="form-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Phone size={14} style={{ color: 'var(--gold-500)' }} />
                  <span>Phone Number</span>
                </label>
                <input
                  type="text"
                  value={shopSettings.shop_phone}
                  onChange={(e) => setShopSettings({ ...shopSettings, shop_phone: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Instagram size={14} style={{ color: '#E1306C' }} />
                  <span>Instagram Page</span>
                </label>
                <input
                  type="text"
                  value={shopSettings.shop_instagram}
                  onChange={(e) => setShopSettings({ ...shopSettings, shop_instagram: e.target.value })}
                  placeholder="e.g. omsahuvastralaya009"
                  className="form-input"
                />
              </div>
            </div>

            {/* Pricing Defaults */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Percent size={16} style={{ color: 'var(--gold-500)' }} />
                <span>Default Pricing Formula Rules</span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Default GST (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={shopSettings.default_gst_percent}
                    onChange={(e) => setShopSettings({ ...shopSettings, default_gst_percent: parseFloat(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Profit Markup (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={shopSettings.default_profit_percent}
                    onChange={(e) => setShopSettings({ ...shopSettings, default_profit_percent: parseFloat(e.target.value) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving...' : 'Save Store Details'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Security & Database Management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Invoice Numbering & Sequence Management Card */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={20} style={{ color: 'var(--gold-500)' }} />
              <span>Invoice Sequence & Numbering Controls</span>
            </h2>

            <form onSubmit={handleSaveSequence} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#FAF8F5', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #EBE5DC' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Next Sequential Invoice
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gold-600)', marginTop: '0.2rem' }}>
                  {nextInvoicePreview || 'Loading...'}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>
                  Current Counter Value (Set 0 to start fresh from 1)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    required
                    value={invoiceSeqInput}
                    onChange={(e) => setInvoiceSeqInput(e.target.value)}
                    className="form-input"
                    style={{ fontWeight: 800, fontSize: '1.05rem', textAlign: 'center' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Save size={14} />
                    <span>Set Counter</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceSeqInput('0');
                    resetInvoiceSequence(0).then(res => setNextInvoicePreview(res.formattedNumber));
                    if (onShowToast) onShowToast('Invoice sequence counter reset to 0 (Next: 0001)', 'success');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <RefreshCw size={13} />
                  <span>Reset Counter to 0</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoRepairInvoices}
                  disabled={isRepairing}
                  className="btn btn-dark btn-sm"
                  title="Auto-repair all past invoices with 0 amounts"
                >
                  <Sparkles size={13} style={{ color: 'var(--gold-400)' }} />
                  <span>{isRepairing ? 'Repairing...' : 'Auto-Fix 0 Amount Bills'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Admin Password Change */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} style={{ color: 'var(--gold-500)' }} />
              <span>Change Admin Password</span>
            </h2>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Min 6 characters"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ marginTop: '0.25rem' }}
              >
                Update Password
              </button>
            </form>
          </div>

          {/* Database Backup & Tools */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} style={{ color: 'var(--gold-500)' }} />
              <span>Database Backup & Recovery</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Export your entire MongoDB inventory catalog, invoices, and purchase records to a secure JSON file.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleExportBackup}
                  className="btn btn-dark"
                >
                  <Download size={16} />
                  <span>Download Full Backup</span>
                </button>

                <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                  <Upload size={16} />
                  <span>Restore from Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Clear All Store Records */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--rose-600)', marginBottom: '0.35rem' }}>
                  Clear All Store Data (Fresh Start)
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Deletes all purchase bills, inventory items, sales invoices, and resets invoice counter. Shop settings and admin password remain safe.
                </p>
                <button
                  type="button"
                  onClick={() => setIsClearAllConfirmOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--rose-600)', borderColor: 'var(--rose-200)', background: 'rgba(239, 68, 68, 0.05)' }}
                >
                  <Trash2 size={14} />
                  <span>Clear All Store Data</span>
                </button>
              </div>

              {/* Reset to Sample Demo Data */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Reset to Sample Demo Data
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Restores default products from the sample bill with initial stock and invoices into MongoDB.
                </p>
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--amber-500)', borderColor: 'var(--amber-100)' }}
                >
                  <RefreshCw size={14} />
                  <span>Reset Demo Database</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Clear All Data */}
      <ConfirmModal
        isOpen={isClearAllConfirmOpen}
        title="Clear All Store Data?"
        message="Are you sure you want to delete all purchase bills, inventory products, and sales invoices from MongoDB? The system will start completely fresh."
        confirmText="Yes, Clear All Data"
        isDanger={true}
        onConfirm={handleClearAllStoreData}
        onCancel={() => setIsClearAllConfirmOpen(false)}
      />

      {/* Confirmation Modal for Demo Reset */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset to Demo Data?"
        message="This will reset your products, invoices, and purchase entries to the preloaded sample catalog. Are you sure you want to proceed?"
        confirmText="Yes, Reset Database"
        isDanger={false}
        onConfirm={handleResetDemoData}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
