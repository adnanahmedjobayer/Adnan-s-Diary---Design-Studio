const SNAP_THRESH = 1.8;
const ROT_THRESH = 4;
const KEY_ANGLES = [0, 45, 90, 135, 180, -45, -90, -135, -180];

export function triggerHapticTick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(6);
    }
  } catch {}
}

export function collectOtherLayerTargets(layers, activeId, canvasEl, boxW, boxH) {
  if (!canvasEl || !boxW || !boxH) return [];
  const targets = [];
  for (const l of layers) {
    if (l.id === activeId || l.visible === false) continue;
    const el = canvasEl.querySelector(`[data-layer-id="${l.id}"]`);
    const wPct = el ? (el.offsetWidth / boxW) * 100 : ((l.width || 110) / boxW) * 100;
    const hPct = el ? (el.offsetHeight / boxH) * 100 : ((l.height || l.width || 60) / boxH) * 100;
    targets.push({
      id: l.id,
      cx: l.x,
      cy: l.y,
      left: l.x - wPct / 2,
      right: l.x + wPct / 2,
      top: l.y - hPct / 2,
      bottom: l.y + hPct / 2,
      wPct,
      hPct
    });
  }
  return targets;
}

function findBestAxisMatch({ rawCenter, halfSize, targets, isX }) {
  const candidates = [];

  // ১. ক্যানভাস সেন্টার (50%)
  candidates.push({
    dist: Math.abs(rawCenter - 50),
    snappedCenter: 50,
    linePos: 50,
    kind: 'center',
    priority: 1
  });

  // ২. সেফ মার্জিন (6% ও 94%)
  candidates.push({
    dist: Math.abs((rawCenter - halfSize) - 6),
    snappedCenter: 6 + halfSize,
    linePos: 6,
    kind: 'safe',
    priority: 3
  });
  candidates.push({
    dist: Math.abs((rawCenter + halfSize) - 94),
    snappedCenter: 94 - halfSize,
    linePos: 94,
    kind: 'safe',
    priority: 3
  });

  // ৩. রুল অব থার্ডস (33.33%, 66.67%)
  for (const third of [33.33, 66.67]) {
    candidates.push({
      dist: Math.abs(rawCenter - third),
      snappedCenter: third,
      linePos: third,
      kind: 'third',
      priority: 4
    });
  }

  // ৪. অন্যান্য লেয়ারের সেন্টার ও কিনারা (Edges)
  for (const t of targets) {
    const tCenter = isX ? t.cx : t.cy;
    const tStart = isX ? t.left : t.top;
    const tEnd = isX ? t.right : t.bottom;
    const crossA = isX ? t.cy : t.cx;

    candidates.push({
      dist: Math.abs(rawCenter - tCenter),
      snappedCenter: tCenter,
      linePos: tCenter,
      kind: 'layer',
      crossPos: crossA,
      priority: 2
    });

    const dragStart = rawCenter - halfSize;
    const dragEnd = rawCenter + halfSize;

    // বাম/উপর -> বাম/উপর এবং ডান/নিচ
    candidates.push({
      dist: Math.abs(dragStart - tStart),
      snappedCenter: tStart + halfSize,
      linePos: tStart,
      kind: 'layer-edge',
      priority: 2
    });
    candidates.push({
      dist: Math.abs(dragStart - tEnd),
      snappedCenter: tEnd + halfSize,
      linePos: tEnd,
      kind: 'layer-edge',
      priority: 2
    });

    // ডান/নিচ -> ডান/নিচ এবং বাম/উপর
    candidates.push({
      dist: Math.abs(dragEnd - tEnd),
      snappedCenter: tEnd - halfSize,
      linePos: tEnd,
      kind: 'layer-edge',
      priority: 2
    });
    candidates.push({
      dist: Math.abs(dragEnd - tStart),
      snappedCenter: tStart - halfSize,
      linePos: tStart,
      kind: 'layer-edge',
      priority: 2
    });
  }

  const hits = candidates
    .filter((c) => c.dist <= SNAP_THRESH)
    .sort((a, b) => a.priority - b.priority || a.dist - b.dist);

  if (!hits.length) return null;

  const best = hits[0];
  const sameLineHits = hits.filter((h) => Math.abs(h.linePos - best.linePos) < 0.8);
  return {
    snappedCenter: best.snappedCenter,
    lines: sameLineHits.slice(0, 2).map((h) => ({ pos: h.linePos, kind: h.kind }))
  };
}

function findEqualSpacing(rawCenter, halfSize, otherCenter, otherHalf, targets, isX) {
  if (targets.length < 2) return null;

  // একই লাইনে বা কাছাকাছি থাকা লেয়ারগুলোর সাথে গ্যাপ চেক
  const aligned = targets
    .filter((t) => Math.abs((isX ? t.cy : t.cx) - otherCenter) < Math.max(18, otherHalf + (isX ? t.hPct : t.wPct) / 2))
    .sort((a, b) => (isX ? a.cx - b.cx : a.cy - b.cy));

  if (aligned.length < 2) return null;

  const dragStart = rawCenter - halfSize;
  const dragEnd = rawCenter + halfSize;

  for (let i = 0; i < aligned.length - 1; i++) {
    const a = aligned[i];
    const b = aligned[i + 1];
    const aEnd = isX ? a.right : a.bottom;
    const bStart = isX ? b.left : b.top;
    const bEnd = isX ? b.right : b.bottom;
    const aStart = isX ? a.left : a.top;

    // ১) Dragged মাঝখানে থাকলে: [A] - gap1 - [Dragged] - gap2 - [B]
    if (dragStart > aEnd - 2 && dragEnd < bStart + 2) {
      const gap1 = dragStart - aEnd;
      const gap2 = bStart - dragEnd;
      if (Math.abs(gap1 - gap2) <= SNAP_THRESH * 2 && gap1 > 1) {
        const idealCenter = (aEnd + bStart) / 2;
        const avgGap = (bStart - aEnd - halfSize * 2) / 2;
        if (avgGap > 1) {
          return {
            snappedCenter: idealCenter,
            guides: [
              { axis: isX ? 'x' : 'y', from: aEnd, to: idealCenter - halfSize, cross: otherCenter },
              { axis: isX ? 'x' : 'y', from: idealCenter + halfSize, to: bStart, cross: otherCenter }
            ]
          };
        }
      }
    }

    // ২) Dragged ডানে/নিচে থাকলে: [A] - gap - [B] - gap - [Dragged]
    const baseGap = bStart - aEnd;
    if (baseGap > 2) {
      const targetStart = bEnd + baseGap;
      if (Math.abs(dragStart - targetStart) <= SNAP_THRESH) {
        return {
          snappedCenter: targetStart + halfSize,
          guides: [
            { axis: isX ? 'x' : 'y', from: aEnd, to: bStart, cross: isX ? (a.cy + b.cy) / 2 : (a.cx + b.cx) / 2 },
            { axis: isX ? 'x' : 'y', from: bEnd, to: targetStart, cross: otherCenter }
          ]
        };
      }
      // ৩) Dragged বামে/উপরে থাকলে: [Dragged] - gap - [A] - gap - [B]
      const targetEnd = aStart - baseGap;
      if (Math.abs(dragEnd - targetEnd) <= SNAP_THRESH) {
        return {
          snappedCenter: targetEnd - halfSize,
          guides: [
            { axis: isX ? 'x' : 'y', from: targetEnd, to: aStart, cross: otherCenter },
            { axis: isX ? 'x' : 'y', from: aEnd, to: bStart, cross: isX ? (a.cy + b.cy) / 2 : (a.cx + b.cx) / 2 }
          ]
        };
      }
    }
  }
  return null;
}

export function computeMoveGuides({
  rawX,
  rawY,
  draggedSizePct,
  otherTargets,
  magnetOn
}) {
  const halfW = (draggedSizePct?.w || 15) / 2;
  const halfH = (draggedSizePct?.h || 10) / 2;

  const matchX = findBestAxisMatch({
    rawCenter: rawX,
    halfSize: halfW,
    targets: otherTargets,
    isX: true
  });
  const matchY = findBestAxisMatch({
    rawCenter: rawY,
    halfSize: halfH,
    targets: otherTargets,
    isX: false
  });

  const finalX = magnetOn && matchX ? matchX.snappedCenter : rawX;
  const finalY = magnetOn && matchY ? matchY.snappedCenter : rawY;

  const spacingX = !matchX
    ? findEqualSpacing(rawX, halfW, finalY, halfH, otherTargets, true)
    : null;
  const spacingY = !matchY
    ? findEqualSpacing(rawY, halfH, finalX, halfW, otherTargets, false)
    : null;

  const outX = magnetOn && spacingX ? spacingX.snappedCenter : finalX;
  const outY = magnetOn && spacingY ? spacingY.snappedCenter : finalY;

  const vLines = matchX ? matchX.lines : [];
  const hLines = matchY ? matchY.lines : [];
  const spacing = [
    ...(spacingX ? spacingX.guides : []),
    ...(spacingY ? spacingY.guides : [])
  ];

  const snapKey = [
    vLines.map((l) => `${l.kind}:${l.pos.toFixed(1)}`).join(','),
    hLines.map((l) => `${l.kind}:${l.pos.toFixed(1)}`).join(','),
    spacing.length ? `sp:${spacing.length}` : ''
  ]
    .filter(Boolean)
    .join('|');

  return {
    x: Number(Math.max(2, Math.min(98, outX)).toFixed(2)),
    y: Number(Math.max(2, Math.min(98, outY)).toFixed(2)),
    vLines,
    hLines,
    spacing,
    snapped: Boolean(magnetOn && (matchX || matchY || spacingX || spacingY)),
    snapKey
  };
}

export function computeRotateSnap(rawAngle, magnetOn) {
  let nearKey = null;
  for (const k of KEY_ANGLES) {
    if (Math.abs(rawAngle - k) <= ROT_THRESH) {
      nearKey = k;
      break;
    }
  }

  const finalAngle = magnetOn && nearKey !== null ? nearKey : Math.round(rawAngle);
  return {
    angle: finalAngle === -180 ? 180 : finalAngle,
    nearKey,
    snapped: Boolean(magnetOn && nearKey !== null)
  };
}
