import React, { useState } from 'react';
import { Lock, User, Sparkles, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/common/Logo';
import { login } from '../services/authService';

export default function LoginView({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await login(identifier, password);
      onLoginSuccess(user);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        background: '#141311'
      }}
    >
      {/* Left / Hero Section */}
      <div
        style={{
          flex: '1.1',
          position: 'relative',
          backgroundImage: 'url(/assets/hero_bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: window.innerWidth <= 900 ? 'none' : 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3.5rem',
          color: '#FFFFFF'
        }}
      >
        {/* Overlay gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(20, 19, 17, 0.75) 0%, rgba(20, 19, 17, 0.4) 50%, rgba(20, 19, 17, 0.95) 100%)'
          }}
        />

        {/* Brand Header on Hero */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Logo size="lg" light={true} />
        </div>

        {/* Hero Central Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '520px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(197, 155, 39, 0.2)',
              border: '1px solid rgba(197, 155, 39, 0.4)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              color: 'var(--gold-300)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}
          >
            <Sparkles size={14} />
            <span>Exquisite Indian Sarees & Ethnic Fabrics</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2.75rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              lineHeight: 1.15,
              color: '#FFFFFF',
              marginBottom: '1rem'
            }}
          >
            Smart Inventory & Purchase Billing
          </h1>

          <p style={{ fontSize: '1.05rem', color: '#E5DCCE', lineHeight: 1.6 }}>
            Automate bill scanning, OCR product extraction, instant GST & profit pricing, and generate professional customer invoices.
          </p>
        </div>

        {/* Store Address Banner at Bottom */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background: 'rgba(26, 23, 21, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(197, 155, 39, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ color: 'var(--gold-400)', fontWeight: 700, fontSize: '0.9rem' }}>
              OM SAHU VASTRALAYA
            </div>
            <div style={{ color: '#C8BFB3', fontSize: '0.8125rem' }}>
              Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171
            </div>
          </div>
          <div
            style={{
              background: 'var(--gold-gradient)',
              color: '#1A1715',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.75rem'
            }}
          >
            EST. SULTANPUR
          </div>
        </div>
      </div>

      {/* Right / Login Form Section */}
      <div
        style={{
          flex: '0.9',
          minWidth: window.innerWidth <= 900 ? '100%' : '480px',
          background: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem',
          position: 'relative'
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Mobile Top Brand Logo */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <Logo size="lg" light={false} />
          </div>

          <div
            className="card"
            style={{
              padding: '2.5rem 2.25rem',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-light)'
            }}
          >
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Admin Portal Login
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Enter your admin credentials to access the portal
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  background: 'var(--rose-100)',
                  color: 'var(--rose-800)',
                  border: '1px solid #FECDD3',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem'
                }}
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: '0.35rem' }}>Username / Email</label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }}
                  />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: '0.35rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', fontSize: '0.95rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                {isLoading ? 'Verifying Credentials...' : 'Sign In to Dashboard'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          {/* Security Notice */}
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              color: 'var(--text-muted)',
              fontSize: '0.8rem'
            }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--emerald-500)' }} />
            <span>Strictly Admin-Only Protected System</span>
          </div>

          {/* Website Copyright Footer */}
          <div
            style={{
              marginTop: '2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '1rem'
            }}
          >
            © 2026 <strong>Om Sahu Vastralaya</strong>. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
