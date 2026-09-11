import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to delete this record?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDanger = true,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-content"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isDanger ? 'var(--rose-100)' : 'var(--amber-100)',
                color: isDanger ? 'var(--rose-800)' : 'var(--amber-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ fontSize: '1.15rem' }}>{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="btn btn-icon btn-secondary"
            style={{ padding: '0.35rem', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem 1.75rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        <div className="modal-footer">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
