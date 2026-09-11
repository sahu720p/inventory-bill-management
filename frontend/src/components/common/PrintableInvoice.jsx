import React, { useRef, useState, useEffect } from 'react';
import { Printer, Download, X, FileText, CheckCircle, Smartphone, Phone, Instagram } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatCurrency } from '../../services/pricingService';
import { db } from '../../db/db';

export default function PrintableInvoice({
  invoice,
  items: initialItems = [],
  shopInfo = {
    name: 'OM SAHU VASTRALAYA',
    subtitle: 'Clothing • Fashion • Quality',
    address: 'Rahulnagar Market, Sultanpur, Uttar Pradesh – 228171',
    phone: '+91 8368429410',
    instagram: 'omsahuvastralaya009'
  },
  onClose
}) {
  const [printLayout, setPrintLayout] = useState('a4'); // 'a4' or 'thermal'
  const [isExporting, setIsExporting] = useState(false);
  const [lineItems, setLineItems] = useState(initialItems);
  const printRef = useRef(null);

  useEffect(() => {
    async function loadItems() {
      if (!initialItems || initialItems.length === 0) {
        if (invoice?.items && invoice.items.length > 0) {
          setLineItems(invoice.items);
        } else if (invoice?.id) {
          try {
            const dbItems = await db.invoiceItems.where('invoiceId').equals(invoice.id).toArray();
            setLineItems(dbItems || []);
          } catch (e) {
            console.error('Failed to load invoice items in modal:', e);
          }
        }
      } else {
        setLineItems(initialItems || []);
      }
    }
    loadItems();
  }, [invoice, initialItems]);

  if (!invoice) return null;

  // Handle direct print
  const handlePrint = () => {
    window.print();
  };

  // Handle PDF Download
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: printLayout === 'thermal' ? 'portrait' : 'portrait',
        unit: 'mm',
        format: printLayout === 'thermal' ? [80, 200] : 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoice.invoiceNumber || 'Invoice'}_Om_Sahu_Vastralaya.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Could not export PDF. You can use Print -> Save as PDF instead.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-xl"
        style={{ maxWidth: printLayout === 'thermal' ? '560px' : '900px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Actions */}
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--gold-100)',
                color: 'var(--gold-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Tax Invoice & Receipt</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {invoice.invoiceNumber} • {invoice.date}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Format Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                padding: '0.2rem',
                borderRadius: 'var(--radius-md)',
                marginRight: '0.5rem'
              }}
            >
              <button
                onClick={() => setPrintLayout('a4')}
                className={`btn btn-sm ${printLayout === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', border: 'none' }}
              >
                A4 Standard
              </button>
              <button
                onClick={() => setPrintLayout('thermal')}
                className={`btn btn-sm ${printLayout === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', border: 'none' }}
              >
                <Smartphone size={13} />
                80mm POS
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="btn btn-dark btn-sm"
              title="Print Invoice"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="btn btn-primary btn-sm"
              title="Download PDF"
            >
              <Download size={16} />
              <span>{isExporting ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="btn btn-icon btn-secondary"
              style={{ border: 'none' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Rendered Invoice */}
        <div
          className="modal-body"
          style={{
            background: '#F7F5F0',
            padding: '1.5rem',
            maxHeight: '75vh',
            overflowY: 'auto'
          }}
        >
          {/* Printable Container */}
          <div
            ref={printRef}
            className="printable-invoice-container"
            style={{
              background: '#FFFFFF',
              width: '100%',
              maxWidth: printLayout === 'thermal' ? '380px' : '800px',
              margin: '0 auto',
              padding: printLayout === 'thermal' ? '1.5rem 1.25rem' : '2.5rem 3rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: printLayout === 'thermal' ? '4px' : '8px',
              fontFamily: 'var(--font-sans)',
              color: '#1A1715'
            }}
          >
            {/* Header: Shop Branding */}
            <div
              style={{
                borderBottom: printLayout === 'thermal' ? '1px dashed #666' : '2px solid var(--gold-500)',
                paddingBottom: printLayout === 'thermal' ? '0.75rem' : '1.25rem',
                marginBottom: printLayout === 'thermal' ? '0.75rem' : '1.5rem',
                textAlign: printLayout === 'thermal' ? 'center' : 'left',
                display: printLayout === 'thermal' ? 'block' : 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: printLayout === 'thermal' ? 'center' : 'flex-start', gap: '0.65rem' }}>
                  <img
                    src="/assets/osv_logo.svg"
                    alt="Logo"
                    style={{ width: printLayout === 'thermal' ? 36 : 48, height: printLayout === 'thermal' ? 36 : 48 }}
                  />
                  <div>
                    <h1
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: printLayout === 'thermal' ? '1.25rem' : '1.65rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        color: '#1A1715',
                        margin: 0
                      }}
                    >
                      {shopInfo.name}
                    </h1>
                    <div style={{ fontSize: printLayout === 'thermal' ? '0.72rem' : '0.82rem', color: 'var(--gold-600)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {shopInfo.subtitle}
                    </div>
                  </div>
                </div>

                <p style={{ marginTop: '0.4rem', fontSize: printLayout === 'thermal' ? '0.72rem' : '0.85rem', color: '#555', lineHeight: 1.35 }}>
                  {shopInfo.address}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginTop: '0.25rem', fontSize: printLayout === 'thermal' ? '0.72rem' : '0.85rem', color: '#333' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <Phone size={printLayout === 'thermal' ? 12 : 14} style={{ color: 'var(--gold-600)' }} />
                    <span>+91 8368429410</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <Instagram size={printLayout === 'thermal' ? 12 : 14} style={{ color: '#E1306C' }} />
                    <span>omsahuvastralaya009</span>
                  </span>
                </div>
              </div>

              {printLayout === 'a4' && (
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      background: 'var(--gold-gradient)',
                      color: '#1A1715',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'inline-block',
                      marginBottom: '0.5rem'
                    }}
                  >
                    TAX INVOICE
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1715' }}>
                    {invoice.invoiceNumber}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#666' }}>
                    Date: {invoice.date} {invoice.time ? `• ${invoice.time}` : invoice.createdAt ? `• ${new Date(invoice.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Thermal Title & Info */}
            {printLayout === 'thermal' && (
              <div style={{ textAlign: 'center', marginBottom: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 700 }}>TAX INVOICE / RETAIL RECEIPT</div>
                <div>Invoice: <strong>{invoice.invoiceNumber}</strong></div>
                <div>Date: {invoice.date} {invoice.time ? `• ${invoice.time}` : ''}</div>
              </div>
            )}

            {/* Customer Details Box */}
            <div
              style={{
                background: '#FAF8F5',
                padding: printLayout === 'thermal' ? '0.6rem' : '0.85rem 1.15rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
                border: '1px solid #EBE5DC',
                display: printLayout === 'thermal' ? 'block' : 'flex',
                justifyContent: 'space-between',
                fontSize: printLayout === 'thermal' ? '0.78rem' : '0.875rem'
              }}
            >
              <div>
                <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Billed To (Customer):</div>
                <div style={{ fontWeight: 700, color: '#1A1715', fontSize: '1rem' }}>
                  {invoice.customerName || 'Cash Customer'}
                </div>
                {invoice.customerMobile && (
                  <div>Mobile: +91 {invoice.customerMobile}</div>
                )}
                {invoice.customerAddress && (
                  <div>Address: {invoice.customerAddress}</div>
                )}
              </div>

              {printLayout === 'a4' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Payment Details:</div>
                  <div style={{ fontWeight: 600 }}>Mode: {invoice.paymentMode || 'Cash'}</div>
                  <div style={{ color: 'var(--emerald-800)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <CheckCircle size={14} /> Paid
                  </div>
                </div>
              )}
            </div>

            {/* Products Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: printLayout === 'thermal' ? '0.75rem' : '0.875rem',
                marginBottom: '1.25rem'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid #1A1715', background: '#F5F2EB' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Product / Description</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                  const rate = Number(item.rate ?? item.sellingPrice ?? item.price ?? 0) || 0;
                  const lineTotal = Number(item.amount ?? item.total ?? (qty * rate)) || 0;
                  const name = item.productName || item.name || 'Product';

                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #EBE5DC' }}>
                      <td style={{ padding: '0.5rem' }}>{index + 1}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{name}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{rate.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ width: printLayout === 'thermal' ? '100%' : '260px', fontSize: printLayout === 'thermal' ? '0.8rem' : '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', color: '#555' }}>
                  <span>Total Items:</span>
                  <span>{lineItems.reduce((s, i) => s + (parseInt(i.quantity ?? i.qty) || 1), 0)} Pcs</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0',
                    borderTop: '2px solid #1A1715',
                    marginTop: '0.35rem',
                    fontSize: printLayout === 'thermal' ? '1rem' : '1.15rem',
                    fontWeight: 800,
                    color: '#1A1715'
                  }}
                >
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--gold-600)' }}>{formatCurrency(invoice.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Footer / Thank You Note */}
            <div
              style={{
                borderTop: '1px dashed #CCC',
                paddingTop: '1rem',
                textAlign: 'center',
                fontSize: printLayout === 'thermal' ? '0.72rem' : '0.82rem',
                color: '#666'
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: printLayout === 'thermal' ? '0.85rem' : '1rem',
                  color: '#1A1715',
                  marginBottom: '0.25rem'
                }}
              >
                Thank You for Shopping at Om Sahu Vastralaya!
              </div>
              <div>Visit again for the finest sarees, suit sets & fabrics in Sultanpur.</div>
              {printLayout === 'a4' && (
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.75rem', color: '#888' }}>
                  <div>Terms: Goods once sold can be exchanged within 7 days with original bill.</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #999', width: '120px', height: '30px', marginBottom: '0.25rem' }}></div>
                    <div>Authorised Signatory</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
