import React, { useState, useEffect } from 'react';
import { settingsApi } from './services/api';
import { initDatabase, db } from './db/db';
import { clearAllStoreData } from './db/seedData';
import { getCurrentUser, logout } from './services/authService';

import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import PrintableInvoice from './components/common/PrintableInvoice';

import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import BillScannerView from './views/BillScannerView';
import PurchaseHistoryView from './views/PurchaseHistoryView';
import ProductMasterView from './views/ProductMasterView';
import NewInvoiceView from './views/NewInvoiceView';
import SalesHistoryView from './views/SalesHistoryView';
import SettingsView from './views/SettingsView';

import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabHistory, setTabHistory] = useState(['dashboard']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active Printable Invoice Modal
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);
  const [activePrintItems, setActivePrintItems] = useState([]);
  const [shopInfo, setShopInfo] = useState({
    name: 'OM SAHU VASTRALAYA',
    subtitle: 'Clothing • Fashion • Quality',
    address: 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
    phone: '+91 8368429410',
    instagram: 'omsahuvastralaya009'
  });

  // Toast Notification System
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // 1. Initialize Database & Clean Data
    async function bootstrap() {
      try {
        await initDatabase();
      } catch (e) {}

      const user = getCurrentUser();
      setCurrentUser(user);

      // Try loading shop settings from MongoDB API
      let loaded = false;
      try {
        const res = await settingsApi.getAll();
        if (res.success && res.map) {
          setShopInfo({
            name: res.map.shop_name || 'OM SAHU VASTRALAYA',
            subtitle: res.map.shop_subtitle || 'Clothing • Fashion • Quality',
            address: res.map.shop_address || 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
            phone: res.map.shop_phone || '+91 8368429410',
            instagram: res.map.shop_instagram || 'omsahuvastralaya009'
          });
          loaded = true;
        }
      } catch (e) {}

      // Fallback to local Dexie
      if (!loaded) {
        try {
          const settings = await db.settings.toArray();
          const map = {};
          settings.forEach(s => { map[s.key] = s.value; });
          setShopInfo({
            name: map.shop_name || 'OM SAHU VASTRALAYA',
            subtitle: map.shop_subtitle || 'Clothing • Fashion • Quality',
            address: map.shop_address || 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
            phone: map.shop_phone || '+91 8368429410',
            instagram: map.shop_instagram || 'omsahuvastralaya009'
          });
        } catch (e) {}
      }
    }
    bootstrap();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setTabHistory(['dashboard']);
    setActiveTab('dashboard');
    showToast(`Welcome back, ${user.username}!`, 'success');
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setTabHistory(['dashboard']);
    setActiveTab('dashboard');
    showToast('Logged out successfully', 'info');
  };

  // Navigate to tab with history tracking
  const handleNavigate = (tab) => {
    if (tab === activeTab) return;
    setTabHistory(prev => [...prev, tab]);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Go Back to previous tab
  const handleBack = () => {
    if (tabHistory.length > 1) {
      const updatedHistory = [...tabHistory];
      updatedHistory.pop(); // remove current active tab
      const previousTab = updatedHistory[updatedHistory.length - 1];
      setTabHistory(updatedHistory);
      setActiveTab(previousTab);
    } else {
      setTabHistory(['dashboard']);
      setActiveTab('dashboard');
    }
  };

  // Full reset back to Dashboard
  const handleResetToDashboard = () => {
    setTabHistory(['dashboard']);
    setActiveTab('dashboard');
    setIsMobileMenuOpen(false);
  };

  // Open Printable Invoice Modal
  const handleOpenPrintModal = async (invoice, items = []) => {
    try {
      const settings = await db.settings.toArray();
      const map = {};
      settings.forEach(s => { map[s.key] = s.value; });
      setShopInfo({
        name: map.shop_name || 'OM SAHU VASTRALAYA',
        subtitle: map.shop_subtitle || 'Clothing • Fashion • Quality',
        address: map.shop_address || 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
        phone: map.shop_phone || '+91 8368429410',
        instagram: map.shop_instagram || 'omsahuvastralaya009'
      });
    } catch (e) {}

    // Ensure invoice items are always loaded
    let invoiceItemsList = items;
    if (!invoiceItemsList || invoiceItemsList.length === 0) {
      if (invoice?.items && invoice.items.length > 0) {
        invoiceItemsList = invoice.items;
      } else if (invoice?.id) {
        invoiceItemsList = await db.invoiceItems.where('invoiceId').equals(invoice.id).toArray();
      }
    }

    setActivePrintInvoice(invoice);
    setActivePrintItems(invoiceItemsList || []);
  };

  // If user is not authenticated, show Login View
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.25rem',
            zIndex: 9999,
            background: toast.type === 'error' ? 'var(--rose-800)' : 'var(--bg-dark-card)',
            color: '#FFFFFF',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            border: `1px solid ${toast.type === 'error' ? 'var(--rose-500)' : 'var(--gold-400)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={20} style={{ color: '#FECDD3' }} />
          ) : (
            <CheckCircle2 size={20} style={{ color: 'var(--gold-400)' }} />
          )}
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#B0A89F', cursor: 'pointer', marginLeft: '0.5rem' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
        onResetToDashboard={handleResetToDashboard}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Sticky Header with Back button and Home Reset */}
        <Header
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onBack={handleBack}
          onResetToDashboard={handleResetToDashboard}
        />

        {/* Page Views Container */}
        <main className="page-body">
          {activeTab === 'dashboard' && (
            <DashboardView
              setActiveTab={handleNavigate}
              onViewInvoice={handleOpenPrintModal}
            />
          )}

          {activeTab === 'scanner' && (
            <BillScannerView
              setActiveTab={handleNavigate}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchaseHistoryView
              setActiveTab={handleNavigate}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'products' && (
            <ProductMasterView
              setActiveTab={handleNavigate}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'new-invoice' && (
            <NewInvoiceView
              setActiveTab={handleNavigate}
              onInvoiceCreated={handleOpenPrintModal}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'sales' && (
            <SalesHistoryView
              setActiveTab={handleNavigate}
              onViewInvoice={handleOpenPrintModal}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              setActiveTab={handleNavigate}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Website Footer with Copyright 2026 */}
        <footer
          style={{
            padding: '1.25rem 2rem',
            textAlign: 'center',
            borderTop: '1px solid var(--border-light)',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: 'auto',
            background: 'var(--bg-card)'
          }}
        >
          <div>
            © 2026 <strong>Om Sahu Vastralaya</strong>. All Rights Reserved.
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Clothing • Fashion • Quality • Rahulnagar Market, Sultanpur
          </div>
        </footer>
      </div>

      {/* Printable Invoice Modal */}
      {activePrintInvoice && (
        <PrintableInvoice
          invoice={activePrintInvoice}
          items={activePrintItems}
          shopInfo={shopInfo}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}
    </div>
  );
}
