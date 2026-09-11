import React from 'react';

export default function Logo({ size = 'md', showText = true, light = false }) {
  const dimensions = {
    sm: { icon: 32, fontMain: '0.95rem', fontSub: '0.65rem' },
    md: { icon: 44, fontMain: '1.15rem', fontSub: '0.72rem' },
    lg: { icon: 64, fontMain: '1.5rem', fontSub: '0.85rem' },
    xl: { icon: 84, fontMain: '2rem', fontSub: '1rem' }
  }[size] || { icon: 44, fontMain: '1.15rem', fontSub: '0.72rem' };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
      <img
        src="/assets/osv_logo.svg"
        alt="Om Sahu Vastralaya"
        style={{
          width: dimensions.icon,
          height: dimensions.icon,
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(197, 155, 39, 0.25)',
          objectFit: 'contain'
        }}
      />
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: dimensions.fontMain,
              fontWeight: 700,
              color: light ? '#FFFFFF' : 'var(--text-primary)',
              letterSpacing: '0.04em',
              lineHeight: 1.15
            }}
          >
            OM SAHU VASTRALAYA
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: dimensions.fontSub,
              color: light ? 'var(--gold-400)' : 'var(--gold-600)',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            Clothing • Fashion • Quality
          </span>
        </div>
      )}
    </div>
  );
}
