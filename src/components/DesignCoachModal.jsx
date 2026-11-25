import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Wand2, RotateCcw, Check } from 'lucide-react';
import OwnerTrainerPanel, { useOwnerTrainerGate } from '../ai/OwnerTrainerPanel.jsx';

const cloneBg = (bg) => {
  if (!bg) return null;
  return {
    ...bg,
    ...(bg.pattern ? { pattern: { ...bg.pattern } } : {}),
    ...(bg.moodFilter ? { moodFilter: { ...bg.moodFilter } } : {})
  };
};

const alignTextBn = (a) => (a === 'left' ? 'বাম' : a === 'right' ? 'ডান' : 'মাঝখান');

export default function DesignCoachModal({
  open,
  onClose,
  bgConfig,
  layers,
  canvasSize,
  selectedId,
  onUpdateLayers,
  onUpdateBg
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasModified, setHasModified] = useState(false);
  const [applyVignetteToo, setApplyVignetteToo] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // 'none' | 'user' | 'owner'
  const [loopMode, setLoopMode] = useState('none');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewInfo, setReviewInfo] = useState('');
  const [curCandidate, setCurCandidate] = useState(null);
  const [userStats, setUserStats] = useState({ total: 0, likes: 0, dislikes: 0 });
  const rejectedRef = useRef([]);

  const initialLayersRef = useRef(null);
  const initialBgRef = useRef(null);
  const ownerGate = useOwnerTrainerGate();

  useEffect(() => {
    if (open) {
      initialLayersRef.current = layers.map((l) =>
        l.customShape ? { ...l, customShape: { ...l.customShape } } : { ...l }
      );
      initialBgRef.current = cloneBg(bgConfig);
      setHasModified(false);
      setLoopMode('none');
      setCurCandidate(null);
      setReviewInfo('');
      rejectedRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || loopMode !== 'none') return;
    let active = true;
    setLoading(true);

    const scanBg = initialBgRef.current || bgConfig;
    const scanLayers = initialLayersRef.current || layers;

    import('../ai/index.js')
      .then(({ runAiDesignCoach }) =>
        runAiDesignCoach({ bgConfig: scanBg, layers: scanLayers, canvasSize, selectedId })
      )
      .then((res) => {
        if (active) {
          setReport(res);
          if (res?.userTasteStats) setUserStats(res.userTasteStats);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loopMode, canvasSize, selectedId, refreshTick]);

  if (!open) return null;

  const spawnNextCandidate = async (
    baseBg = initialBgRef.current || bgConfig,
    baseLayers = initialLayersRef.current || layers,
    mode = loopMode,
    explore = true
  ) => {
    setReviewBusy(true);
    try {
      const { generateAiReviewCandidate } = await import('../ai/index.js');
      const res = await generateAiReviewCandidate({
        bgConfig: baseBg,
        layers: baseLayers,
        canvasSize,
        rejectedVectors: rejectedRef.current,
        includeUserTaste: mode !== 'owner',
        explore
      });
      setCurCandidate(res);
      setHasModified(true);
      onUpdateLayers(res.nextLayers);

      if (onUpdateBg && res.nextBg) {
        if (mode === 'owner' || applyVignetteToo) {
          onUpdateBg(res.nextBg);
        }
      }

      const p = res.prediction;
      const criticTxt =
        p.criticScore !== null && p.criticScore !== undefined
          ? ` • স্কোর:${Math.round(p.criticScore * 100)}%`
          : '';
      setReviewInfo(
        `হেডলাইন: (${Math.round(p.headX)}%,${Math.round(p.headY)}%) [${alignTextBn(p.headAlign)}] • সাব: (${Math.round(p.subX)}%,${Math.round(p.subY)}%) [${alignTextBn(p.subAlign)}] • ${p.headSize}px${criticTxt}`
      );
    } catch {
      setReviewInfo('নতুন ডিজাইন তৈরি করা যায়নি');
    } finally {
      setReviewBusy(false);
    }
  };

  const pushCurrentRejection = (limit = 10) => {
    const p = curCandidate?.prediction;
    if (!p?.rawVector) return;
    rejectedRef.current = [
      ...rejectedRef.current.slice(-(limit - 1)),
      p.rawVector
    ];
  };

  const handleStartUserGenerator = async () => {
    rejectedRef.current = [];
    setLoopMode('user');
    await spawnNextCandidate(
      initialBgRef.current || bgConfig,
      initialLayersRef.current || layers,
      'user',
      false
    );
  };

  const handleUserGenerateNext = async () => {
    if (reviewBusy) return;
    pushCurrentRejection(12);
    await spawnNextCandidate(
      initialBgRef.current || bgConfig,
      initialLayersRef.current || layers,
      'user',
      true
    );
  };

  const handleUserTasteFeedback = async (liked) => {
    if (reviewBusy || !curCandidate?.prediction?.rawVector) return;
    if (!liked) pushCurrentRejection(12);
    setReviewBusy(true);
    setReviewInfo(liked ? 'আপনার পার্সোনাল পছন্দে সেভ হচ্ছে...' : 'অপছন্দটি বাদ দিয়ে নতুন ডিজাইন বানাচ্ছে...');
    try {
      const { recordUserDesignFeedback } = await import('../ai/index.js');
      const stats = await recordUserDesignFeedback({
        bgConfig: initialBgRef.current || bgConfig,
        layers: curCandidate?.nextLayers || layers,
        canvasSize,
        rawVector: curCandidate.prediction.rawVector,
        liked
      });
      setUserStats(stats);
      if (liked) {
        setReviewInfo(`👍 পার্সোনাল প্রোফাইলে সেভ হয়েছে! (👍${stats.likes} 👎${stats.dislikes})`);
        setReviewBusy(false);
        return;
      }
    } catch {}
    await spawnNextCandidate(
      initialBgRef.current || bgConfig,
      initialLayersRef.current || layers,
      'user',
      true
    );
  };

  const handleResetUserTaste = async () => {
    try {
      const { resetUserPersonalTaste } = await import('../ai/index.js');
      const stats = await resetUserPersonalTaste();
      setUserStats(stats);
      setReviewInfo('আপনার পার্সোনাল পছন্দ রিসেট হয়েছে');
    } catch {}
  };

  const handleUserAccept = () => {
    setLoopMode('none');
    onClose();
  };

  const handleStopLoop = () => {
    setLoopMode('none');
    setRefreshTick((t) => t + 1);
  };

  const handleStartReviewLoop = async () => {
    rejectedRef.current = [];
    setLoopMode('owner');
    await spawnNextCandidate(
      initialBgRef.current || bgConfig,
      initialLayersRef.current || layers,
      'owner',
      true
    );
  };

  const handleApproveAndNext = async () => {
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewInfo('Actor ও Critic মডেল শিখছে...');
    try {
      const { approveAndTrainReviewDesign } = await import('../ai/index.js');
      const trained = await approveAndTrainReviewDesign({
        bgConfig,
        layers,
        canvasSize
      });
      rejectedRef.current = [];
      setReviewInfo(`শিখেছে! 👍 ${trained.totalTrained}টি • পরেরটি তৈরি হচ্ছে...`);
      await spawnNextCandidate(
        initialBgRef.current || bgConfig,
        initialLayersRef.current || layers,
        'owner',
        true
      );
    } catch (err) {
      setReviewInfo(err?.message || 'শেখানো যায়নি');
      setReviewBusy(false);
    }
  };

  const handleRejectAndRetry = async () => {
    if (reviewBusy) return;
    pushCurrentRejection(10);
    setReviewBusy(true);
    setReviewInfo('Critic অপছন্দটি শিখছে ও নতুন ডিজাইন বানাচ্ছে...');
    try {
      const rawVector = curCandidate?.prediction?.rawVector;
      if (rawVector) {
        const { rejectAndTrainReviewDesign } = await import('../ai/index.js');
        await rejectAndTrainReviewDesign({
          bgConfig: initialBgRef.current || bgConfig,
          layers: curCandidate?.nextLayers || layers,
          canvasSize,
          rawVector
        });
      }
    } catch {}
    await spawnNextCandidate(
      initialBgRef.current || bgConfig,
      initialLayersRef.current || layers,
      'owner',
      true
    );
  };

  const handleApplyPaletteColor = (hex) => {
    const target =
      layers.find((l) => l.id === selectedId && !l.locked && (l.type === 'text' || l.type === 'shape')) ||
      layers.find((l) => l.visible !== false && !l.locked && l.type === 'text');
    if (!target) return;
    setHasModified(true);
    onUpdateLayers(
      layers.map((l) =>
        l.id === target.id
          ? { ...l, colorMode: 'solid', textureSrc: null, color: hex }
          : l
      )
    );
  };

  const handleResetToOriginal = () => {
    if (initialLayersRef.current) {
      onUpdateLayers(initialLayersRef.current);
    }
    if (onUpdateBg && initialBgRef.current) {
      onUpdateBg(initialBgRef.current);
    }
    setHasModified(false);
    setCurCandidate(null);
    setReviewInfo('');
    rejectedRef.current = [];
  };

  if (loopMode !== 'none') {
    const isOwner = loopMode === 'owner';
    return (
      <div
        style={{
          position: 'fixed',
          left: 10,
          right: 10,
          bottom: 12,
          zIndex: 220,
          maxWidth: 420,
          margin: '0 auto',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          borderRadius: 14,
          padding: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.55)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7dd3fc' }}>
            {isOwner ? '🤖 AI রিভিউ লুপ' : '✨ AI ডিজাইন জেনারেটর'}{' '}
            {reviewBusy ? '(তৈরি হচ্ছে...)' : ''}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleResetToOriginal}
              style={{
                background: 'transparent',
                border: '1px solid #475569',
                borderRadius: 6,
                color: '#fbbf24',
                fontSize: 10,
                padding: '3px 7px',
                cursor: 'pointer'
              }}
            >
              আসল অবস্থা
            </button>
            <button
              type="button"
              onClick={handleStopLoop}
              style={{
                background: '#334155',
                border: 'none',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 10,
                padding: '3px 8px',
                cursor: 'pointer'
              }}
            >
              {isOwner ? 'শেষ করুন' : 'ফিরে যান'}
            </button>
          </div>
        </div>

        {reviewInfo ? (
          <div style={{ fontSize: 10, color: '#cbd5e1', marginBottom: 8 }}>{reviewInfo}</div>
        ) : null}

        {isOwner ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={handleRejectAndRetry}
              style={{
                flex: 1,
                padding: '9px 10px',
                borderRadius: 9,
                border: '1px solid rgba(244, 63, 94, 0.45)',
                background: 'rgba(244, 63, 94, 0.16)',
                color: '#fda4af',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              👎 বদলাও
            </button>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={handleApproveAndNext}
              style={{
                flex: 1.35,
                padding: '9px 10px',
                borderRadius: 9,
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              👍 পছন্দ (শেখো ও পরেরটা)
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleUserTasteFeedback(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(34, 197, 94, 0.45)',
                    background: 'rgba(22, 163, 74, 0.16)',
                    color: '#86efac',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  👍 পছন্দ
                </button>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleUserTasteFeedback(false)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    background: 'rgba(244, 63, 94, 0.16)',
                    color: '#fda4af',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  👎 অপছন্দ
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>পার্সোনাল: 👍{userStats.likes}/👎{userStats.dislikes}</span>
                {userStats.total > 0 && (
                  <button
                    type="button"
                    onClick={handleResetUserTaste}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    রিসেট
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={handleUserGenerateNext}
                style={{
                  flex: 1.25,
                  padding: '9px 10px',
                  borderRadius: 9,
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: 'rgba(2, 132, 199, 0.25)',
                  color: '#bae6fd',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5
                }}
              >
                <Wand2 size={13} /> আরেকটি বানাও
              </button>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={handleUserAccept}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5
                }}
              >
                <Check size={14} /> এটি ব্যবহার করুন
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const pred = report?.nnPrediction;

  return (
    <div className="modal-backdrop" style={{ zIndex: 205 }} onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 380, maxHeight: '86dvh', overflowY: 'auto', padding: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span
            onClick={ownerGate.handleSecretTap}
            style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
          >
            <Sparkles size={16} color="#38bdf8" /> স্মার্ট ডিজাইন AI প্রো
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasModified && (
              <button
                className="chip-btn"
                style={{ padding: '3px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, borderColor: '#fbbf24', color: '#fbbf24' }}
                onClick={handleResetToOriginal}
              >
                <RotateCcw size={11} /> আগের অবস্থায়
              </button>
            )}
            <button className="layer-close-btn" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        {loading && !report ? (
          <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 12, color: '#94a3b8' }}>
            Deep Neural v12 ছবি ও লেখা বিশ্লেষণ করছে...
          </div>
        ) : report ? (
          <>
            <div className="coach-score-card" style={{ marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                  {report.isTrained ? 'Deep Neural v12 (ট্রেইনড Actor-Critic)' : 'Deep Neural v12 প্রস্তুত'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  {report.bgSummary} • {report.genreLabel}
                </div>
                <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 3 }}>
                  AI নির্ধারিত জোন: {report.zoneLabel} • {report.fontCount}টি ফন্ট
                  {userStats.total > 0 ? ` • পার্সোনাল: 👍${userStats.likes}/👎${userStats.dislikes}` : ''}
                </div>
                {pred && (
                  <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 5, lineHeight: 1.5 }}>
                    অবস্থান: ({Math.round(pred.headX)}%, {Math.round(pred.headY)}%) • {alignTextBn(pred.headAlign)} • {pred.headSize}px
                    {report.predictedFont ? ` • ${report.predictedFont}` : ''}
                    {pred.criticScore !== null && pred.criticScore !== undefined
                      ? ` • স্কোর: ${Math.round(pred.criticScore * 100)}%`
                      : ''}
                  </div>
                )}
              </div>
            </div>

            {report.palette?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5 }}>
                  ছবির পিক্সেল থেকে পাওয়া রঙ (ট্যাপ করলেই লেখায় বসবে):
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {report.palette.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => handleApplyPaletteColor(p.hex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#e2e8f0',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: p.hex,
                          border: '1px solid rgba(255,255,255,0.4)'
                        }}
                      />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onUpdateBg && !bgConfig?.transparent && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#cbd5e1',
                  marginBottom: 10,
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={applyVignetteToo}
                  onChange={(e) => setApplyVignetteToo(e.target.checked)}
                />
                <span>AI নির্ধারিত ভিনিয়েট ও আলো প্রয়োগ করুন</span>
              </label>
            )}

            {!report.hasUnlockedText && (
              <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center', marginBottom: 12 }}>
                সাজানোর জন্য ক্যানভাসে অন্তত একটি আনলকড টেক্সট রাখুন।
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>বন্ধ করুন</button>
              <button
                className="btn-primary"
                disabled={!report.hasUnlockedText || !pred}
                style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={handleStartUserGenerator}
              >
                <Wand2 size={14} />
                {hasModified ? 'নতুন ডিজাইন জেনারেট করুন' : 'AI দিয়ে অটো সাজান'}
              </button>
            </div>

            <OwnerTrainerPanel
              gate={ownerGate}
              nnContext={report?.nnContext}
              bgConfig={bgConfig}
              canvasSize={canvasSize}
              layers={layers}
              onTrained={() => setRefreshTick((t) => t + 1)}
              onStartReviewLoop={handleStartReviewLoop}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
