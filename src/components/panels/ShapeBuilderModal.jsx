import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Check, BookmarkPlus, Undo2, Redo2, Trash2,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Grid, Sparkles, PenTool, Sliders, FlipHorizontal,
  Maximize2, Minimize2, ZoomIn, ZoomOut, Move,
  MousePointer, Plus, ImagePlus, Eye, EyeOff, RotateCcw, Layers
} from 'lucide-react';
import { parseGradientCss } from '../../utils/colorPalette';
import ColorPickerStrip from './ColorPickerStrip';

const PRESET_SHAPES = [
  { id: 'rect', label: 'আয়ত/বর্গ' },
  { id: 'circle', label: 'বৃত্ত' },
  { id: 'triangle', label: 'ত্রিভুজ' },
  { id: 'polygon', label: 'বহুভুজ' },
  { id: 'star', label: 'তারা' },
  { id: 'flower', label: 'ফুল' },
  { id: 'badge', label: 'ব্যাজ' },
  { id: 'heart', label: 'হার্ট' },
  { id: 'arrow', label: 'তীর' },
  { id: 'bubble', label: 'বাবল' },
  { id: 'ticket', label: 'টিকিট' },
  { id: 'wave', label: 'ওয়েভ' }
];

const FILL_MODES = [
  { id: 'solid', label: 'সলিড' },
  { id: 'glass', label: 'গ্লাস' },
  { id: 'outline', label: 'বর্ডার' },
  { id: 'dashed', label: 'ড্যাশড' }
];

function f(n) {
  return Number(n.toFixed(2));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ==================== PARAMETRIC SHAPE HELPERS ====================
function roundedPolyPath(pts, radius = 0) {
  if (pts.length < 3) return '';
  if (radius <= 0.5) {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ') + ' Z';
  }
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const v1x = prev.x - curr.x, v1y = prev.y - curr.y;
    const v2x = next.x - curr.x, v2y = next.y - curr.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const r = Math.min(radius, l1 * 0.42, l2 * 0.42);
    const p1x = curr.x + (v1x / l1) * r;
    const p1y = curr.y + (v1y / l1) * r;
    const p2x = curr.x + (v2x / l2) * r;
    const p2y = curr.y + (v2y / l2) * r;
    d += i === 0 ? `M ${f(p1x)} ${f(p1y)} ` : `L ${f(p1x)} ${f(p1y)} `;
    d += `Q ${f(curr.x)} ${f(curr.y)} ${f(p2x)} ${f(p2y)} `;
  }
  return d + 'Z';
}

function buildPolyPts(sides, radius = 42, rotDeg = -90) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const ang = ((rotDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push({ x: 50 + Math.cos(ang) * radius, y: 50 + Math.sin(ang) * radius });
  }
  return pts;
}

function buildStarPts(points, outerR = 42, innerPct = 46) {
  const innerR = outerR * (innerPct / 100);
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = ((-90 + (180 / points) * i) * Math.PI) / 180;
    pts.push({ x: 50 + Math.cos(ang) * r, y: 50 + Math.sin(ang) * r });
  }
  return pts;
}

function buildFlowerPath(petals, outerR = 42, innerPct = 42) {
  const innerR = Math.max(8, outerR * (innerPct / 100));
  let d = '';
  for (let i = 0; i < petals; i++) {
    const a1 = ((-90 + (360 / petals) * i) * Math.PI) / 180;
    const aMid = ((-90 + (360 / petals) * (i + 0.5)) * Math.PI) / 180;
    const a2 = ((-90 + (360 / petals) * (i + 1)) * Math.PI) / 180;
    const sx = 50 + Math.cos(a1) * innerR;
    const sy = 50 + Math.sin(a1) * innerR;
    const cx = 50 + Math.cos(aMid) * (outerR * 1.25);
    const cy = 50 + Math.sin(aMid) * (outerR * 1.25);
    const ex = 50 + Math.cos(a2) * innerR;
    const ey = 50 + Math.sin(a2) * innerR;
    if (i === 0) d += `M ${f(sx)} ${f(sy)} `;
    d += `Q ${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)} `;
  }
  return d + 'Z';
}

function buildBadgePath(teeth, outerR = 42, innerPct = 82) {
  const innerR = outerR * (innerPct / 100);
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a1 = ((360 / teeth) * i * Math.PI) / 180;
    const aMid = ((360 / teeth) * (i + 0.5) * Math.PI) / 180;
    const a2 = ((360 / teeth) * (i + 1) * Math.PI) / 180;
    const sx = 50 + Math.cos(a1) * innerR;
    const sy = 50 + Math.sin(a1) * innerR;
    const cx = 50 + Math.cos(aMid) * (outerR * 1.08);
    const cy = 50 + Math.sin(aMid) * (outerR * 1.08);
    const ex = 50 + Math.cos(a2) * innerR;
    const ey = 50 + Math.sin(a2) * innerR;
    if (i === 0) d += `M ${f(sx)} ${f(sy)} `;
    d += `Q ${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)} `;
  }
  return d + 'Z';
}

function buildHeartPath(scale = 1) {
  const s = (x, y) => `${f(50 + (x - 50) * scale)} ${f(50 + (y - 50) * scale)}`;
  return `M ${s(50, 86)} C ${s(18, 62)} ${s(6, 40)} ${s(18, 22)} C ${s(29, 8)} ${s(44, 15)} ${s(50, 29)} C ${s(56, 15)} ${s(71, 8)} ${s(82, 22)} C ${s(94, 40)} ${s(82, 62)} ${s(50, 86)} Z`;
}

function buildTicketPath(cut = 12, pad = 8) {
  const l = pad, r = 100 - pad, t = pad + 8, b = 100 - pad - 8;
  const c = Math.min(cut, (b - t) * 0.42);
  return `M ${l + c} ${t} L ${r - c} ${t} L ${r} ${t + c} L ${r} ${b - c} L ${r - c} ${b} L ${l + c} ${b} L ${l} ${b - c} L ${l} ${t + c} Z`;
}

function buildBubblePath(radius = 12, tailX = 32) {
  const l = 8, r = 92, t = 12, b = 72;
  const rad = Math.min(radius, 24);
  const tx = Math.max(20, Math.min(80, tailX));
  return [
    `M ${l + rad} ${t}`,
    `L ${r - rad} ${t}`,
    `Q ${r} ${t} ${r} ${t + rad}`,
    `L ${r} ${b - rad}`,
    `Q ${r} ${b} ${r - rad} ${b}`,
    `L ${tx + 8} ${b}`,
    `L ${tx - 4} 90`,
    `L ${tx - 4} ${b}`,
    `L ${l + rad} ${b}`,
    `Q ${l} ${b} ${l} ${b - rad}`,
    `L ${l} ${t + rad}`,
    `Q ${l} ${t} ${l + rad} ${t} Z`
  ].join(' ');
}

function buildArrowPath(shaftPct = 36, headPct = 42) {
  const halfShaft = (shaftPct / 100) * 32;
  const headX = 92 - headPct * 0.9;
  const topY = 50 - halfShaft;
  const botY = 50 + halfShaft;
  return `M 8 ${f(topY)} L ${f(headX)} ${f(topY)} L ${f(headX)} 14 L 92 50 L ${f(headX)} 86 L ${f(headX)} ${f(botY)} L 8 ${f(botY)} Z`;
}

function buildWavePath(waves = 3, amp = 14, zigzag = false) {
  const l = 6, r = 94;
  const step = (r - l) / (waves * 2);
  let top = `M ${l} 45 `;
  let bot = '';
  for (let i = 0; i < waves * 2; i++) {
    const x1 = l + i * step;
    const x2 = x1 + step;
    const xm = (x1 + x2) / 2;
    const dir = i % 2 === 0 ? -1 : 1;
    const yPeak = 45 + dir * amp;
    if (zigzag) {
      top += `L ${f(xm)} ${f(yPeak)} L ${f(x2)} 45 `;
    } else {
      top += `Q ${f(xm)} ${f(yPeak)} ${f(x2)} 45 `;
    }
  }
  const thick = 10;
  bot = `L ${r} ${45 + thick} `;
  for (let i = waves * 2 - 1; i >= 0; i--) {
    const x1 = l + i * step;
    const x2 = x1 + step;
    const xm = (x1 + x2) / 2;
    const dir = i % 2 === 0 ? -1 : 1;
    const yPeak = 45 + thick + dir * amp;
    if (zigzag) {
      bot += `L ${f(xm)} ${f(yPeak)} L ${f(x1)} ${45 + thick} `;
    } else {
      bot += `Q ${f(xm)} ${f(yPeak)} ${f(x1)} ${45 + thick} `;
    }
  }
  return top + bot + 'Z';
}

function generateParametricPath(cfg) {
  const { shape, corner, sides, depth, hollow, thickness, tailX, zigzag } = cfg;
  const sc = hollow ? Math.max(0.18, 1 - thickness / 42) : 1;

  const makeSingle = (scale = 1) => {
    const r = 42 * scale;
    const pad = 50 - 42 * scale;
    if (shape === 'circle') {
      return `M 50 ${f(50 - r)} A ${f(r)} ${f(r)} 0 1 0 50 ${f(50 + r)} A ${f(r)} ${f(r)} 0 1 0 50 ${f(50 - r)} Z`;
    }
    if (shape === 'rect') {
      const box = [
        { x: pad, y: pad },
        { x: 100 - pad, y: pad },
        { x: 100 - pad, y: 100 - pad },
        { x: pad, y: 100 - pad }
      ];
      return roundedPolyPath(box, corner * scale);
    }
    if (shape === 'triangle') {
      return roundedPolyPath(buildPolyPts(3, r, -90), corner * scale * 0.7);
    }
    if (shape === 'polygon') {
      return roundedPolyPath(buildPolyPts(sides, r, -90), corner * scale * 0.6);
    }
    if (shape === 'star') {
      return roundedPolyPath(buildStarPts(sides, r, depth), Math.min(8, corner * 0.25) * scale);
    }
    if (shape === 'flower') {
      return buildFlowerPath(sides, r, depth);
    }
    if (shape === 'badge') {
      return buildBadgePath(sides, r, Math.max(60, Math.min(92, depth + 35)));
    }
    if (shape === 'heart') {
      return buildHeartPath(scale);
    }
    if (shape === 'ticket') {
      return buildTicketPath(corner * 0.55 * scale, pad);
    }
    if (shape === 'bubble') {
      return buildBubblePath(corner, tailX);
    }
    if (shape === 'arrow') {
      return buildArrowPath(depth, corner + 25);
    }
    if (shape === 'wave') {
      return buildWavePath(Math.max(1, Math.min(8, sides)), Math.max(4, Math.min(26, depth * 0.3)), zigzag);
    }
    return '';
  };

  const outerD = makeSingle(1);
  if (hollow && !['arrow', 'bubble', 'wave'].includes(shape)) {
    return { d: `${outerD} ${makeSingle(sc)}`, fillRule: 'evenodd' };
  }
  return { d: outerD, fillRule: 'nonzero' };
}

// ==================== PEN & BEZIER ENGINE ====================
function makeNode(x, y, inX = 0, inY = 0, outX = 0, outY = 0, mode = 'corner') {
  return { x, y, inX, inY, outX, outY, mode };
}

function isZeroHandle(dx, dy) {
  return Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15;
}

function segToBezierCmd(p1, p2) {
  const straight = isZeroHandle(p1.outX, p1.outY) && isZeroHandle(p2.inX, p2.inY);
  if (straight) {
    return `L ${f(p2.x)} ${f(p2.y)}`;
  }
  const c1x = p1.x + p1.outX;
  const c1y = p1.y + p1.outY;
  const c2x = p2.x + p2.inX;
  const c2y = p2.y + p2.inY;
  return `C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`;
}

function nodesToPath(nodes, closed = true) {
  if (!nodes || nodes.length < 2) return '';
  let d = `M ${f(nodes[0].x)} ${f(nodes[0].y)}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    d += ' ' + segToBezierCmd(nodes[i], nodes[i + 1]);
  }
  if (closed && nodes.length >= 2) {
    d += ' ' + segToBezierCmd(nodes[nodes.length - 1], nodes[0]) + ' Z';
  }
  return d;
}

function evalCubicMidpoint(p1, p2) {
  const x0 = p1.x, y0 = p1.y;
  const x1 = p1.x + p1.outX, y1 = p1.y + p1.outY;
  const x2 = p2.x + p2.inX, y2 = p2.y + p2.inY;
  const x3 = p2.x, y3 = p2.y;
  return {
    x: 0.125 * x0 + 0.375 * x1 + 0.375 * x2 + 0.125 * x3,
    y: 0.125 * y0 + 0.375 * y1 + 0.375 * y2 + 0.125 * y3
  };
}

function splitBezierSegment(p1, p2) {
  const P0 = { x: p1.x, y: p1.y };
  const P1 = { x: p1.x + p1.outX, y: p1.y + p1.outY };
  const P2 = { x: p2.x + p2.inX, y: p2.y + p2.inY };
  const P3 = { x: p2.x, y: p2.y };

  const Q0 = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
  const Q1 = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
  const Q2 = { x: (P2.x + P3.x) / 2, y: (P2.y + P3.y) / 2 };
  const R0 = { x: (Q0.x + Q1.x) / 2, y: (Q0.y + Q1.y) / 2 };
  const R1 = { x: (Q1.x + Q2.x) / 2, y: (Q1.y + Q2.y) / 2 };
  const S = { x: (R0.x + R1.x) / 2, y: (R0.y + R1.y) / 2 };

  const wasStraight = isZeroHandle(p1.outX, p1.outY) && isZeroHandle(p2.inX, p2.inY);
  if (wasStraight) {
    return {
      left: { ...p1, outX: 0, outY: 0 },
      mid: makeNode(S.x, S.y, 0, 0, 0, 0, 'corner'),
      right: { ...p2, inX: 0, inY: 0 }
    };
  }
  return {
    left: { ...p1, outX: Q0.x - P0.x, outY: Q0.y - P0.y },
    mid: makeNode(S.x, S.y, R0.x - S.x, R0.y - S.y, R1.x - S.x, R1.y - S.y, 'smooth'),
    right: { ...p2, inX: Q2.x - P3.x, inY: Q2.y - P3.y }
  };
}

function mirrorNode(n) {
  return {
    x: 100 - n.x,
    y: n.y,
    inX: -n.inX,
    inY: n.inY,
    outX: -n.outX,
    outY: n.outY,
    mode: n.mode
  };
}

function mirrorReverseNode(n) {
  return {
    x: 100 - n.x,
    y: n.y,
    inX: -n.outX,
    inY: n.outY,
    outX: -n.inX,
    outY: n.inY,
    mode: n.mode
  };
}

function rotateNode(n, cos, sin) {
  const rx = n.x - 50;
  const ry = n.y - 50;
  return {
    x: 50 + rx * cos - ry * sin,
    y: 50 + rx * sin + ry * cos,
    inX: n.inX * cos - n.inY * sin,
    inY: n.inX * sin + n.inY * cos,
    outX: n.outX * cos - n.outY * sin,
    outY: n.outX * sin + n.outY * cos,
    mode: n.mode
  };
}

function buildMultiPathVector(paths, symmetry = 'none') {
  const out = [];
  for (const p of paths) {
    if (!p.nodes || p.nodes.length < 2) continue;

    if (symmetry === 'none') {
      out.push(nodesToPath(p.nodes, p.closed));
      continue;
    }

    if (symmetry === 'mirror') {
      const first = p.nodes[0];
      const last = p.nodes[p.nodes.length - 1];
      const nearCenter = Math.abs(first.x - 50) <= 6 && Math.abs(last.x - 50) <= 6;
      if (p.closed && nearCenter) {
        const rev = [...p.nodes].reverse().map(mirrorReverseNode);
        out.push(nodesToPath([...p.nodes, ...rev], true));
      } else {
        out.push(nodesToPath(p.nodes, p.closed));
        out.push(nodesToPath(p.nodes.map(mirrorNode), p.closed));
      }
      continue;
    }

    if (symmetry.startsWith('mandala')) {
      const count = Number(symmetry.replace('mandala', '')) || 6;
      for (let k = 0; k < count; k++) {
        const rad = ((360 / count) * k * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        out.push(nodesToPath(p.nodes.map((n) => rotateNode(n, cos, sin)), p.closed));
      }
    }
  }
  return out.filter(Boolean).join(' ');
}

function simplifyRawPts(pts, eps = 2.6) {
  if (pts.length <= 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= eps) {
      out.push(pts[i]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function rawPtsToBezierNodes(pts, closed = true) {
  if (pts.length < 2) return [];
  const n = pts.length;
  return pts.map((curr, i) => {
    const prev = i === 0 ? (closed ? pts[n - 1] : pts[0]) : pts[i - 1];
    const next = i === n - 1 ? (closed ? pts[0] : pts[n - 1]) : pts[i + 1];
    const tx = (next.x - prev.x) / 6;
    const ty = (next.y - prev.y) / 6;
    return makeNode(
      curr.x,
      curr.y,
      i === 0 && !closed ? 0 : -tx,
      i === 0 && !closed ? 0 : -ty,
      i === n - 1 && !closed ? 0 : tx,
      i === n - 1 && !closed ? 0 : ty,
      'smooth'
    );
  });
}

function makeNodeSmooth(nodes, idx, closed) {
  const n = nodes.length;
  const curr = nodes[idx];
  const prev = idx > 0 ? nodes[idx - 1] : (closed ? nodes[n - 1] : null);
  const next = idx < n - 1 ? nodes[idx + 1] : (closed ? nodes[0] : null);

  let dx = 0, dy = 0;
  let d1 = 0, d2 = 0;
  if (prev && next) {
    dx = next.x - prev.x;
    dy = next.y - prev.y;
    d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
  } else if (next) {
    dx = next.x - curr.x;
    dy = next.y - curr.y;
    d2 = Math.hypot(dx, dy);
    d1 = d2;
  } else if (prev) {
    dx = curr.x - prev.x;
    dy = curr.y - prev.y;
    d1 = Math.hypot(dx, dy);
    d2 = d1;
  }
  const len = Math.hypot(dx, dy) || 1;
  const h1 = Math.min(18, d1 * 0.32);
  const h2 = Math.min(18, d2 * 0.32);
  return {
    ...curr,
    inX: -(dx / len) * h1,
    inY: -(dy / len) * h1,
    outX: (dx / len) * h2,
    outY: (dy / len) * h2,
    mode: 'smooth'
  };
}

const DEFAULT_DRAW_PATHS = [
  {
    id: 'p1',
    closed: true,
    nodes: [
      makeNode(50, 14, -12, 0, 12, 0, 'smooth'),
      makeNode(82, 42, 0, -14, 0, 14, 'smooth'),
      makeNode(50, 86, 16, -6, -16, -6, 'corner'),
      makeNode(18, 42, 0, 14, 0, -14, 'smooth')
    ]
  }
];

// ==================== MAIN COMPONENT ====================
export default function ShapeBuilderModal({ onClose, onAddToCanvas, onSaveAndAdd }) {
  const [tab, setTab] = useState('parametric');
  const [fillMode, setFillMode] = useState('solid');
  const [color, setColor] = useState('#fda4af');
  const [shapeName, setShapeName] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [cfg, setCfg] = useState({
    shape: 'star',
    corner: 8,
    sides: 5,
    depth: 45,
    hollow: false,
    thickness: 10,
    tailX: 32,
    zigzag: false
  });

  // Draw / Pen state
  const [paths, setPaths] = useState(DEFAULT_DRAW_PATHS);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [activePathId, setActivePathId] = useState('p1');
  const [activeNodeIdx, setActiveNodeIdx] = useState(null);
  const [drawTool, setDrawTool] = useState('pen'); // 'pen' | 'edit' | 'sketch' | 'pan'
  const [symmetry, setSymmetry] = useState('none');
  const [fillRuleMode, setFillRuleMode] = useState('evenodd'); // 'evenodd' | 'nonzero'
  const [gridSnap, setGridSnap] = useState(false);

  // Zoom & Pan (SVG viewBox)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, size: 100 });
  const zoom = 100 / viewBox.size;

  // Trace Reference Image
  const [traceImg, setTraceImg] = useState(null);
  const [traceOpacity, setTraceOpacity] = useState(0.45);
  const [showTrace, setShowTrace] = useState(true);
  const traceInputRef = useRef(null);

  // Live Freehand Sketch Preview
  const [sketchLivePts, setSketchLivePts] = useState(null);

  // Pointer & Gesture Refs
  const svgRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const actionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (traceImg && traceImg.startsWith('blob:')) {
        URL.revokeObjectURL(traceImg);
      }
    };
  }, [traceImg]);

  const activePathIndex = Math.max(
    0,
    paths.findIndex((p) => p.id === activePathId)
  );
  const activePath = paths[activePathIndex] || paths[0] || null;
  const activeNode =
    activePath && activeNodeIdx !== null ? activePath.nodes[activeNodeIdx] || null : null;

  const commitPaths = (nextPaths, pushHistory = true) => {
    if (pushHistory) {
      setHistory((h) => ({
        past: [...h.past.slice(-35), paths],
        future: []
      }));
    }
    setPaths(nextPaths);
  };

  const handleUndo = () => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      setPaths(prev);
      if (prev.length > 0 && !prev.some((p) => p.id === activePathId)) {
        setActivePathId(prev[0].id);
      }
      setActiveNodeIdx(null);
      return { past: h.past.slice(0, -1), future: [paths, ...h.future.slice(0, 35)] };
    });
  };

  const handleRedo = () => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      setPaths(next);
      if (next.length > 0 && !next.some((p) => p.id === activePathId)) {
        setActivePathId(next[0].id);
      }
      setActiveNodeIdx(null);
      return { past: [...h.past, paths], future: h.future.slice(1) };
    });
  };

  const clampViewBox = (vb) => {
    const size = clamp(vb.size, 12.5, 100);
    const minCoord = size >= 99.5 ? 0 : -35;
    const maxCoord = size >= 99.5 ? 0 : 135 - size;
    return {
      x: clamp(vb.x, minCoord, maxCoord),
      y: clamp(vb.y, minCoord, maxCoord),
      size
    };
  };

  const zoomBy = (factor) => {
    setViewBox((vb) => {
      const cx = vb.x + vb.size / 2;
      const cy = vb.y + vb.size / 2;
      const newSize = clamp(vb.size / factor, 12.5, 100);
      const scale = vb.size / newSize;
      return clampViewBox({
        x: cx - (cx - vb.x) / scale,
        y: cy - (cy - vb.y) / scale,
        size: newSize
      });
    });
  };

  const resetView = () => setViewBox({ x: 0, y: 0, size: 100 });

  const clientToSvg = (clientX, clientY) => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 50, y: 50 };
    if (svgEl.getScreenCTM) {
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        const pt = svgEl.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const res = pt.matrixTransform(ctm.inverse());
        return { x: res.x, y: res.y };
      }
    }
    const rect = svgEl.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height) || 1;
    const ox = rect.left + (rect.width - minDim) / 2;
    const oy = rect.top + (rect.height - minDim) / 2;
    return {
      x: viewBox.x + ((clientX - ox) / minDim) * viewBox.size,
      y: viewBox.y + ((clientY - oy) / minDim) * viewBox.size
    };
  };

  const snapCoord = (rawX, rawY) => {
    let x = clamp(rawX, 1, 99);
    let y = clamp(rawY, 1, 99);
    if (gridSnap) {
      const step = zoom >= 4 ? 1 : zoom >= 2 ? 2.5 : 5;
      x = Math.round(x / step) * step;
      y = Math.round(y / step) * step;
    } else if (symmetry === 'mirror' && Math.abs(x - 50) < 1.8 / zoom) {
      x = 50;
    }
    return { x, y };
  };

  // Pointer Events for Canvas
  const handleSvgPointerDown = (e) => {
    if (tab !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Switch to 2-finger pinch & pan
    if (pointersRef.current.size === 2) {
      // Revert single-finger stroke/action if it just began
      if (actionRef.current?.snapshotPaths) {
        setPaths(actionRef.current.snapshotPaths);
      }
      setSketchLivePts(null);
      actionRef.current = null;

      const pts = Array.from(pointersRef.current.values());
      const dist0 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const mid0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchRef.current = {
        vb0: { ...viewBox },
        dist0,
        mid0,
        svgMid0: clientToSvg(mid0.x, mid0.y)
      };
      return;
    }

    if (pointersRef.current.size > 2) return;

    const raw = clientToSvg(e.clientX, e.clientY);

    if (drawTool === 'pan') {
      actionRef.current = {
        type: 'pan',
        startClient: { x: e.clientX, y: e.clientY },
        vb0: { ...viewBox }
      };
      return;
    }

    if (drawTool === 'sketch') {
      const p = { x: clamp(raw.x, 1, 99), y: clamp(raw.y, 1, 99) };
      setSketchLivePts([p]);
      actionRef.current = { type: 'sketch', pts: [p] };
      return;
    }

    const hitR = Math.max(1.2, 8.5 / zoom);

    // Check handles of active node first (in pen or edit mode)
    if (activePath && activeNode) {
      const inDist = Math.hypot(
        activeNode.x + activeNode.inX - raw.x,
        activeNode.y + activeNode.inY - raw.y
      );
      if (!isZeroHandle(activeNode.inX, activeNode.inY) && inDist < hitR) {
        actionRef.current = {
          type: 'drag-handle',
          pathId: activePath.id,
          nodeIdx: activeNodeIdx,
          which: 'in',
          snapshotPaths: paths,
          moved: false
        };
        return;
      }
      const outDist = Math.hypot(
        activeNode.x + activeNode.outX - raw.x,
        activeNode.y + activeNode.outY - raw.y
      );
      if (!isZeroHandle(activeNode.outX, activeNode.outY) && outDist < hitR) {
        actionRef.current = {
          type: 'drag-handle',
          pathId: activePath.id,
          nodeIdx: activeNodeIdx,
          which: 'out',
          snapshotPaths: paths,
          moved: false
        };
        return;
      }
    }

    // Check segment '+' midpoints in Edit mode
    if (drawTool === 'edit' && activePath && activePath.nodes.length >= 2) {
      const segCount = activePath.closed ? activePath.nodes.length : activePath.nodes.length - 1;
      for (let i = 0; i < segCount; i++) {
        const p1 = activePath.nodes[i];
        const p2 = activePath.nodes[(i + 1) % activePath.nodes.length];
        const mid = evalCubicMidpoint(p1, p2);
        if (Math.hypot(mid.x - raw.x, mid.y - raw.y) < hitR * 0.9) {
          const split = splitBezierSegment(p1, p2);
          const nextNodes = [...activePath.nodes];
          nextNodes[i] = split.left;
          const nextIdx = (i + 1) % activePath.nodes.length;
          if (i === activePath.nodes.length - 1 && activePath.closed) {
            nextNodes[0] = split.right;
            nextNodes.push(split.mid);
            const newIdx = nextNodes.length - 1;
            const nextPaths = paths.map((p) =>
              p.id === activePath.id ? { ...p, nodes: nextNodes } : p
            );
            commitPaths(nextPaths);
            setActiveNodeIdx(newIdx);
            actionRef.current = {
              type: 'drag-node',
              pathId: activePath.id,
              nodeIdx: newIdx,
              snapshotPaths: nextPaths,
              moved: false
            };
          } else {
            nextNodes[nextIdx] = split.right;
            nextNodes.splice(i + 1, 0, split.mid);
            const nextPaths = paths.map((p) =>
              p.id === activePath.id ? { ...p, nodes: nextNodes } : p
            );
            commitPaths(nextPaths);
            setActiveNodeIdx(i + 1);
            actionRef.current = {
              type: 'drag-node',
              pathId: activePath.id,
              nodeIdx: i + 1,
              snapshotPaths: nextPaths,
              moved: false
            };
          }
          return;
        }
      }
    }

    // Check existing nodes (active path first, then all paths)
    const searchOrder = activePath
      ? [activePath, ...paths.filter((p) => p.id !== activePath.id)]
      : paths;

    for (const p of searchOrder) {
      for (let idx = 0; idx < p.nodes.length; idx++) {
        const nd = p.nodes[idx];
        if (Math.hypot(nd.x - raw.x, nd.y - raw.y) < hitR) {
          // Pen mode: tapping first node of open path closes it!
          if (
            drawTool === 'pen' &&
            p.id === activePath?.id &&
            !p.closed &&
            idx === 0 &&
            p.nodes.length >= 3
          ) {
            const nextPaths = paths.map((item) =>
              item.id === p.id ? { ...item, closed: true } : item
            );
            commitPaths(nextPaths);
            setActiveNodeIdx(0);
            actionRef.current = null;
            return;
          }

          setActivePathId(p.id);
          setActiveNodeIdx(idx);
          actionRef.current = {
            type: 'drag-node',
            pathId: p.id,
            nodeIdx: idx,
            snapshotPaths: paths,
            moved: false
          };
          return;
        }
      }
    }

    // In Edit mode, tapping empty space deselects node
    if (drawTool === 'edit') {
      setActiveNodeIdx(null);
      return;
    }

    // Pen mode: Add new node (drag to curve!)
    if (drawTool === 'pen') {
      const snapped = snapCoord(raw.x, raw.y);
      const newNd = makeNode(snapped.x, snapped.y, 0, 0, 0, 0, 'corner');
      let targetId = activePath?.id;
      let nextPaths;
      let newIdx;

      if (!activePath || paths.length === 0) {
        const id = uid();
        targetId = id;
        nextPaths = [{ id, closed: false, nodes: [newNd] }];
        newIdx = 0;
      } else {
        newIdx = activePath.nodes.length;
        nextPaths = paths.map((p) =>
          p.id === activePath.id ? { ...p, nodes: [...p.nodes, newNd] } : p
        );
      }

      setActivePathId(targetId);
      setActiveNodeIdx(newIdx);
      setPaths(nextPaths);
      actionRef.current = {
        type: 'pen-curve',
        pathId: targetId,
        nodeIdx: newIdx,
        anchor: snapped,
        snapshotPaths: paths,
        moved: false
      };
    }
  };

  const handleSvgPointerMove = (e) => {
    if (tab !== 'draw') return;
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch-to-Zoom & 2-finger Pan
    if (pointersRef.current.size === 2 && pinchRef.current && svgRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const { vb0, dist0, mid0, svgMid0 } = pinchRef.current;

      const rect = svgRef.current.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height) || 1;
      const scale = dist / dist0;
      const newSize = clamp(vb0.size / scale, 12.5, 100);
      const actualScale = vb0.size / newSize;

      const xAfterScale = svgMid0.x - (svgMid0.x - vb0.x) / actualScale;
      const yAfterScale = svgMid0.y - (svgMid0.y - vb0.y) / actualScale;

      const nx = xAfterScale - ((mid.x - mid0.x) / minDim) * newSize;
      const ny = yAfterScale - ((mid.y - mid0.y) / minDim) * newSize;
      setViewBox(clampViewBox({ x: nx, y: ny, size: newSize }));
      return;
    }

    const act = actionRef.current;
    if (!act) return;

    if (act.type === 'pan' && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height) || 1;
      const dx = ((e.clientX - act.startClient.x) / minDim) * act.vb0.size;
      const dy = ((e.clientY - act.startClient.y) / minDim) * act.vb0.size;
      setViewBox(clampViewBox({ x: act.vb0.x - dx, y: act.vb0.y - dy, size: act.vb0.size }));
      return;
    }

    const raw = clientToSvg(e.clientX, e.clientY);

    if (act.type === 'sketch') {
      const p = { x: clamp(raw.x, 1, 99), y: clamp(raw.y, 1, 99) };
      const last = act.pts[act.pts.length - 1];
      const minDist = Math.max(0.8, 2.5 / zoom);
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) {
        act.pts.push(p);
        setSketchLivePts([...act.pts]);
      }
      return;
    }

    if (act.type === 'pen-curve') {
      const dx = raw.x - act.anchor.x;
      const dy = raw.y - act.anchor.y;
      if (Math.hypot(dx, dy) > 1.5 / zoom) {
        act.moved = true;
        setPaths((prev) =>
          prev.map((p) =>
            p.id !== act.pathId
              ? p
              : {
                  ...p,
                  nodes: p.nodes.map((nd, idx) =>
                    idx === act.nodeIdx
                      ? { ...nd, inX: -dx, inY: -dy, outX: dx, outY: dy, mode: 'smooth' }
                      : nd
                  )
                }
          )
        );
      }
      return;
    }

    if (act.type === 'drag-node') {
      act.moved = true;
      const snapped = snapCoord(raw.x, raw.y);
      setPaths((prev) =>
        prev.map((p) =>
          p.id !== act.pathId
            ? p
            : {
                ...p,
                nodes: p.nodes.map((nd, idx) =>
                  idx === act.nodeIdx ? { ...nd, x: snapped.x, y: snapped.y } : nd
                )
              }
        )
      );
      return;
    }

    if (act.type === 'drag-handle') {
      act.moved = true;
      setPaths((prev) =>
        prev.map((p) =>
          p.id !== act.pathId
            ? p
            : {
                ...p,
                nodes: p.nodes.map((nd, idx) => {
                  if (idx !== act.nodeIdx) return nd;
                  const hx = raw.x - nd.x;
                  const hy = raw.y - nd.y;
                  if (act.which === 'out') {
                    if (nd.mode === 'smooth') {
                      const oppLen = Math.hypot(nd.inX, nd.inY);
                      const curLen = Math.hypot(hx, hy) || 1;
                      const len = oppLen > 0.5 ? oppLen : curLen;
                      return {
                        ...nd,
                        outX: hx,
                        outY: hy,
                        inX: -(hx / curLen) * len,
                        inY: -(hy / curLen) * len
                      };
                    }
                    return { ...nd, outX: hx, outY: hy };
                  } else {
                    if (nd.mode === 'smooth') {
                      const oppLen = Math.hypot(nd.outX, nd.outY);
                      const curLen = Math.hypot(hx, hy) || 1;
                      const len = oppLen > 0.5 ? oppLen : curLen;
                      return {
                        ...nd,
                        inX: hx,
                        inY: hy,
                        outX: -(hx / curLen) * len,
                        outY: -(hy / curLen) * len
                      };
                    }
                    return { ...nd, inX: hx, inY: hy };
                  }
                })
              }
        )
      );
    }
  };

  const handleSvgPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    const act = actionRef.current;
    actionRef.current = null;
    if (!act) return;

    if (act.type === 'sketch') {
      const rawPts = act.pts;
      setSketchLivePts(null);
      if (rawPts.length >= 2) {
        const simp = simplifyRawPts(rawPts, Math.max(1.2, 3.2 / zoom));
        const closedSketch =
          simp.length >= 3 &&
          Math.hypot(simp[0].x - simp[simp.length - 1].x, simp[0].y - simp[simp.length - 1].y) <
            10;
        const cleanPts = closedSketch ? simp.slice(0, -1) : simp;
        if (cleanPts.length >= 2) {
          const newNodes = rawPtsToBezierNodes(cleanPts, closedSketch);
          const id = uid();
          const newPath = { id, closed: closedSketch, nodes: newNodes };
          const replaceDefault =
            paths.length === 1 && paths[0].id === 'p1' && paths[0].nodes.length === 0;
          const nextPaths = replaceDefault ? [newPath] : [...paths, newPath];
          commitPaths(nextPaths);
          setActivePathId(id);
          setActiveNodeIdx(null);
        }
      }
      return;
    }

    if (
      (act.type === 'pen-curve' ||
        ((act.type === 'drag-node' || act.type === 'drag-handle') && act.moved)) &&
      act.snapshotPaths
    ) {
      setHistory((h) => ({
        past: [...h.past.slice(-35), act.snapshotPaths],
        future: []
      }));
    }
  };

  // Node & Path Operations
  const startNewSubPath = () => {
    const cleaned = paths.filter((p) => p.nodes.length > 0);
    const id = uid();
    const nextPaths = [...cleaned, { id, closed: false, nodes: [] }];
    commitPaths(nextPaths);
    setActivePathId(id);
    setActiveNodeIdx(null);
    setDrawTool('pen');
  };

  const toggleActivePathClosed = () => {
    if (!activePath) return;
    commitPaths(
      paths.map((p) => (p.id === activePath.id ? { ...p, closed: !p.closed } : p))
    );
  };

  const deleteActivePath = () => {
    if (!activePath) return;
    const remaining = paths.filter((p) => p.id !== activePath.id);
    if (remaining.length === 0) {
      const id = uid();
      commitPaths([{ id, closed: false, nodes: [] }]);
      setActivePathId(id);
    } else {
      commitPaths(remaining);
      setActivePathId(remaining[remaining.length - 1].id);
    }
    setActiveNodeIdx(null);
  };

  const clearAllPaths = () => {
    const id = uid();
    commitPaths([{ id, closed: false, nodes: [] }]);
    setActivePathId(id);
    setActiveNodeIdx(null);
    setDrawTool('pen');
  };

  const setActiveNodeType = (type) => {
    if (!activePath || activeNodeIdx === null || !activeNode) return;
    const nextPaths = paths.map((p) => {
      if (p.id !== activePath.id) return p;
      return {
        ...p,
        nodes: p.nodes.map((nd, idx) => {
          if (idx !== activeNodeIdx) return nd;
          if (type === 'sharp') {
            return { ...nd, inX: 0, inY: 0, outX: 0, outY: 0, mode: 'corner' };
          }
          if (type === 'free') {
            return { ...nd, mode: 'corner' };
          }
          return makeNodeSmooth(p.nodes, idx, p.closed);
        })
      };
    });
    commitPaths(nextPaths);
  };

  const nudgeActiveNode = (dx, dy) => {
    if (!activePath || activeNodeIdx === null) return;
    const step = zoom >= 3 ? 0.5 : 1;
    const nextPaths = paths.map((p) =>
      p.id !== activePath.id
        ? p
        : {
            ...p,
            nodes: p.nodes.map((nd, idx) =>
              idx === activeNodeIdx
                ? {
                    ...nd,
                    x: clamp(nd.x + dx * step, 1, 99),
                    y: clamp(nd.y + dy * step, 1, 99)
                  }
                : nd
            )
          }
    );
    commitPaths(nextPaths);
  };

  const deleteActiveNode = () => {
    if (!activePath || activeNodeIdx === null) return;
    const nextNodes = activePath.nodes.filter((_, i) => i !== activeNodeIdx);
    const nextPaths = paths.map((p) =>
      p.id === activePath.id ? { ...p, nodes: nextNodes } : p
    );
    commitPaths(nextPaths);
    setActiveNodeIdx(null);
  };

  const handleTraceUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (traceImg && traceImg.startsWith('blob:')) {
      URL.revokeObjectURL(traceImg);
    }
    const url = URL.createObjectURL(file);
    setTraceImg(url);
    setShowTrace(true);
    e.target.value = '';
  };

  const cycleSymmetry = () => {
    const order = ['none', 'mirror', 'mandala4', 'mandala6', 'mandala8'];
    setSymmetry(order[(order.indexOf(symmetry) + 1) % order.length]);
  };

  const symLabels = {
    none: 'সাধারণ',
    mirror: 'Mirror X',
    mandala4: 'ম্যান্ডালা 4×',
    mandala6: 'ম্যান্ডালা 6×',
    mandala8: 'ম্যান্ডালা 8×'
  };

  // Vector Output
  const vectorData = useMemo(() => {
    if (tab === 'parametric') {
      return generateParametricPath(cfg);
    }
    return {
      d: buildMultiPathVector(paths, symmetry),
      fillRule: fillRuleMode
    };
  }, [tab, cfg, paths, symmetry, fillRuleMode]);

  const hasAnyOpenOnly =
    tab === 'draw' && paths.every((p) => !p.closed || p.nodes.length < 3);

  const finalCustomShape = useMemo(() => {
    return {
      d: vectorData.d,
      fillRule: vectorData.fillRule,
      fillOpacity: hasAnyOpenOnly ? 0 : fillMode === 'solid' ? 1 : fillMode === 'glass' ? 0.22 : 0,
      hasBorder: hasAnyOpenOnly || fillMode !== 'solid',
      strokeDash: fillMode === 'dashed',
      defaultStrokeWidth:
        hasAnyOpenOnly || fillMode === 'outline' || fillMode === 'dashed' ? 3.2 : 2.5
    };
  }, [vectorData, fillMode, hasAnyOpenOnly]);

  const parsedGrad = useMemo(
    () =>
      typeof color === 'string' &&
      (color.includes('linear-gradient') || color.includes('radial-gradient'))
        ? parseGradientCss(color)
        : null,
    [color]
  );

  const svgFillColor = parsedGrad ? 'url(#sb_grad)' : color;

  let gx1 = '0%', gy1 = '0%', gx2 = '100%', gy2 = '100%';
  if (parsedGrad && parsedGrad.type !== 'radial') {
    const rad = (((parsedGrad.angle ?? 135) - 90) * Math.PI) / 180;
    const dx = Math.cos(rad) * 50;
    const dy = Math.sin(rad) * 50;
    gx1 = `${(50 - dx).toFixed(1)}%`;
    gy1 = `${(50 - dy).toFixed(1)}%`;
    gx2 = `${(50 + dx).toFixed(1)}%`;
    gy2 = `${(50 + dy).toFixed(1)}%`;
  }

  const handleDone = (saveToLib = false) => {
    if (!finalCustomShape.d) return alert('আগে একটি শেপ তৈরি করুন!');
    const label =
      shapeName.trim() ||
      (tab === 'parametric'
        ? PRESET_SHAPES.find((s) => s.id === cfg.shape)?.label || 'Custom Shape'
        : 'Vector Shape');
    if (saveToLib) {
      onSaveAndAdd({ customShape: finalCustomShape, color, label });
    } else {
      onAddToCanvas({ customShape: finalCustomShape, color, label });
    }
  };

  // Scale-invariant UI unit for crisp handles when zoomed
  const u = viewBox.size / 100;

  const renderDrawSvg = (sizeStyle) => (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.size} ${viewBox.size}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      onPointerCancel={handleSvgPointerUp}
      style={{
        ...sizeStyle,
        display: 'block',
        touchAction: 'none',
        userSelect: 'none',
        backgroundColor: '#060911'
      }}
    >
      {parsedGrad && (
        <defs>
          {parsedGrad.type === 'radial' ? (
            <radialGradient
              id="sb_grad"
              cx={`${parsedGrad.cx ?? 50}%`}
              cy={`${parsedGrad.cy ?? 50}%`}
              r="65%"
            >
              {parsedGrad.stops.map((st, idx) => (
                <stop key={idx} offset={`${clamp(st.pos, 0, 100)}%`} stopColor={st.color} />
              ))}
            </radialGradient>
          ) : (
            <linearGradient id="sb_grad" x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
              {parsedGrad.stops.map((st, idx) => (
                <stop key={idx} offset={`${clamp(st.pos, 0, 100)}%`} stopColor={st.color} />
              ))}
            </linearGradient>
          )}
        </defs>
      )}

      {/* Artboard 0..100 Backdrop & Grid */}
      <rect x="0" y="0" width="100" height="100" fill="#0b101d" />
      <defs>
        <pattern id="sb_grid10" width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.45 * u}
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#sb_grid10)" />
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="none"
        stroke="rgba(56,189,248,0.38)"
        strokeWidth={0.7 * u}
      />

      {/* Trace Reference Image */}
      {traceImg && showTrace && (
        <image
          href={traceImg}
          x="2"
          y="2"
          width="96"
          height="96"
          preserveAspectRatio="xMidYMid meet"
          opacity={traceOpacity}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Symmetry Mirror Line */}
      {symmetry === 'mirror' && (
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          stroke="rgba(244,63,94,0.55)"
          strokeWidth={0.6 * u}
          strokeDasharray={`${2 * u} ${2 * u}`}
        />
      )}

      {/* Final Combined Vector Path */}
      {finalCustomShape.d && (
        <path
          d={finalCustomShape.d}
          fill={finalCustomShape.fillOpacity <= 0 ? 'none' : svgFillColor}
          fillOpacity={finalCustomShape.fillOpacity}
          fillRule={finalCustomShape.fillRule}
          stroke={finalCustomShape.hasBorder ? svgFillColor : 'rgba(255,255,255,0.28)'}
          strokeWidth={
            finalCustomShape.hasBorder ? finalCustomShape.defaultStrokeWidth : 0.45 * u
          }
          strokeDasharray={finalCustomShape.strokeDash ? '6 4' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Live Freehand Stroke */}
      {sketchLivePts && sketchLivePts.length >= 2 && (
        <path
          d={sketchLivePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ')}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.3 * u}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Active Path Outline Highlight + Midpoint '+' Buttons */}
      {activePath && activePath.nodes.length >= 2 && (
        <>
          <path
            d={nodesToPath(activePath.nodes, activePath.closed)}
            fill="none"
            stroke="rgba(56,189,248,0.8)"
            strokeWidth={0.75 * u}
          />
          {drawTool === 'edit' &&
            activePath.nodes.map((p1, i) => {
              if (!activePath.closed && i === activePath.nodes.length - 1) return null;
              const p2 = activePath.nodes[(i + 1) % activePath.nodes.length];
              const mid = evalCubicMidpoint(p1, p2);
              return (
                <g key={`mid-${i}`} style={{ pointerEvents: 'none' }}>
                  <circle
                    cx={mid.x}
                    cy={mid.y}
                    r={1.9 * u}
                    fill="rgba(15,23,42,0.85)"
                    stroke="#38bdf8"
                    strokeWidth={0.6 * u}
                  />
                  <line
                    x1={mid.x - 0.9 * u}
                    y1={mid.y}
                    x2={mid.x + 0.9 * u}
                    y2={mid.y}
                    stroke="#38bdf8"
                    strokeWidth={0.55 * u}
                  />
                  <line
                    x1={mid.x}
                    y1={mid.y - 0.9 * u}
                    x2={mid.x}
                    y2={mid.y + 0.9 * u}
                    stroke="#38bdf8"
                    strokeWidth={0.55 * u}
                  />
                </g>
              );
            })}
        </>
      )}

      {/* Inactive Sub-paths Subtle Anchor Dots */}
      {paths.map((p) => {
        if (p.id === activePath?.id) return null;
        return p.nodes.map((nd, idx) => (
          <circle
            key={`${p.id}-${idx}`}
            cx={nd.x}
            cy={nd.y}
            r={1.6 * u}
            fill="rgba(226,232,240,0.55)"
            stroke="#0f172a"
            strokeWidth={0.5 * u}
          />
        ));
      })}

      {/* Active Path Bezier Handles & Anchor Nodes */}
      {activePath &&
        drawTool !== 'sketch' &&
        activePath.nodes.map((nd, idx) => {
          const isSel = idx === activeNodeIdx;
          const showHandles =
            isSel && (!isZeroHandle(nd.inX, nd.inY) || !isZeroHandle(nd.outX, nd.outY));
          return (
            <g key={`nd-${idx}`} style={{ pointerEvents: 'none' }}>
              {showHandles && (
                <>
                  {!isZeroHandle(nd.inX, nd.inY) && (
                    <>
                      <line
                        x1={nd.x}
                        y1={nd.y}
                        x2={nd.x + nd.inX}
                        y2={nd.y + nd.inY}
                        stroke="#fbbf24"
                        strokeWidth={0.65 * u}
                      />
                      <circle
                        cx={nd.x + nd.inX}
                        cy={nd.y + nd.inY}
                        r={2.1 * u}
                        fill="#fbbf24"
                        stroke="#0f172a"
                        strokeWidth={0.6 * u}
                      />
                    </>
                  )}
                  {!isZeroHandle(nd.outX, nd.outY) && (
                    <>
                      <line
                        x1={nd.x}
                        y1={nd.y}
                        x2={nd.x + nd.outX}
                        y2={nd.y + nd.outY}
                        stroke="#fbbf24"
                        strokeWidth={0.65 * u}
                      />
                      <circle
                        cx={nd.x + nd.outX}
                        cy={nd.y + nd.outY}
                        r={2.1 * u}
                        fill="#fbbf24"
                        stroke="#0f172a"
                        strokeWidth={0.6 * u}
                      />
                    </>
                  )}
                </>
              )}

              <circle
                cx={nd.x}
                cy={nd.y}
                r={(isSel ? 3.2 : idx === 0 && !activePath.closed ? 2.8 : 2.3) * u}
                fill={
                  isSel
                    ? '#38bdf8'
                    : idx === 0 && !activePath.closed
                    ? '#4ade80'
                    : '#ffffff'
                }
                stroke="#0f172a"
                strokeWidth={0.75 * u}
              />
            </g>
          );
        })}
    </svg>
  );

  // ==================== FULL-SCREEN STUDIO VIEW ====================
  if (isFullScreen && tab === 'draw') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 230,
          background: '#060911',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc'
        }}
      >
        <input
          ref={traceInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleTraceUpload}
        />

        {/* Top Studio Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.09)',
            background: '#0b101d',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              className="chip-btn"
              style={{ padding: '5px 8px', fontSize: 11 }}
              onClick={handleUndo}
              disabled={history.past.length === 0}
              title="Undo"
            >
              <Undo2 size={14} />
            </button>
            <button
              className="chip-btn"
              style={{ padding: '5px 8px', fontSize: 11 }}
              onClick={handleRedo}
              disabled={history.future.length === 0}
              title="Redo"
            >
              <Redo2 size={14} />
            </button>
            <button
              className="chip-btn"
              style={{ padding: '5px 8px', fontSize: 11 }}
              onClick={() => zoomBy(0.75)}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', minWidth: 34, textAlign: 'center' }}>
              {zoom.toFixed(1)}x
            </span>
            <button
              className="chip-btn"
              style={{ padding: '5px 8px', fontSize: 11 }}
              onClick={() => zoomBy(1.35)}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            {zoom > 1.05 && (
              <button
                className="chip-btn"
                style={{ padding: '5px 7px', fontSize: 10 }}
                onClick={resetView}
                title="Reset Zoom"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>

          <button
            className="btn-primary"
            style={{
              background: '#0284c7',
              padding: '5px 11px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={() => setIsFullScreen(false)}
          >
            <Minimize2 size={13} /> ঠিক আছে
          </button>
        </div>

        {/* Full-Screen Interactive Canvas */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {renderDrawSvg({ width: '100%', height: '100%' })}

          {activeNode && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                fontSize: 10,
                background: 'rgba(6,9,17,0.8)',
                border: '1px solid rgba(56,189,248,0.35)',
                padding: '3px 8px',
                borderRadius: 8,
                color: '#38bdf8',
                pointerEvents: 'none'
              }}
            >
              X:{Math.round(activeNode.x)} Y:{Math.round(activeNode.y)} •{' '}
              {activeNode.mode === 'smooth' ? 'স্মুথ' : 'কোণা'}
            </div>
          )}
        </div>

        {/* Selected Node Quick Bar */}
        {activeNode && drawTool !== 'sketch' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              padding: '6px 10px',
              background: '#0e1627',
              borderTop: '1px solid rgba(56,189,248,0.2)',
              overflowX: 'auto'
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`px-toggle-pill ${activeNode.mode === 'smooth' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10 }}
                onClick={() => setActiveNodeType('smooth')}
              >
                স্মুথ
              </button>
              <button
                className={`px-toggle-pill ${
                  activeNode.mode === 'corner' && isZeroHandle(activeNode.inX, activeNode.inY)
                    ? 'on'
                    : ''
                }`}
                style={{ padding: '4px 8px', fontSize: 10 }}
                onClick={() => setActiveNodeType('sharp')}
              >
                কোণা
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={() => setActiveNodeType('free')}
              >
                ফ্রি হ্যান্ডেল
              </button>
            </div>

            <div style={{ display: 'flex', gap: 3 }}>
              <button className="chip-btn" style={{ padding: '4px 6px' }} onClick={() => nudgeActiveNode(-1, 0)}>
                <ArrowLeft size={12} />
              </button>
              <button className="chip-btn" style={{ padding: '4px 6px' }} onClick={() => nudgeActiveNode(0, -1)}>
                <ArrowUp size={12} />
              </button>
              <button className="chip-btn" style={{ padding: '4px 6px' }} onClick={() => nudgeActiveNode(0, 1)}>
                <ArrowDown size={12} />
              </button>
              <button className="chip-btn" style={{ padding: '4px 6px' }} onClick={() => nudgeActiveNode(1, 0)}>
                <ArrowRight size={12} />
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', color: '#fda4af', fontSize: 10 }}
                onClick={deleteActiveNode}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Trace Photo Opacity Strip (when image loaded) */}
        {traceImg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              background: '#0b1220',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              fontSize: 10
            }}
          >
            <button
              className={`px-toggle-pill ${showTrace ? 'on' : ''}`}
              style={{ padding: '3px 7px', fontSize: 10 }}
              onClick={() => setShowTrace(!showTrace)}
            >
              {showTrace ? <Eye size={11} /> : <EyeOff size={11} />} ছবি
            </button>
            <input
              type="range"
              min="10"
              max="90"
              value={Math.round(traceOpacity * 100)}
              onChange={(e) => setTraceOpacity(Number(e.target.value) / 100)}
              style={{ flex: 1, accentColor: '#38bdf8' }}
            />
            <span style={{ minWidth: 30 }}>{Math.round(traceOpacity * 100)}%</span>
            <button
              className="chip-btn"
              style={{ padding: '3px 7px', color: '#fda4af' }}
              onClick={() => setTraceImg(null)}
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Bottom Studio Dock */}
        <div
          style={{
            padding: '8px 10px',
            background: '#0b101d',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div className="scroll-row" style={{ gap: 5 }}>
            <button
              className={`px-toggle-pill ${drawTool === 'pen' ? 'on' : ''}`}
              style={{ padding: '5px 9px', fontSize: 11 }}
              onClick={() => setDrawTool('pen')}
            >
              <PenTool size={12} /> পেন
            </button>
            <button
              className={`px-toggle-pill ${drawTool === 'edit' ? 'on' : ''}`}
              style={{ padding: '5px 9px', fontSize: 11 }}
              onClick={() => setDrawTool('edit')}
            >
              <MousePointer size={12} /> এডিট নোড
            </button>
            <button
              className={`px-toggle-pill ${drawTool === 'sketch' ? 'on' : ''}`}
              style={{ padding: '5px 9px', fontSize: 11 }}
              onClick={() => setDrawTool('sketch')}
            >
              <Sparkles size={12} /> ফ্রি স্কেচ
            </button>
            <button
              className={`px-toggle-pill ${drawTool === 'pan' ? 'on' : ''}`}
              style={{ padding: '5px 9px', fontSize: 11 }}
              onClick={() => setDrawTool('pan')}
            >
              <Move size={12} /> মুভ/প্যান
            </button>
            <button
              className="chip-btn"
              style={{ padding: '5px 9px', fontSize: 11, color: '#38bdf8' }}
              onClick={() => traceInputRef.current?.click()}
            >
              <ImagePlus size={12} /> গাইড ছবি
            </button>
          </div>

          <div className="scroll-row" style={{ gap: 5 }}>
            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 10, borderColor: '#38bdf8', color: '#38bdf8' }}
              onClick={startNewSubPath}
            >
              <Plus size={11} /> নতুন অংশ ({paths.length})
            </button>

            {paths.length > 1 && (
              <button
                className="chip-btn"
                style={{ padding: '4px 8px', fontSize: 10 }}
                onClick={() => {
                  const next = paths[(activePathIndex + 1) % paths.length];
                  setActivePathId(next.id);
                  setActiveNodeIdx(null);
                }}
              >
                <Layers size={11} /> অংশ {activePathIndex + 1}/{paths.length}
              </button>
            )}

            <button
              className={`px-toggle-pill ${activePath?.closed ? 'on' : ''}`}
              style={{ padding: '4px 8px', fontSize: 10 }}
              onClick={toggleActivePathClosed}
            >
              {activePath?.closed ? 'বদ্ধ' : 'খোলা'}
            </button>

            <button
              className={`px-toggle-pill ${symmetry !== 'none' ? 'on' : ''}`}
              style={{ padding: '4px 8px', fontSize: 10 }}
              onClick={cycleSymmetry}
            >
              <FlipHorizontal size={11} /> {symLabels[symmetry]}
            </button>

            <button
              className={`px-toggle-pill ${gridSnap ? 'on' : ''}`}
              style={{ padding: '4px 8px', fontSize: 10 }}
              onClick={() => setGridSnap(!gridSnap)}
            >
              <Grid size={11} /> স্ন্যাপ
            </button>

            {paths.length > 1 && (
              <button
                className={`px-toggle-pill ${fillRuleMode === 'evenodd' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10 }}
                onClick={() =>
                  setFillRuleMode((m) => (m === 'evenodd' ? 'nonzero' : 'evenodd'))
                }
              >
                {fillRuleMode === 'evenodd' ? 'কাটআউট' : 'ভরাট'}
              </button>
            )}

            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 10, color: '#fda4af' }}
              onClick={deleteActivePath}
              title="বর্তমান অংশ মুছুন"
            >
              অংশ মুছুন
            </button>
            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 10, color: '#fb7185' }}
              onClick={clearAllPaths}
              title="সব মুছুন"
            >
              <Trash2 size={11} /> সব
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== COMPACT MODAL VIEW ====================
  return (
    <div className="modal-backdrop" style={{ zIndex: 210, padding: 10 }} onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 420, maxHeight: '94dvh', overflowY: 'auto', padding: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={traceInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleTraceUpload}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} color="#38bdf8" /> Custom Shape Studio
          </span>
          <button className="layer-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            className={`px-toggle-pill ${tab === 'parametric' ? 'on' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setTab('parametric')}
          >
            <Sliders size={13} /> শেপ মেকার
          </button>
          <button
            className={`px-toggle-pill ${tab === 'draw' ? 'on' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setTab('draw')}
          >
            <PenTool size={13} /> নিজে আঁকুন (Pen)
          </button>
        </div>

        {/* Preview / Drawing Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          {tab === 'parametric' ? (
            <div
              style={{
                width: 145,
                height: 145,
                borderRadius: 12,
                backgroundColor: '#090d16',
                border: '1.5px solid rgba(56,189,248,0.35)'
              }}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
                {parsedGrad && (
                  <defs>
                    {parsedGrad.type === 'radial' ? (
                      <radialGradient
                        id="sb_grad"
                        cx={`${parsedGrad.cx ?? 50}%`}
                        cy={`${parsedGrad.cy ?? 50}%`}
                        r="65%"
                      >
                        {parsedGrad.stops.map((st, idx) => (
                          <stop key={idx} offset={`${clamp(st.pos, 0, 100)}%`} stopColor={st.color} />
                        ))}
                      </radialGradient>
                    ) : (
                      <linearGradient id="sb_grad" x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
                        {parsedGrad.stops.map((st, idx) => (
                          <stop key={idx} offset={`${clamp(st.pos, 0, 100)}%`} stopColor={st.color} />
                        ))}
                      </linearGradient>
                    )}
                  </defs>
                )}

                {finalCustomShape.d && (
                  <path
                    d={finalCustomShape.d}
                    fill={finalCustomShape.fillOpacity <= 0 ? 'none' : svgFillColor}
                    fillOpacity={finalCustomShape.fillOpacity}
                    fillRule={finalCustomShape.fillRule}
                    stroke={finalCustomShape.hasBorder ? svgFillColor : 'none'}
                    strokeWidth={finalCustomShape.hasBorder ? finalCustomShape.defaultStrokeWidth : 0}
                    strokeDasharray={finalCustomShape.strokeDash ? '6 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
          ) : (
            <div
              style={{
                width: 260,
                height: 260,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1.5px solid rgba(56,189,248,0.4)',
                position: 'relative',
                background: '#060911'
              }}
            >
              {renderDrawSvg({ width: '100%', height: '100%' })}

              {/* Top-Right FullScreen & Zoom Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {zoom > 1.05 && (
                  <button
                    className="chip-btn"
                    style={{
                      padding: '3px 6px',
                      fontSize: 10,
                      background: 'rgba(6,9,17,0.82)',
                      color: '#38bdf8'
                    }}
                    onClick={resetView}
                    title="Reset Zoom"
                  >
                    {zoom.toFixed(1)}x ↺
                  </button>
                )}
                <button
                  className="chip-btn"
                  style={{
                    padding: '4px 7px',
                    fontSize: 10,
                    background: 'rgba(2,132,199,0.9)',
                    color: '#fff',
                    borderColor: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  onClick={() => setIsFullScreen(true)}
                  title="ফুল স্ক্রিন"
                >
                  <Maximize2 size={12} /> বড় পর্দা
                </button>
              </div>

              {activeNode && (
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    fontSize: 9.5,
                    color: '#38bdf8',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '2px 6px',
                    borderRadius: 6,
                    pointerEvents: 'none'
                  }}
                >
                  X:{Math.round(activeNode.x)} Y:{Math.round(activeNode.y)}
                </div>
              )}
            </div>
          )}
        </div>

        {tab === 'parametric' ? (
          <>
            <div className="scroll-row" style={{ marginBottom: 8 }}>
              {PRESET_SHAPES.map((s) => (
                <button
                  key={s.id}
                  className={`chip-btn ${cfg.shape === s.id ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => setCfg({ ...cfg, shape: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {['rect', 'triangle', 'polygon', 'star', 'ticket', 'bubble', 'arrow'].includes(cfg.shape) && (
              <div className="slider-row">
                <span style={{ minWidth: 82 }}>
                  {cfg.shape === 'arrow' ? 'মাথার মাপ' : cfg.shape === 'ticket' ? 'কোণা কাটা' : 'কোণা গোল'}:{' '}
                  {cfg.corner}
                </span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={cfg.corner}
                  onChange={(e) => setCfg({ ...cfg, corner: Number(e.target.value) })}
                />
              </div>
            )}

            {['polygon', 'star', 'flower', 'badge', 'wave'].includes(cfg.shape) && (
              <div className="slider-row">
                <span style={{ minWidth: 82 }}>
                  {cfg.shape === 'wave' ? 'ঢেউ সংখ্যা' : 'কোণা/পাপড়ি'}: {cfg.sides}
                </span>
                <input
                  type="range"
                  min={cfg.shape === 'wave' ? 1 : 3}
                  max={cfg.shape === 'wave' ? 8 : 16}
                  value={cfg.sides}
                  onChange={(e) => setCfg({ ...cfg, sides: Number(e.target.value) })}
                />
              </div>
            )}

            {['star', 'flower', 'badge', 'arrow', 'wave'].includes(cfg.shape) && (
              <div className="slider-row">
                <span style={{ minWidth: 82 }}>
                  {cfg.shape === 'arrow' ? 'দণ্ড চওড়া' : cfg.shape === 'wave' ? 'ঢেউ উচ্চতা' : 'গভীরতা'}:{' '}
                  {cfg.depth}
                </span>
                <input
                  type="range"
                  min="15"
                  max="85"
                  value={cfg.depth}
                  onChange={(e) => setCfg({ ...cfg, depth: Number(e.target.value) })}
                />
              </div>
            )}

            {cfg.shape === 'bubble' && (
              <div className="slider-row">
                <span style={{ minWidth: 82 }}>লেজের জায়গা: {cfg.tailX}%</span>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={cfg.tailX}
                  onChange={(e) => setCfg({ ...cfg, tailX: Number(e.target.value) })}
                />
              </div>
            )}

            {cfg.shape === 'wave' && (
              <div style={{ marginTop: 6 }}>
                <button
                  className={`px-toggle-pill ${cfg.zigzag ? 'on' : ''}`}
                  onClick={() => setCfg({ ...cfg, zigzag: !cfg.zigzag })}
                >
                  {cfg.zigzag ? 'জিকজ্যাগ চালু' : 'স্মুথ ওয়েভ'}
                </button>
              </div>
            )}

            {!['arrow', 'bubble', 'wave'].includes(cfg.shape) && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className={`px-toggle-pill ${cfg.hollow ? 'on' : ''}`}
                    onClick={() => setCfg({ ...cfg, hollow: !cfg.hollow })}
                  >
                    ভেতর ফাঁকা (রিং)
                  </button>
                  {cfg.hollow && (
                    <input
                      type="range"
                      min="3"
                      max="26"
                      value={cfg.thickness}
                      onChange={(e) => setCfg({ ...cfg, thickness: Number(e.target.value) })}
                      style={{ flex: 1, accentColor: '#38bdf8' }}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Tool Mode Row */}
            <div className="px-mini-grid" style={{ marginBottom: 6, justifyContent: 'center' }}>
              <button
                className={`px-toggle-pill ${drawTool === 'pen' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10.5 }}
                onClick={() => setDrawTool('pen')}
              >
                <PenTool size={11} /> পেন
              </button>
              <button
                className={`px-toggle-pill ${drawTool === 'edit' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10.5 }}
                onClick={() => setDrawTool('edit')}
              >
                <MousePointer size={11} /> এডিট
              </button>
              <button
                className={`px-toggle-pill ${drawTool === 'sketch' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10.5 }}
                onClick={() => setDrawTool('sketch')}
              >
                <Sparkles size={11} /> স্কেচ
              </button>
              <button
                className={`px-toggle-pill ${drawTool === 'pan' ? 'on' : ''}`}
                style={{ padding: '4px 8px', fontSize: 10.5 }}
                onClick={() => setDrawTool('pan')}
              >
                <Move size={11} /> প্যান
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 8px', fontSize: 10.5, color: '#38bdf8' }}
                onClick={() => traceInputRef.current?.click()}
              >
                <ImagePlus size={11} /> গাইড ছবি
              </button>
            </div>

            {/* Zoom + Undo/Redo + Actions */}
            <div className="px-mini-grid" style={{ marginBottom: 6, justifyContent: 'center' }}>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={() => zoomBy(0.75)}
              >
                <ZoomOut size={12} />
              </button>
              <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, alignSelf: 'center' }}>
                {zoom.toFixed(1)}x
              </span>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={() => zoomBy(1.35)}
              >
                <ZoomIn size={12} />
              </button>

              <button
                className="chip-btn"
                style={{ padding: '4px 7px', fontSize: 10, borderColor: '#38bdf8', color: '#38bdf8' }}
                onClick={startNewSubPath}
              >
                <Plus size={11} /> অংশ ({paths.length})
              </button>

              <button
                className={`px-toggle-pill ${activePath?.closed ? 'on' : ''}`}
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={toggleActivePathClosed}
              >
                {activePath?.closed ? 'বদ্ধ' : 'খোলা'}
              </button>

              <button
                className={`px-toggle-pill ${symmetry !== 'none' ? 'on' : ''}`}
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={cycleSymmetry}
              >
                <FlipHorizontal size={11} /> {symLabels[symmetry]}
              </button>

              <button
                className={`px-toggle-pill ${gridSnap ? 'on' : ''}`}
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={() => setGridSnap(!gridSnap)}
              >
                <Grid size={11} />
              </button>

              <button
                className="chip-btn"
                style={{ padding: '4px 7px' }}
                onClick={handleUndo}
                disabled={history.past.length === 0}
              >
                <Undo2 size={12} />
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px' }}
                onClick={handleRedo}
                disabled={history.future.length === 0}
              >
                <Redo2 size={12} />
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', color: '#fda4af' }}
                onClick={clearAllPaths}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Trace Opacity Row in Compact Mode */}
            {traceImg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                  background: 'rgba(255,255,255,0.04)',
                  padding: '4px 8px',
                  borderRadius: 8,
                  fontSize: 10
                }}
              >
                <button
                  className={`px-toggle-pill ${showTrace ? 'on' : ''}`}
                  style={{ padding: '3px 7px', fontSize: 10 }}
                  onClick={() => setShowTrace(!showTrace)}
                >
                  {showTrace ? <Eye size={11} /> : <EyeOff size={11} />} ছবি
                </button>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={Math.round(traceOpacity * 100)}
                  onChange={(e) => setTraceOpacity(Number(e.target.value) / 100)}
                  style={{ flex: 1, accentColor: '#38bdf8' }}
                />
                <button
                  className="chip-btn"
                  style={{ padding: '2px 6px', color: '#fda4af' }}
                  onClick={() => setTraceImg(null)}
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Selected Node Bar in Compact Mode */}
            {activeNode && drawTool !== 'sketch' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 4,
                  marginBottom: 6,
                  background: 'rgba(56,189,248,0.08)',
                  padding: '5px 8px',
                  borderRadius: 10
                }}
              >
                <button
                  className={`px-toggle-pill ${activeNode.mode === 'smooth' ? 'on' : ''}`}
                  style={{ padding: '3px 7px', fontSize: 10 }}
                  onClick={() => setActiveNodeType('smooth')}
                >
                  স্মুথ
                </button>
                <button
                  className={`px-toggle-pill ${
                    activeNode.mode === 'corner' && isZeroHandle(activeNode.inX, activeNode.inY)
                      ? 'on'
                      : ''
                  }`}
                  style={{ padding: '3px 7px', fontSize: 10 }}
                  onClick={() => setActiveNodeType('sharp')}
                >
                  কোণা
                </button>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 7px' }}
                  onClick={() => nudgeActiveNode(-1, 0)}
                >
                  <ArrowLeft size={11} />
                </button>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 7px' }}
                  onClick={() => nudgeActiveNode(0, -1)}
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 7px' }}
                  onClick={() => nudgeActiveNode(0, 1)}
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 7px' }}
                  onClick={() => nudgeActiveNode(1, 0)}
                >
                  <ArrowRight size={11} />
                </button>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 7px', color: '#fda4af', fontSize: 10 }}
                  onClick={deleteActiveNode}
                >
                  মুছুন
                </button>
              </div>
            )}
          </>
        )}

        <div className="px-mini-grid" style={{ marginTop: 8, marginBottom: 6 }}>
          {FILL_MODES.map((m) => (
            <button
              key={m.id}
              className={`px-toggle-pill ${fillMode === m.id ? 'on' : ''}`}
              style={{ padding: '4px 8px', fontSize: 10 }}
              onClick={() => setFillMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 8 }}>
          <ColorPickerStrip
            allowGradient={true}
            colorMode={parsedGrad ? 'gradient' : 'solid'}
            solidValue={!parsedGrad ? color : '#fda4af'}
            gradientCss={parsedGrad ? color : ''}
            onSelectSolid={(hex) => setColor(hex)}
            onSelectGradient={(g) => setColor(g.css)}
          />
        </div>

        <input
          type="text"
          className="modal-textarea"
          style={{ marginTop: 0, marginBottom: 10, padding: '7px 10px', fontSize: 12 }}
          value={shapeName}
          onChange={(e) => setShapeName(e.target.value)}
          placeholder="শেপের নাম লিখুন (সেভ করলে মনে থাকবে)..."
        />

        <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onClose}>বাতিল</button>
          <button
            className="btn-secondary"
            style={{ borderColor: '#38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleDone(true)}
          >
            <BookmarkPlus size={14} /> সেভ ও যোগ
          </button>
          <button
            className="btn-primary"
            style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleDone(false)}
          >
            <Check size={14} /> ক্যানভাসে যোগ
          </button>
        </div>
      </div>
    </div>
  );
}