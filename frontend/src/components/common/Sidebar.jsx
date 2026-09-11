import React from 'react';
import {
  LayoutDashboard,
  Camera,
  PackageCheck,
  Shirt,
  Receipt,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  onLogout,
  onResetToDashboard
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scanner', label: 'Purchase Bill Scanner', shortLabel: 'Bill Scanner', icon: Camera, badge: 'OCR' },
    { id: 'purchases', label: 'Purchase History', shortLabel: 'Purchases', icon: PackageCheck },
    { id: 'products', label: 'Product Master', shortLabel: 'Products', icon: Shirt },
    { id: 'new-invoice', label: 'New Invoice', shortLabel: 'New Sale', icon: Receipt, highlight: true },
    { id: 'sales', label: 'Sales History', shortLabel: 'Invoices', icon: History },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleLogoClick = () => {
    if (onResetToDashboard) {
      onResetToDashboard();
    } else {
      handleNavClick('dashboard');
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          position: isMobileOpen ? 'fixed' : 'relative',
          top: 0,
          bottom: 0,
          left: 0,
          display: !isMobileOpen && window.innerWidth <= 768 ? 'none' : 'flex'
        }}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
          <div
            onClick={handleLogoClick}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none',
              transition: 'transform 0.15s ease'
            }}
            title="Click to go to Dashboard"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {!isCollapsed ? (
              <Logo size="md" light={true} />
            ) : (
              <img
                src="/assets/osv_logo.svg"
                alt="OSV"
                style={{ width: 36, height: 36, borderRadius: '8px' }}
              />
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn btn-icon"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#B0A89F',
              border: 'none',
              cursor: 'pointer',
              display: window.innerWidth <= 768 ? 'none' : 'inline-flex'
            }}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Shop Address & Badge */}
        {!isCollapsed && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              margin: '0.5rem 0.75rem',
              background: 'rgba(197, 155, 39, 0.08)',
              border: '1px solid rgba(197, 155, 39, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              color: '#D8C7B0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--gold-400)', fontWeight: 600, marginBottom: '0.2rem' }}>
              <Sparkles size={13} />
              <span>Sultanpur Outlet</span>
            </div>
            <div style={{ opacity: 0.85, fontSize: '0.72rem', lineHeight: 1.3 }}>
              Rahulnagar Market – 228171
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(197, 155, 39, 0.25) 0%, rgba(197, 155, 39, 0.08) 100%)'
                    : item.highlight
                      ? 'rgba(197, 155, 39, 0.12)'
                      : 'transparent',
                  color: isActive ? '#F8E3AC' : '#D4CDC3',
                  border: isActive
                    ? '1px solid rgba(197, 155, 39, 0.4)'
                    : item.highlight
                      ? '1px dashed rgba(197, 155, 39, 0.35)'
                      : '1px solid transparent',
                  width: '100%',
                  textAlign: 'left'
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className="nav-icon"
                  size={20}
                  style={{
                    color: isActive ? 'var(--gold-400)' : item.highlight ? 'var(--gold-400)' : 'inherit',
                    flexShrink: 0
                  }}
                />

                {!isCollapsed && (
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}

                {!isCollapsed && item.badge && (
                  <span
                    style={{
                      background: 'var(--gold-gradient)',
                      color: '#1A1715',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
