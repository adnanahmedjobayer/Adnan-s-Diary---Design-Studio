import React from 'react';
import { Download } from 'lucide-react';

export default function ExportModal({
  open,
  onClose,
  canvasSize,
  exportName,
  setExportName,
  exportFormat,
  setExportFormat,
  exportScale,
  setExportScale,
  exportQuality,
  setExportQuality,
  exporting,
  bgTransparent,
  onConfirm
}) {
  if (!open) return null;

  const outResW = Math.round((canvasSize?.width || 1080) * exportScale);
  const outResH = Math.round((canvasSize?.height || 1080) * exportScale);

  return (
    <div className="modal-backdrop" onClick={() => !exporting && onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h4 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Download size={16} color="#38bdf8" /> ছবি সেভ করুন ({outResW}×{outResH})
        </h4>

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>ফাইলের নাম</div>
        <input
          type="text"
          className="modal-textarea"
          style={{ marginTop: 0, marginBottom: 12, padding: '8px 10px', fontSize: 13 }}
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder="ফাইলের নাম লিখুন..."
        />

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>ফরম্যাট</div>
        <div className="px-mini-grid" style={{ marginBottom: 12 }}>
          <button className={`px-toggle-pill ${exportFormat === 'png' ? 'on' : ''}`} onClick={() => setExportFormat('png')}>
            PNG (স্বচ্ছ / HD)
          </button>
          <button className={`px-toggle-pill ${exportFormat === 'jpg' ? 'on' : ''}`} onClick={() => setExportFormat('jpg')}>
            JPG (হালকা সাইজ)
          </button>
        </div>

        {bgTransparent && exportFormat === 'jpg' && (
          <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 10, lineHeight: 1.4 }}>
            নোট: ট্রান্সপারেন্ট ব্যাকগ্রাউন্ড JPG-তে সেভ করলে সাদা ব্যাকগ্রাউন্ড বসবে। স্বচ্ছ রাখতে PNG সিলেক্ট করুন।
          </div>
        )}

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>রেজোলিউশন (সাইজ)</div>
        <div className="px-mini-grid" style={{ marginBottom: exportFormat === 'jpg' ? 12 : 16 }}>
          {[
            { label: 'Medium', val: 0.75 },
            { label: 'Standard', val: 1 },
            { label: 'Ultra HD (2x)', val: 2 }
          ].map((opt) => (
            <button
              key={opt.label}
              className={`px-toggle-pill ${exportScale === opt.val ? 'on' : ''}`}
              onClick={() => setExportScale(opt.val)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {exportFormat === 'jpg' && (
          <>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>JPG কোয়ালিটি</div>
            <div className="px-mini-grid" style={{ marginBottom: 16 }}>
              {[
                { label: '60%', val: 0.6 },
                { label: '80%', val: 0.8 },
                { label: '92% (সেরা)', val: 0.92 },
                { label: '100%', val: 1 }
              ].map((q) => (
                <button
                  key={q.label}
                  className={`px-toggle-pill ${exportQuality === q.val ? 'on' : ''}`}
                  onClick={() => setExportQuality(q.val)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" disabled={exporting} onClick={onClose}>বাতিল</button>
          <button
            className="btn-primary"
            style={{ background: '#0284c7', opacity: exporting ? 0.6 : 1 }}
            disabled={exporting}
            onClick={onConfirm}
          >
            {exporting ? 'সেভ হচ্ছে...' : 'গ্যালারিতে সেভ'}
          </button>
        </div>
      </div>
    </div>
  );
}
