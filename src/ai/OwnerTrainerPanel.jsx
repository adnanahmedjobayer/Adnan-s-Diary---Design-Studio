import React, { useRef, useState } from 'react';
import {
  applyOwnerDatasetFromDrive,
  deleteOwnerSampleAt,
  exportTrainingDatasetJson,
  getCriticStats,
  getOwnerDatasetPayload,
  importTrainingDatasetJson,
  listOwnerSamplesSummary,
  loadCustomSamples,
  resetNeuralTraining,
  trainNeuralWithCurrentDesign,
  undoLastNeuralSample
} from './neuralEngine.js';
import {
  getSavedDriveUrl,
  loadOwnerDbFromDrive,
  saveDriveUrl,
  saveOwnerDbToDrive
} from './driveSync.js';
import { analyzeCanvasVision } from './visionAnalyzer.js';

const OWNER_UNLOCK_KEY = 'adnans_owner_trainer_v1';
const OWNER_PIN = '2580';

export function useOwnerTrainerGate() {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(OWNER_UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const tapRef = useRef({ count: 0, lastAt: 0 });

  const handleSecretTap = () => {
    if (unlocked) return;
    const now = Date.now();
    if (now - tapRef.current.lastAt > 1800) {
      tapRef.current.count = 0;
    }
    tapRef.current.lastAt = now;
    tapRef.current.count += 1;

    if (tapRef.current.count >= 5) {
      tapRef.current.count = 0;
      setShowPinPrompt(true);
    }
  };

  const submitPin = (pinInput) => {
    if (String(pinInput).trim() === OWNER_PIN) {
      try {
        localStorage.setItem(OWNER_UNLOCK_KEY, '1');
      } catch {}
      setUnlocked(true);
      setShowPinPrompt(false);
      return true;
    }
    return false;
  };

  const lockOwnerMode = () => {
    try {
      localStorage.removeItem(OWNER_UNLOCK_KEY);
    } catch {}
    setUnlocked(false);
    setShowPinPrompt(false);
  };

  return {
    isOwnerUnlocked: unlocked,
    showPinPrompt,
    setShowPinPrompt,
    handleSecretTap,
    submitPin,
    lockOwnerMode
  };
}

export default function OwnerTrainerPanel({
  gate,
  nnContext,
  bgConfig,
  canvasSize,
  layers = [],
  onTrained,
  onStartReviewLoop
}) {
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [count, setCount] = useState(() => loadCustomSamples().length);
  const [criticInfo, setCriticInfo] = useState(() => getCriticStats());
  const [driveUrl, setDriveUrl] = useState(() => getSavedDriveUrl());
  const [showEditList, setShowEditList] = useState(false);
  const [sampleItems, setSampleItems] = useState([]);
  const fileInputRef = useRef(null);

  if (!gate) return null;

  if (!gate.isOwnerUnlocked) {
    if (!gate.showPinPrompt) return null;

    return (
      <div
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(148, 163, 184, 0.25)'
        }}
      >
        <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>
          Owner PIN দিন:
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinErr('');
            }}
            placeholder="PIN"
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: 13
            }}
          />
          <button
            type="button"
            onClick={() => {
              const ok = gate.submitPin(pin);
              if (!ok) setPinErr('পিন সঠিক নয়');
              else setPin('');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            আনলক
          </button>
          <button
            type="button"
            onClick={() => gate.setShowPinPrompt(false)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            বাতিল
          </button>
        </div>
        {pinErr ? (
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{pinErr}</div>
        ) : null}
      </div>
    );
  }

  const refreshSummaries = () => {
    setCount(loadCustomSamples().length);
    setCriticInfo(getCriticStats());
    if (showEditList) {
      setSampleItems(listOwnerSamplesSummary());
    }
  };

  const handleTrain = async () => {
    setBusy(true);
    setStatus('লাইভ ক্যানভাস ও টেক্সট বিশ্লেষণ করে মডেল শিখছে...');
    try {
      const liveBg = bgConfig || nnContext?.bgConfig;
      const liveVision = liveBg
        ? await analyzeCanvasVision(liveBg, canvasSize || { width: 1080, height: 1080 })
        : nnContext?.vision;

      if (!liveVision) {
        setStatus('ক্যানভাস স্ক্যান করা যায়নি');
        setBusy(false);
        return;
      }

      const res = await trainNeuralWithCurrentDesign({
        vision: liveVision,
        layers,
        bgConfig: liveBg
      });
      refreshSummaries();
      setStatus(`শেখা সম্পন্ন! মোট: ${res.totalTrained}টি (loss: ${res.loss})`);
      if (onTrained) onTrained(res);
    } catch (e) {
      setStatus(e?.message || 'ট্রেইন করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!count) return;
    setBusy(true);
    try {
      const res = await undoLastNeuralSample();
      refreshSummaries();
      setStatus(`শেষ ডিজাইনটি বাদ দেওয়া হয়েছে (মোট: ${res.totalTrained}টি)`);
      if (onTrained) onTrained(res);
    } catch {
      setStatus('Undo করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const handleDriveLoad = async () => {
    setBusy(true);
    setStatus('Google Drive থেকে Owner ডাটাবেইজ লোড হচ্ছে...');
    try {
      const remoteData = await loadOwnerDbFromDrive(driveUrl, OWNER_PIN);
      const res = await applyOwnerDatasetFromDrive(remoteData);
      setCount(res.totalTrained);
      setCriticInfo(res.criticStats || getCriticStats());
      if (showEditList) setSampleItems(listOwnerSamplesSummary());
      setStatus(`Drive থেকে ${res.totalTrained}টি স্যাম্পল লোড ও ট্রেইন হয়েছে!`);
      if (onTrained) onTrained(res);
    } catch (e) {
      setStatus(e?.message || 'Drive থেকে লোড ব্যর্থ হয়েছে');
    } finally {
      setBusy(false);
    }
  };

  const handleDriveUpdate = async () => {
    setBusy(true);
    setStatus('Google Drive-এ আপডেট হচ্ছে...');
    try {
      const payload = getOwnerDatasetPayload();
      const res = await saveOwnerDbToDrive(driveUrl, OWNER_PIN, payload);
      setStatus(`Drive আপডেট সম্পন্ন! (${res.count}টি স্যাম্পল)`);
    } catch (e) {
      setStatus(e?.message || 'Drive আপডেট ব্যর্থ হয়েছে');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEdit = () => {
    const next = !showEditList;
    setShowEditList(next);
    if (next) {
      setSampleItems(listOwnerSamplesSummary());
    }
  };

  const handleDeleteSample = async (idx) => {
    setBusy(true);
    try {
      const res = await deleteOwnerSampleAt(idx);
      setCount(res.totalTrained);
      setCriticInfo(res.criticStats || getCriticStats());
      setSampleItems(listOwnerSamplesSummary());
      setStatus(`স্যাম্পল #${idx + 1} বাদ দেওয়া হয়েছে (Drive-এ রাখতে "Drive আপডেট" চাপুন)`);
      if (onTrained) onTrained(res);
    } catch {
      setStatus('স্যাম্পল বাদ দেওয়া যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const handleExportDataset = () => {
    const n = exportTrainingDatasetJson();
    setStatus(`${n}টি স্যাম্পল + Critic ডাটা JSON ডাউনলোড হয়েছে`);
  };

  const handleImportDataset = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const res = await importTrainingDatasetJson(text);
      refreshSummaries();
      setStatus(`${res.totalTrained}টি স্যাম্পল লোড ও ট্রেইন হয়েছে`);
      if (onTrained) onTrained(res);
    } catch (err) {
      setStatus(err?.message || 'ফাইল লোড করা যায়নি');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await resetNeuralTraining();
      setCount(0);
      setCriticInfo({ total: 0, likes: 0, dislikes: 0 });
      setSampleItems([]);
      setStatus('Actor ও Critic মডেল রিসেট হয়েছে');
      if (onTrained) onTrained({ reset: true });
    } catch {
      setStatus('রিসেট করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(30, 41, 59, 0.85)',
        border: '1px dashed rgba(129, 140, 248, 0.5)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>
          Owner AI v12 (ট্রেইনড: {count}টি • 👍{criticInfo.likes}/👎{criticInfo.dislikes})
        </span>
        <button
          type="button"
          onClick={gate.lockOwnerMode}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          লুকান
        </button>
      </div>

      {onStartReviewLoop && (
        <button
          type="button"
          disabled={busy}
          onClick={onStartReviewLoop}
          style={{
            width: '100%',
            padding: '9px 10px',
            marginBottom: 8,
            borderRadius: 9,
            border: 'none',
            background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🤖 AI রিভিউ লুপ চালু (AI বানাবে, আপনি 👍/👎 রিভিউ করবেন)
        </button>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          disabled={busy}
          onClick={handleTrain}
          style={{
            flex: 1,
            minWidth: 135,
            padding: '8px 10px',
            borderRadius: 8,
            border: 'none',
            background: '#4f46e5',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + এই ডিজাইন থেকে শেখো
        </button>

        <button
          type="button"
          disabled={busy || count === 0}
          onClick={handleUndo}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #475569',
            background: '#0f172a',
            color: '#fbbf24',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          শেষটি বাদ
        </button>

        <button
          type="button"
          disabled={busy || count === 0}
          onClick={handleExportDataset}
          style={{
            padding: '6px 9px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          Save Data
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '6px 9px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          Load Data
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleReset}
          style={{
            padding: '6px 9px',
            borderRadius: 8,
            border: '1px solid rgba(248, 113, 113, 0.4)',
            background: 'transparent',
            color: '#fca5a5',
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          রিসেট
        </button>
      </div>

      {/* Google Drive Sync & Edit */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid rgba(148, 163, 184, 0.2)'
        }}
      >
        <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600, marginBottom: 5 }}>
          ☁️ Google Drive ডাটাবেইজ (Load / Update / Edit)
        </div>
        <input
          type="url"
          value={driveUrl}
          onChange={(e) => {
            setDriveUrl(e.target.value);
            saveDriveUrl(e.target.value);
          }}
          placeholder="Google Apps Script Web App URL দিন..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            marginBottom: 6,
            borderRadius: 7,
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e2e8f0',
            fontSize: 11
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy || !driveUrl}
            onClick={handleDriveLoad}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 7,
              border: '1px solid #0284c7',
              background: 'rgba(2, 132, 199, 0.2)',
              color: '#bae6fd',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Drive লোড
          </button>
          <button
            type="button"
            disabled={busy || !driveUrl}
            onClick={handleDriveUpdate}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 7,
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Drive আপডেট
          </button>
          <button
            type="button"
            disabled={busy || count === 0}
            onClick={handleToggleEdit}
            style={{
              padding: '6px 9px',
              borderRadius: 7,
              border: '1px solid #475569',
              background: showEditList ? '#334155' : 'transparent',
              color: '#e2e8f0',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            {showEditList ? 'বন্ধ' : 'ডাটা এডিট'}
          </button>
        </div>

        {showEditList && (
          <div
            style={{
              marginTop: 7,
              maxHeight: 130,
              overflowY: 'auto',
              background: '#0f172a',
              borderRadius: 8,
              padding: 6,
              border: '1px solid #334155'
            }}
          >
            {sampleItems.length === 0 ? (
              <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                কোনো স্যাম্পল নেই
              </div>
            ) : (
              sampleItems.map((item) => (
                <div
                  key={`${item.index}-${item.at}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 10,
                    color: '#cbd5e1',
                    padding: '3px 4px',
                    borderBottom: '1px solid rgba(51,65,85,0.5)'
                  }}
                >
                  <span>{item.summary}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDeleteSample(item.index)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      fontSize: 10,
                      cursor: 'pointer'
                    }}
                  >
                    বাদ দিন
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportDataset}
      />

      {status ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#cbd5e1' }}>{status}</div>
      ) : null}
    </div>
  );
}
