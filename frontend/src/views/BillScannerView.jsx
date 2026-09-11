import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  FileImage,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Eye,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { purchaseApi } from '../services/api';
import { performBillOCR, preprocessImage } from '../services/ocrService';
import { calculatePricing } from '../services/pricingService';
import { db } from '../db/db';
import confetti from 'canvas-confetti';

export default function BillScannerView({
  setActiveTab,
  onShowToast
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ status: '', progress: 0 });
  const [extractedItems, setExtractedItems] = useState([]);
  const [billDetails, setBillDetails] = useState({
    supplierName: 'Kayaan Wholesale Fabrics, Surat',
    billNumber: `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().split('T')[0]
  });

  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load Sample Bill for instant demonstration
  const handleLoadSampleBill = async () => {
    const sampleUrl = '/assets/sample_bill.jpeg';
    setImagePreviewUrl(sampleUrl);
    setSelectedImage(sampleUrl);
    setExtractedItems([]);
    setBillDetails({
      supplierName: 'Kayaan Textiles & Fabrics, Surat',
      billNumber: 'BILL-2026-KAY-8821',
      date: new Date().toISOString().split('T')[0]
    });
  };

  // Handle File Input Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setExtractedItems([]);
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Webcam Capture
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Camera access denied or unavailable. Please use file upload instead.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_bill_${Date.now()}.jpg`, { type: 'image/jpeg' });
          processFile(file);
          stopCamera();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  // Run OCR Scan
  const handleRunOCR = async () => {
    if (!selectedImage && !imagePreviewUrl) return;

    setIsScanning(true);
    setScanProgress({ status: 'Starting Neural OCR engine...', progress: 0.1 });

    try {
      const source = selectedImage || imagePreviewUrl;
      const result = await performBillOCR(source, (progressUpdate) => {
        setScanProgress(progressUpdate);
      });

      if (result.success && result.items) {
        setExtractedItems(result.items);
        if (onShowToast) onShowToast(`Extracted ${result.items.length} products from bill! Review before saving.`, 'success');
      }
    } catch (err) {
      console.error('OCR failed:', err);
      if (onShowToast) onShowToast('OCR failed. Please check image clarity.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Editing Extracted Row
  const handleItemChange = (index, field, value) => {
    const updated = [...extractedItems];
    updated[index][field] = value;
    // Mark as reviewed
    updated[index].needsReview = false;
    setExtractedItems(updated);
  };

  // Delete Row
  const handleDeleteRow = (index) => {
    setExtractedItems(extractedItems.filter((_, i) => i !== index));
  };

  // Add Manual Row
  const handleAddManualRow = () => {
    const nextSr = extractedItems.length + 1;
    setExtractedItems([
      ...extractedItems,
      {
        id: `manual-${Date.now()}`,
        srNo: nextSr,
        productName: '',
        hsn: '540752',
        wholesaleRate: 400.00,
        quantity: 1,
        unit: 'Pcs',
        confidence: 100,
        needsReview: false
      }
    ]);
  };

  // Save to Database
  const handleSaveToDatabase = async () => {
    if (extractedItems.length === 0) {
      alert('No products to save. Please scan or add products first.');
      return;
    }

    // Validate empty product names
    const invalidItems = extractedItems.filter(i => !i.productName || !i.productName.trim());
    if (invalidItems.length > 0) {
      alert('Please provide a valid Product Name for all rows before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const today = billDetails.date || new Date().toISOString().split('T')[0];
      const totalAmount = extractedItems.reduce((sum, item) => sum + ((parseFloat(item.wholesaleRate) || 0) * (parseFloat(item.quantity) || 1)), 0);

      // Prepare items payload
      const itemsPayload = extractedItems.map((item, idx) => ({
        srNo: item.srNo || (idx + 1),
        productName: item.productName.trim(),
        hsn: item.hsn || '540752',
        category: item.productName.toUpperCase().includes('SAREE') ? 'Saree' : item.productName.toUpperCase().includes('SET') ? 'Suit Set' : 'Clothing',
        wholesaleRate: parseFloat(item.wholesaleRate) || 0,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Pcs',
        gstPercent: 5,
        profitPercent: 20
      }));

      // 1. Try MongoDB API
      let savedToMongo = false;
      try {
        const res = await purchaseApi.createBill({
          billId: billDetails.billNumber,
          supplierName: billDetails.supplierName || 'Wholesale Supplier',
          imageUrl: typeof selectedImage === 'string' ? selectedImage : '/assets/sample_bill.jpeg',
          date: today,
          items: itemsPayload
        });
        if (res.success) {
          savedToMongo = true;
        }
      } catch (apiErr) {
        console.warn('MongoDB API error, saving locally to Dexie:', apiErr.message);
      }

      // 2. Also keep local Dexie updated for offline resilience
      try {
        await db.purchaseBills.add({
          billId: billDetails.billNumber,
          supplierName: billDetails.supplierName || 'Wholesale Supplier',
          imageUrl: typeof selectedImage === 'string' ? selectedImage : '/assets/sample_bill.jpeg',
          date: today,
          totalItems: extractedItems.length,
          totalAmount: Number(totalAmount.toFixed(2)),
          createdAt: new Date().toISOString()
        });

        for (const item of extractedItems) {
          const rate = parseFloat(item.wholesaleRate) || 0;
          const qty = parseFloat(item.quantity) || 1;
          const pricing = calculatePricing(rate, 5, 20);

          await db.purchaseItems.add({
            billId: billDetails.billNumber,
            srNo: item.srNo,
            productName: item.productName.trim(),
            hsn: item.hsn || '540752',
            wholesaleRate: rate,
            quantity: qty,
            unit: item.unit || 'Pcs',
            createdAt: new Date().toISOString()
          });

          const existingProduct = await db.products.where('productName').equalsIgnoreCase(item.productName.trim()).first();
          if (existingProduct) {
            await db.products.update(existingProduct.id, {
              hsn: item.hsn || existingProduct.hsn,
              wholesaleRate: pricing.wholesaleRate,
              costAfterGST: pricing.costAfterGST,
              sellingPrice: pricing.sellingPrice,
              stock: (existingProduct.stock || 0) + qty,
              updatedAt: new Date().toISOString()
            });
          } else {
            await db.products.add({
              productName: item.productName.trim(),
              hsn: item.hsn || '540752',
              category: item.productName.includes('SAREE') ? 'Saree' : item.productName.includes('SET') ? 'Suit Set' : 'Clothing',
              wholesaleRate: pricing.wholesaleRate,
              gstPercent: pricing.gstPercent,
              costAfterGST: pricing.costAfterGST,
              profitPercent: pricing.profitPercent,
              sellingPrice: pricing.sellingPrice,
              stock: qty,
              dateAdded: today,
              updatedAt: new Date().toISOString()
            });
          }
        }
      } catch (dexieErr) {
        console.warn('Local Dexie update error:', dexieErr);
      }

      // Celebratory Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      if (onShowToast) {
        onShowToast(`Saved ${extractedItems.length} products to Purchase History (Rate-to-Rate) & Product Master (+5% GST +15% Profit)!`, 'success');
      }

      // Reset scanner state
      setSelectedImage(null);
      setImagePreviewUrl(null);
      setExtractedItems([]);

      // Navigate to Purchase History
      setTimeout(() => {
        setActiveTab('purchases');
      }, 900);
    } catch (err) {
      console.error('Failed to save purchase bill:', err);
      alert('Error saving products: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Purchase Bill Scanner</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Capture or upload supplier bills • AI OCR extracts Sr No, Product Name & Wholesale Rate
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleLoadSampleBill}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'var(--gold-400)', color: 'var(--gold-600)' }}
          >
            <Sparkles size={15} />
            <span>Load Sample Bill (Test Demo)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Upload & Preview on Left, Extracted OCR Table on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: imagePreviewUrl ? 'minmax(340px, 420px) 1fr' : '1fr',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Step 1: Upload / Camera Capture Panel */}
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={18} style={{ color: 'var(--gold-500)' }} />
            <span>1. Capture / Upload Bill</span>
          </h2>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/jpg"
            style={{ display: 'none' }}
          />

          {/* Camera View Mode */}
          {isCameraActive ? (
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', marginBottom: '1rem' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '280px', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                  onClick={capturePhoto}
                  className="btn btn-primary"
                  style={{ borderRadius: '999px', padding: '0.75rem 1.5rem' }}
                >
                  <Camera size={18} />
                  <span>Snap Bill Photo</span>
                </button>
                <button
                  onClick={stopCamera}
                  className="btn btn-dark"
                  style={{ borderRadius: '999px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  border: '2px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-card-hover)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '1rem'
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: 'var(--gold-100)',
                    color: 'var(--gold-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem'
                  }}
                >
                  <Upload size={24} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Drag & Drop Bill Image or Click to Browse
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Supports JPG, JPEG, PNG (Physical wholesaler bills)
                </div>
              </div>

              {/* Action buttons: Camera vs File */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <button
                  onClick={startCamera}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  <Camera size={16} style={{ color: 'var(--gold-500)' }} />
                  <span>Open Camera</span>
                </button>

                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  <FileImage size={16} />
                  <span>Choose File</span>
                </button>
              </div>
            </>
          )}

          {/* Image Preview & Scan Action */}
          {imagePreviewUrl && (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Bill Preview:</span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                    className="btn btn-icon btn-secondary"
                    style={{ padding: '0.25rem' }}
                    title="Zoom In"
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                    className="btn btn-icon btn-secondary"
                    style={{ padding: '0.25rem' }}
                    title="Zoom Out"
                  >
                    <ZoomOut size={15} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: '340px',
                  overflow: 'auto',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  background: '#1A1715',
                  textAlign: 'center',
                  padding: '0.5rem'
                }}
              >
                <img
                  src={imagePreviewUrl}
                  alt="Scanned Bill"
                  style={{
                    maxWidth: '100%',
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                    borderRadius: '4px'
                  }}
                />
              </div>

              {/* Scan Trigger Button */}
              <button
                onClick={handleRunOCR}
                disabled={isScanning}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Scanning ({Math.round(scanProgress.progress * 100)}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Start OCR Product Extraction</span>
                  </>
                )}
              </button>

              {/* Scanning Progress Bar */}
              {isScanning && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {scanProgress.status}
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--bg-secondary)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.round(scanProgress.progress * 100)}%`,
                        background: 'var(--gold-gradient)',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Extracted Products Confirmation Table */}
        {extractedItems.length > 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--emerald-500)' }} />
                  <span>2. Review & Edit Extracted Products</span>
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Verify extracted product names & wholesale rates before saving into Product Master.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAddManualRow}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus size={15} />
                  <span>+ Add Row</span>
                </button>
              </div>
            </div>

            {/* Bill Meta Inputs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                background: 'var(--bg-secondary)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)'
              }}
            >
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Wholesaler / Supplier</label>
                <input
                  type="text"
                  value={billDetails.supplierName}
                  onChange={(e) => setBillDetails({ ...billDetails, supplierName: e.target.value })}
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bill Reference ID</label>
                <input
                  type="text"
                  value={billDetails.billNumber}
                  onChange={(e) => setBillDetails({ ...billDetails, billNumber: e.target.value })}
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Purchase Date</label>
                <input
                  type="date"
                  value={billDetails.date}
                  onChange={(e) => setBillDetails({ ...billDetails, date: e.target.value })}
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Editable Products Table */}
            <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Sr.</th>
                    <th>Product Name</th>
                    <th style={{ width: '90px' }}>Qty</th>
                    <th style={{ width: '130px' }}>Wholesale (₹)</th>
                    <th style={{ width: '130px' }}>Est. Selling (₹)</th>
                    <th style={{ width: '50px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {extractedItems.map((item, index) => {
                    const pricing = calculatePricing(item.wholesaleRate, 5, 20);

                    return (
                      <tr
                        key={item.id || index}
                        style={{
                          background: item.needsReview ? 'rgba(254, 243, 199, 0.4)' : undefined
                        }}
                      >
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                          {index + 1}
                        </td>

                        {/* Product Name Input */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                              placeholder="Product Name"
                              className="form-input"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem', fontWeight: 600 }}
                            />
                            {item.needsReview && (
                              <span
                                title="Low OCR confidence - please verify name & price"
                                style={{ color: 'var(--amber-500)', cursor: 'help' }}
                              >
                                <AlertCircle size={16} />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity Input */}
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="form-input"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                          />
                        </td>

                        {/* Wholesale Rate Input */}
                        <td>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.wholesaleRate}
                              onChange={(e) => handleItemChange(index, 'wholesaleRate', e.target.value)}
                              className="form-input"
                              style={{ padding: '0.4rem 0.6rem 0.4rem 1.4rem', fontSize: '0.875rem', fontWeight: 600 }}
                            />
                          </div>
                        </td>

                        {/* Calculated Auto Selling Price (+5% GST +20% Profit) */}
                        <td style={{ fontWeight: 700, color: 'var(--gold-600)' }}>
                          ₹{pricing.sellingPrice}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            +5% GST → +20%
                          </div>
                        </td>

                        {/* Delete Row Button */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteRow(index)}
                            className="btn btn-icon btn-secondary"
                            style={{ padding: '0.35rem', color: 'var(--rose-500)', border: 'none' }}
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions: Save to Database */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                borderTop: '1px solid var(--border-light)',
                paddingTop: '1rem'
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Total <strong>{extractedItems.length}</strong> items • Wholesale Value: <strong>₹{extractedItems.reduce((s, i) => s + ((parseFloat(i.wholesaleRate) || 0) * (parseFloat(i.quantity) || 1)), 0).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setExtractedItems([])}
                  className="btn btn-secondary"
                >
                  Clear
                </button>

                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  className="btn btn-primary btn-lg"
                >
                  <Save size={18} />
                  <span>{isSaving ? 'Saving Products...' : 'Save Products to Database'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
