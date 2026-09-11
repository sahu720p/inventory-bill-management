import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  PlusCircle,
  Camera,
  User,
  Clock,
  Sparkles,
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import Logo from './Logo';

export default function Header({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  currentUser,
  onLogout,
  onBack,
  onResetToDashboard
}) {
  const [time, setTime] = useState(new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      {/* Left: Mobile Menu, Back Button & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={onOpenMobileMenu}
          className="btn btn-icon btn-secondary"
          style={{ display: window.innerWidth <= 768 ? 'inline-flex' : 'none' }}
          title="Open Menu"
        >
          <Menu size={22} />
        </button>

        {/* Back Button (Appears when not on Dashboard) */}
        {activeTab !== 'dashboard' && (
          <button
            onClick={onBack}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="Go back to previous screen"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        )}

        <div
          onClick={onResetToDashboard || (() => setActiveTab('dashboard'))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'opacity 0.15s ease'
          }}
          title="Click to return to Dashboard"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              letterSpacing: '0.03em'
            }}
          >
            OM SAHU VASTRALAYA
          </span>
          <span
            className="badge badge-gold"
            style={{
              display: window.innerWidth <= 600 ? 'none' : 'inline-flex',
              fontSize: '0.72rem'
            }}
          >
            <Sparkles size={11} />
            Admin Portal
          </span>
        </div>
      </div>

      {/* Right: Quick Action Buttons & Profile Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Live Date / Time */}
        <div
          style={{
            display: window.innerWidth <= 900 ? 'none' : 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-light)'
          }}
        >
          <Clock size={14} style={{ color: 'var(--gold-500)' }} />
          <span>
            {time.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
            {' • '}
            {time.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* Quick OCR Scanner Button */}
        <button
          onClick={() => setActiveTab('scanner')}
          className="btn btn-secondary btn-sm"
          style={{ display: window.innerWidth <= 500 ? 'none' : 'inline-flex' }}
        >
          <Camera size={16} style={{ color: 'var(--gold-600)' }} />
          <span>Scan Bill</span>
        </button>

        {/* Quick New Sale Button */}
        <button
          onClick={() => setActiveTab('new-invoice')}
          className="btn btn-primary btn-sm"
        >
          <PlusCircle size={16} />
          <span>+ New Invoice</span>
        </button>

        {/* Interactive Admin Profile Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              background: isDropdownOpen ? 'rgba(197, 155, 39, 0.15)' : 'var(--bg-secondary)',
              borderRadius: 'var(--radius-full)',
              border: isDropdownOpen ? '1px solid var(--gold-500)' : '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: 'var(--text-primary)'
            }}
            title="Admin Account Menu"
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--gold-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A1715',
                fontWeight: 800,
                fontSize: '0.75rem'
              }}
            >
              OS
            </div>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: window.innerWidth <= 600 ? 'none' : 'inline'
              }}
            >
              Admin
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {/* Floating Dropdown Menu */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-medium)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              {/* Header inside dropdown */}
              <div
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border-light)',
                  background: '#FCFAF7'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--gold-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1A1715',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}
                  >
                    OS
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1715' }}>
                      {currentUser?.username || 'Admin User'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {currentUser?.email || 'admin@omsahuvastralaya.com'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setActiveTab('settings');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F2EB'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={16} style={{ color: 'var(--gold-600)' }} />
                  <span>Shop Settings & Password</span>
                </button>

                <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.35rem 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: 'none',
                    color: 'var(--rose-800)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'}
                >
                  <LogOut size={16} style={{ color: 'var(--rose-800)' }} />
                  <span>Log Out (Exit Portal)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
