import { getFontDnaCatalog } from './fontVisionAnalyzer.js';
import { parseColorRgb, rgbToHex } from './visionAnalyzer.js';
import { scoreCandidatesWithUserTaste } from './userTasteEngine.js';

const IDB_ACTOR_URL = 'indexeddb://adnans-design-actor-v12';
const IDB_CRITIC_URL = 'indexeddb://adnans-design-critic-v12';
const CUSTOM_SAMPLES_KEY = 'adnans_nn_actor_samples_v12';
const CUSTOM_CRITIC_KEY = 'adnans_nn_critic_samples_v12';
const LEGACY_SAMPLES_KEY_V11 = 'adnans_nn_actor_samples_v11';
const LEGACY_CRITIC_KEY_V11 = 'adnans_nn_critic_samples_v11';

const EMB_DIM = 1280;
const SPATIAL_DIM = 80;
const META_DIM = 9;
const CTX_DIM = SPATIAL_DIM + META_DIM; // 89
const INPUT_DIM = EMB_DIM + CTX_DIM; // 1369
const OUTPUT_DIM = 47;

const LOSS_WEIGHTS = [
  3.8, 3.8,
  4.0, 4.0, 4.0,
  2.2, 1.8, 1.8,
  1.2, 1.2, 1.2,
  1.2, 1.1, 1.1, 1.1,
  1.3,
  1.5, 1.5, 1.5, 1.5,
  1.5, 1.5,
  1.0, 1.0, 1.0, 1.0, 1.0,
  3.5, 3.5,
  3.8, 3.8, 3.8,
  2.0, 1.6, 1.6,
  1.2, 1.2, 1.2,
  1.2,
  1.4, 1.4, 1.4, 1.4,
  1.3, 1.3,
  0.9, 0.9
];

let tfPromise = null;
let mobileNetPromise = null;
let actorPromise = null;
let criticPromise = null;
let cachedTf = null;
let cachedMobileNet = null;
let cachedActor = null;
let cachedCritic = null;

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function encodeAlignOneHot(align) {
  if (align === 'left') return [0.95, 0.05, 0.05];
  if (align === 'right') return [0.05, 0.05, 0.95];
  return [0.05, 0.95, 0.05];
}

function decodeAlignOneHot(l, c, r) {
  if (l >= c && l >= r) return 'left';
  if (r >= c && r >= l) return 'right';
  return 'center';
}

function measureTextWidthRatio(layer, vision) {
  const previewW = vision?.previewW || 260;
  if (layer?.width) {
    return clamp(layer.width / previewW, 0.2, 0.96);
  }
  const ctx = vision?.ctx;
  if (!ctx) return 0.72;
  const fSize = layer.fontSize || 24;
  ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold === false ? 400 : 700} ${fSize}px "${layer.font || 'sans-serif'}", sans-serif`;
  const lines = (layer.text || ' ').split('\n');
  let maxW = 40;
  for (const ln of lines) {
    maxW = Math.max(maxW, ctx.measureText(ln || ' ').width);
  }
  const padX = layer.paddingX ?? 0;
  return clamp((maxW + padX * 2) / previewW, 0.2, 0.94);
}

function cosineSim(a, b, start, end) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = start; i < end; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 1e-8 ? dot / denom : 0;
}

// Same-Cluster Attention: বিপরীত Align বা ভিন্ন স্টাইল মিশিয়ে গড়/ঝাপসা না করে একই ক্লাস্টার থেকে নেয়
function computeClusterAttention(xVec, customSamples = []) {
  const valid = customSamples.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM
  );
  if (!valid.length) return null;

  const logits = valid.map((s) => {
    const simEmb = cosineSim(xVec, s.x, 0, EMB_DIM);
    const simSpatial = cosineSim(xVec, s.x, EMB_DIM, EMB_DIM + SPATIAL_DIM);
    let metaDiff = 0;
    for (let i = EMB_DIM + SPATIAL_DIM; i < INPUT_DIM; i++) {
      metaDiff += Math.abs((xVec[i] || 0) - (s.x[i] || 0));
    }
    const simMeta = 1 - metaDiff / META_DIM;
    return (simEmb * 0.4 + simSpatial * 0.35 + simMeta * 0.25) * 14.0;
  });

  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
  const weights = exps.map((e) => e / sumExp);

  const ranked = valid
    .map((s, i) => ({ y: s.y, weight: weights[i], logit: logits[i] }))
    .sort((a, b) => b.weight - a.weight);

  const anchor = ranked[0].y;
  const anchorHeadAlign = decodeAlignOneHot(anchor[2], anchor[3], anchor[4]);

  // শুধুমাত্র একই Align ক্লাস্টারের কাছাকাছি স্যাম্পলগুলোর ভেতরে ব্লেন্ড
  const sameCluster = ranked.filter((item) => {
    const al = decodeAlignOneHot(item.y[2], item.y[3], item.y[4]);
    return al === anchorHeadAlign;
  });

  const clusterSum = sameCluster.reduce((acc, item) => acc + item.weight, 0) || 1;
  const clusterOut = new Array(OUTPUT_DIM).fill(0);
  for (const item of sameCluster) {
    const w = item.weight / clusterSum;
    for (let k = 0; k < OUTPUT_DIM; k++) {
      clusterOut[k] += w * item.y[k];
    }
  }

  return {
    clusterOut,
    anchorOut: anchor,
    topWeight: ranked[0].weight,
    rankedPrototypes: ranked.slice(0, 6).map((item) => item.y),
    sampleCount: valid.length
  };
}

// লেখা যেখানে বসবে, ঠিক সেই ৪×৪ অঞ্চলের আলো দেখে পড়া যাবে কিনা তা নিশ্চিত করা
function enforceRegionContrast(out, vision) {
  const spatial = vision?.spatial80;
  if (!Array.isArray(spatial) || spatial.length !== SPATIAL_DIM) return out;

  const fixed = [...out];

  const checkPoint = (xNorm, yNorm, rIdx, gIdx, bIdx, cardIdx, shadowIdx) => {
    if (fixed[cardIdx] >= 0.55) return;
    const gx = Math.min(3, Math.max(0, Math.floor(clamp(xNorm) * 4)));
    const gy = Math.min(3, Math.max(0, Math.floor(clamp(yNorm) * 4)));
    const c = (gy * 4 + gx) * 5;
    const bgLum = 0.2126 * spatial[c] + 0.7152 * spatial[c + 1] + 0.0722 * spatial[c + 2];
    const txtLum = 0.2126 * fixed[rIdx] + 0.7152 * fixed[gIdx] + 0.0722 * fixed[bIdx];

    if (Math.abs(txtLum - bgLum) < 0.28) {
      if (bgLum < 0.48) {
        fixed[rIdx] = 0.97;
        fixed[gIdx] = 0.98;
        fixed[bIdx] = 0.99;
        fixed[shadowIdx] = Math.max(fixed[shadowIdx], 0.85);
      } else {
        fixed[rIdx] = 0.06;
        fixed[gIdx] = 0.09;
        fixed[bIdx] = 0.16;
      }
    }
  };

  checkPoint(fixed[0], fixed[1], 8, 9, 10, 15, 22);
  checkPoint(fixed[27], fixed[28], 35, 36, 37, 38, 22);

  return fixed;
}

async function getTf() {
  if (cachedTf) return cachedTf;
  if (!tfPromise) {
    tfPromise = import('@tensorflow/tfjs').then(async (tf) => {
      await tf.ready();
      cachedTf = tf;
      return tf;
    });
  }
  return tfPromise;
}

async function getMobileNet() {
  if (cachedMobileNet) return cachedMobileNet;
  if (!mobileNetPromise) {
    mobileNetPromise = (async () => {
      await getTf();
      const mobilenet = await import('@tensorflow-models/mobilenet');
      const net = await mobilenet.load({ version: 2, alpha: 1.0 });
      cachedMobileNet = net;
      return net;
    })().catch((err) => {
      mobileNetPromise = null;
      throw err;
    });
  }
  return mobileNetPromise;
}

export function loadCustomSamples() {
  try {
    const raw = localStorage.getItem(CUSTOM_SAMPLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    // পুরনো v11 ডাটা থাকলে স্বয়ংক্রিয়ভাবে v12-এ মাইগ্রেট
    const legacyRaw = localStorage.getItem(LEGACY_SAMPLES_KEY_V11);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        const valid = legacyParsed.filter(
          (s) =>
            Array.isArray(s?.x) &&
            s.x.length === INPUT_DIM &&
            Array.isArray(s?.y) &&
            s.y.length === OUTPUT_DIM
        );
        if (valid.length) {
          saveCustomSamples(valid);
          return valid;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

function saveCustomSamples(list) {
  try {
    localStorage.setItem(CUSTOM_SAMPLES_KEY, JSON.stringify(list.slice(-120)));
  } catch {}
}

export function loadCriticSamples() {
  try {
    const raw = localStorage.getItem(CUSTOM_CRITIC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    const legacyRaw = localStorage.getItem(LEGACY_CRITIC_KEY_V11);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        const valid = legacyParsed.filter(
          (s) =>
            Array.isArray(s?.x) &&
            s.x.length === INPUT_DIM &&
            Array.isArray(s?.y) &&
            s.y.length === OUTPUT_DIM &&
            typeof s?.score === 'number'
        );
        if (valid.length) {
          saveCriticSamples(valid);
          return valid;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

function saveCriticSamples(list) {
  try {
    localStorage.setItem(CUSTOM_CRITIC_KEY, JSON.stringify(list.slice(-180)));
  } catch {}
}

export function getCriticStats() {
  const list = loadCriticSamples();
  let likes = 0;
  let dislikes = 0;
  for (const s of list) {
    if (s?.score >= 0.5) likes++;
    else dislikes++;
  }
  return { total: list.length, likes, dislikes };
}

export function hasTrainedModelData() {
  return loadCustomSamples().length > 0;
}

function hasActiveCritic() {
  const stats = getCriticStats();
  return stats.likes > 0 && stats.dislikes > 0;
}

export async function extractFeatureVectorForDesign({ vision, layers = [] }) {
  const tf = await getTf();
  const net = await getMobileNet();

  const emb1280 = tf.tidy(() => {
    const rawEmb = net.infer(vision.canvas, true);
    const norm = tf.norm(rawEmb, 'euclidean', 1, true);
    const normalized = rawEmb.div(norm.add(1e-6)).mul(2.5);
    return Array.from(normalized.dataSync(), (v) => Number(v.toFixed(4)));
  });

  const spatial80 =
    Array.isArray(vision.spatial80) && vision.spatial80.length === SPATIAL_DIM
      ? vision.spatial80
      : new Array(SPATIAL_DIM).fill(0.15);

  const texts = layers
    .filter((l) => l.visible !== false && l.type === 'text')
    .sort((a, b) => a.y - b.y);
  const head = texts[0];
  const sub = texts.length >= 2 ? texts[texts.length - 1] : null;

  const headStr = (head?.text || '').trim();
  const subStr = (sub?.text || '').trim();
  const combinedText = texts.map((l) => l.text || '').join(' ');

  const headLines = headStr ? headStr.split('\n').length : 1;
  const subLines = subStr ? subStr.split('\n').length : 0;

  const hasBangla = /[\u0980-\u09FF]/.test(combinedText) ? 1 : 0;
  const hasManualShape = layers.some((l) => l.visible !== false && l.type === 'shape') ? 1 : 0;
  const ratioNorm = clamp(((vision.ratio || 1) - 0.5) / 1.5);

  const meta9 = [
    Number(ratioNorm.toFixed(3)),
    Number(clamp(texts.length / 4).toFixed(3)),
    sub ? 1 : 0,
    Number(clamp(headStr.length / 80).toFixed(3)),
    Number(clamp(headLines / 5).toFixed(3)),
    Number(clamp(subStr.length / 140).toFixed(3)),
    Number(clamp(subLines / 6).toFixed(3)),
    hasBangla,
    hasManualShape
  ];

  return [...emb1280, ...spatial80, ...meta9];
}

function getBgVignetteFloat(bgConfig) {
  const ov = bgConfig?.overlayGradient || 'none';
  if (ov === 'none') return 0.04;
  const nums = ov.match(/0\.\d+/g);
  if (nums && nums.length) {
    return clamp(Number(nums[nums.length - 1]), 0.05, 0.95);
  }
  return 0.72;
}

export function extractTargetLabelsFromDesign({ vision, layers = [], fontDnaMap, bgConfig }) {
  const texts = layers
    .filter((l) => l.visible !== false && l.type === 'text')
    .sort((a, b) => a.y - b.y);
  if (!texts.length) return null;

  const head = texts[0];
  const sub = texts.length >= 2 ? texts[texts.length - 1] : null;

  const headXNorm = clamp((head.x ?? 50) / 100);
  const headYNorm = clamp((head.y ?? 40) / 100);
  const [hAL, hAC, hAR] = encodeAlignOneHot(head.align);
  const headWidthRatio = measureTextWidthRatio(head, vision);
  const headWidthNorm = clamp((headWidthRatio - 0.2) / 0.76);
  const headSizeNorm = clamp(((head.fontSize || 24) - 12) / 40);
  const headLineHNorm = clamp(((head.lineHeight ?? 1.2) - 0.9) / 0.9);

  const headHex =
    head.colorMode === 'gradient'
      ? head.gradColor1 || head.color || '#f8fafc'
      : head.color || '#f8fafc';
  const headRgb = parseColorRgb(headHex) || { r: 248, g: 250, b: 252 };
  const useGrad = head.colorMode === 'gradient' ? 0.94 : 0.06;
  const grad2Rgb = parseColorRgb(head.gradColor2 || headHex) || headRgb;
  const headCardBg = head.textBgEnabled ? 0.94 : 0.06;

  const defaultDna = { weight: 0.5, widthRatio: 0.5, slant: 0.2, complexity: 0.4 };
  const headDna = fontDnaMap?.get(head.font) || defaultDna;
  const headBold = head.isBold === false ? 0.08 : 0.92;
  const headItalic = head.isItalic ? 0.92 : 0.08;

  const shOn = head.shadow ? 0.85 : 0.06;
  const shBlur = head.shadow ? clamp((head.shadowBlur ?? 10) / 24, 0.05, 1) : 0.1;
  const shRgb = parseColorRgb(head.shadowColor || 'rgba(0,0,0,0.88)') || { r: 0, g: 0, b: 0 };

  const subXNorm = clamp(((sub ? sub.x : head.x) ?? 50) / 100);
  const subYNorm = clamp(((sub ? sub.y : Math.min(92, (head.y ?? 40) + 14))) / 100);
  const [sAL, sAC, sAR] = encodeAlignOneHot(sub ? sub.align : head.align);
  const subWidthRatio = sub ? measureTextWidthRatio(sub, vision) : headWidthRatio;
  const subWidthNorm = clamp((subWidthRatio - 0.2) / 0.76);
  const subFontSize = sub?.fontSize ?? Math.round((head.fontSize || 24) * 0.68);
  const subSizeNorm = clamp((subFontSize - 10) / 30);
  const subLineHNorm = clamp(((sub?.lineHeight ?? 1.24) - 0.9) / 0.9);

  const subHex =
    sub?.colorMode === 'gradient'
      ? sub.gradColor1 || sub.color || '#ffffff'
      : sub?.color || '#ffffff';
  const subRgb = parseColorRgb(subHex) || { r: 255, g: 255, b: 255 };
  const subCardBg = sub?.textBgEnabled ? 0.94 : 0.06;
  const subDna = sub ? fontDnaMap?.get(sub.font) || headDna : headDna;
  const subBold = sub?.isBold ? 0.92 : 0.08;
  const subItalic = sub?.isItalic ? 0.92 : 0.08;

  const bgVignette = getBgVignetteFloat(bgConfig);
  const bgBrightness = Number(clamp(((bgConfig?.brightness ?? 85) - 50) / 80).toFixed(3));

  return [
    Number(headXNorm.toFixed(3)),
    Number(headYNorm.toFixed(3)),
    hAL,
    hAC,
    hAR,
    Number(headWidthNorm.toFixed(3)),
    Number(headSizeNorm.toFixed(3)),
    Number(headLineHNorm.toFixed(3)),
    Number((headRgb.r / 255).toFixed(3)),
    Number((headRgb.g / 255).toFixed(3)),
    Number((headRgb.b / 255).toFixed(3)),
    useGrad,
    Number((grad2Rgb.r / 255).toFixed(3)),
    Number((grad2Rgb.g / 255).toFixed(3)),
    Number((grad2Rgb.b / 255).toFixed(3)),
    headCardBg,
    headDna.weight,
    headDna.widthRatio,
    headDna.slant,
    headDna.complexity,
    headBold,
    headItalic,
    shOn,
    Number(shBlur.toFixed(3)),
    Number((shRgb.r / 255).toFixed(3)),
    Number((shRgb.g / 255).toFixed(3)),
    Number((shRgb.b / 255).toFixed(3)),
    Number(subXNorm.toFixed(3)),
    Number(subYNorm.toFixed(3)),
    sAL,
    sAC,
    sAR,
    Number(subWidthNorm.toFixed(3)),
    Number(subSizeNorm.toFixed(3)),
    Number(subLineHNorm.toFixed(3)),
    Number((subRgb.r / 255).toFixed(3)),
    Number((subRgb.g / 255).toFixed(3)),
    Number((subRgb.b / 255).toFixed(3)),
    subCardBg,
    subDna.weight,
    subDna.widthRatio,
    subDna.slant,
    subDna.complexity,
    subBold,
    subItalic,
    bgVignette,
    bgBrightness
  ];
}

function decodePredictionVector(out, criticScore = null) {
  const headAlign = decodeAlignOneHot(out[2], out[3], out[4]);
  const subAlign = decodeAlignOneHot(out[29], out[30], out[31]);

  return {
    rawVector: out,
    criticScore,
    headX: Number(clamp(out[0] * 100, 3, 97).toFixed(1)),
    headY: Number(clamp(out[1] * 100, 3, 97).toFixed(1)),
    headAlign,
    headWidthRatio: Number((0.2 + clamp(out[5]) * 0.76).toFixed(2)),
    headSize: Math.round(12 + clamp(out[6]) * 40),
    headLineHeight: Number((0.9 + clamp(out[7]) * 0.9).toFixed(2)),
    headHex: rgbToHex(out[8] * 255, out[9] * 255, out[10] * 255),
    useGradient: out[11] >= 0.55,
    grad2Hex: rgbToHex(out[12] * 255, out[13] * 255, out[14] * 255),
    headCardBg: out[15] >= 0.55,
    headFontStyle: {
      weight: out[16],
      widthRatio: out[17],
      slant: out[18],
      complexity: out[19]
    },
    headBold: out[20] >= 0.5,
    headItalic: out[21] >= 0.55,
    shadowOpacity: Number(out[22].toFixed(2)),
    shadowBlur: Math.round(out[23] * 24),
    shadowR: Math.round(out[24] * 255),
    shadowG: Math.round(out[25] * 255),
    shadowB: Math.round(out[26] * 255),
    subX: Number(clamp(out[27] * 100, 3, 97).toFixed(1)),
    subY: Number(clamp(out[28] * 100, 3, 97).toFixed(1)),
    subAlign,
    subWidthRatio: Number((0.2 + clamp(out[32]) * 0.76).toFixed(2)),
    subSize: Math.round(10 + clamp(out[33]) * 30),
    subLineHeight: Number((0.9 + clamp(out[34]) * 0.9).toFixed(2)),
    subHex: rgbToHex(out[35] * 255, out[36] * 255, out[37] * 255),
    subCardBg: out[38] >= 0.55,
    subFontStyle: {
      weight: out[39],
      widthRatio: out[40],
      slant: out[41],
      complexity: out[42]
    },
    subBold: out[43] >= 0.5,
    subItalic: out[44] >= 0.55,
    bgVignette: Number(out[45].toFixed(2)),
    bgBrightness: Math.round(50 + out[46] * 80)
  };
}

function compileActorModel(tf, model, lr = 0.0028) {
  const weightVec = tf.tensor1d(LOSS_WEIGHTS);
  const weightedLoss = (yTrue, yPred) => yPred.sub(yTrue).square().mul(weightVec).sum(-1).mean();
  model.compile({
    optimizer: tf.train.adam(lr),
    loss: weightedLoss
  });
}

function createFreshActorModel(tf) {
  const inEmb = tf.input({ shape: [EMB_DIM], name: 'emb_input' });
  const inCtx = tf.input({ shape: [CTX_DIM], name: 'ctx_input' });

  const embHidden = tf.layers
    .dense({
      units: 48,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 3e-4 })
    })
    .apply(inEmb);
  const embDrop = tf.layers.dropout({ rate: 0.15 }).apply(embHidden);

  const ctxHidden = tf.layers
    .dense({
      units: 48,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 2e-4 })
    })
    .apply(inCtx);
  const ctxDrop = tf.layers.dropout({ rate: 0.1 }).apply(ctxHidden);

  const merged = tf.layers.concatenate().apply([embDrop, ctxDrop]);
  const fused1 = tf.layers
    .dense({
      units: 72,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 2e-4 })
    })
    .apply(merged);
  const fusedDrop = tf.layers.dropout({ rate: 0.12 }).apply(fused1);
  const fused2 = tf.layers
    .dense({
      units: 56,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 })
    })
    .apply(fusedDrop);

  const out = tf.layers.dense({ units: OUTPUT_DIM, activation: 'sigmoid' }).apply(fused2);

  const model = tf.model({ inputs: [inEmb, inCtx], outputs: out });
  compileActorModel(tf, model);
  return model;
}

function createFreshCriticModel(tf) {
  const inEmb = tf.input({ shape: [EMB_DIM], name: 'c_emb_input' });
  const inCtx = tf.input({ shape: [CTX_DIM], name: 'c_ctx_input' });
  const inDesign = tf.input({ shape: [OUTPUT_DIM], name: 'c_design_input' });

  const embH = tf.layers
    .dense({
      units: 32,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 3e-4 })
    })
    .apply(inEmb);
  const embD = tf.layers.dropout({ rate: 0.15 }).apply(embH);

  const ctxH = tf.layers
    .dense({
      units: 24,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 3e-4 })
    })
    .apply(inCtx);

  const desH = tf.layers
    .dense({
      units: 32,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 3e-4 })
    })
    .apply(inDesign);

  const merged = tf.layers.concatenate().apply([embD, ctxH, desH]);
  const hidden = tf.layers
    .dense({
      units: 32,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 3e-4 })
    })
    .apply(merged);
  const drop = tf.layers.dropout({ rate: 0.12 }).apply(hidden);
  const score = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(drop);

  const model = tf.model({ inputs: [inEmb, inCtx, inDesign], outputs: score });
  model.compile({
    optimizer: tf.train.adam(0.003),
    loss: 'binaryCrossentropy'
  });
  return model;
}

async function trainActorOnSamples(tf, model, customSamples = []) {
  const valid = customSamples.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM
  );
  if (!valid.length) return 0;

  const epochs = valid.length <= 35
    ? Math.min(200, Math.max(120, 220 - valid.length * 2))
    : Math.min(130, Math.max(70, 140 - valid.length));
  const xsEmb = tf.tensor2d(valid.map((d) => d.x.slice(0, EMB_DIM)), [valid.length, EMB_DIM]);
  const xsCtx = tf.tensor2d(valid.map((d) => d.x.slice(EMB_DIM)), [valid.length, CTX_DIM]);
  const ys = tf.tensor2d(valid.map((d) => d.y), [valid.length, OUTPUT_DIM]);

  let finalLoss = 0;
  try {
    const lr = valid.length > 35 ? 0.0022 : 0.0028;
    compileActorModel(tf, model, lr);
    const hist = await model.fit([xsEmb, xsCtx], ys, {
      epochs,
      batchSize: Math.min(8, valid.length),
      shuffle: true,
      verbose: 0
    });
    const losses = hist?.history?.loss;
    if (Array.isArray(losses) && losses.length) {
      finalLoss = losses[losses.length - 1] / OUTPUT_DIM;
    }
  } finally {
    xsEmb.dispose();
    xsCtx.dispose();
    ys.dispose();
  }
  return finalLoss;
}

async function trainCriticOnSamples(tf, model, criticSamples = []) {
  const valid = criticSamples.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM &&
      typeof s?.score === 'number'
  );
  if (valid.length < 2) return 0;

  const epochs = Math.min(60, Math.max(25, 65 - Math.floor(valid.length / 2)));
  const xsEmb = tf.tensor2d(valid.map((d) => d.x.slice(0, EMB_DIM)), [valid.length, EMB_DIM]);
  const xsCtx = tf.tensor2d(valid.map((d) => d.x.slice(EMB_DIM)), [valid.length, CTX_DIM]);
  const xsDes = tf.tensor2d(valid.map((d) => d.y), [valid.length, OUTPUT_DIM]);
  const ys = tf.tensor2d(valid.map((d) => [d.score]), [valid.length, 1]);

  let finalLoss = 0;
  try {
    const hist = await model.fit([xsEmb, xsCtx, xsDes], ys, {
      epochs,
      batchSize: Math.min(10, valid.length),
      shuffle: true,
      verbose: 0
    });
    const losses = hist?.history?.loss;
    if (Array.isArray(losses) && losses.length) {
      finalLoss = losses[losses.length - 1];
    }
  } finally {
    xsEmb.dispose();
    xsCtx.dispose();
    xsDes.dispose();
    ys.dispose();
  }
  return finalLoss;
}

async function ensureActorModel() {
  if (cachedActor) return cachedActor;
  if (actorPromise) return actorPromise;

  actorPromise = (async () => {
    const tf = await getTf();
    const custom = loadCustomSamples();
    let model = null;

    if (custom.length > 0) {
      try {
        model = await tf.loadLayersModel(IDB_ACTOR_URL);
        compileActorModel(tf, model);
      } catch {
        model = createFreshActorModel(tf);
        await trainActorOnSamples(tf, model, custom);
        try {
          await model.save(IDB_ACTOR_URL);
        } catch {}
      }
    } else {
      model = createFreshActorModel(tf);
    }

    cachedActor = model;
    return model;
  })();

  return actorPromise;
}

async function ensureCriticModel() {
  if (cachedCritic) return cachedCritic;
  if (criticPromise) return criticPromise;

  criticPromise = (async () => {
    const tf = await getTf();
    const samples = loadCriticSamples();
    let model = null;

    if (samples.length >= 2) {
      try {
        model = await tf.loadLayersModel(IDB_CRITIC_URL);
        model.compile({ optimizer: tf.train.adam(0.003), loss: 'binaryCrossentropy' });
      } catch {
        model = createFreshCriticModel(tf);
        await trainCriticOnSamples(tf, model, samples);
        try {
          await model.save(IDB_CRITIC_URL);
        } catch {}
      }
    } else {
      model = createFreshCriticModel(tf);
    }

    cachedCritic = model;
    return model;
  })();

  return criticPromise;
}

function scoreCandidatesWithOwnerCritic(tf, criticModel, xVec, candidates) {
  return tf.tidy(() => {
    const n = candidates.length;
    const embRow = xVec.slice(0, EMB_DIM);
    const ctxRow = xVec.slice(EMB_DIM);
    const embBatch = tf.tensor2d(new Array(n).fill(embRow), [n, EMB_DIM]);
    const ctxBatch = tf.tensor2d(new Array(n).fill(ctxRow), [n, CTX_DIM]);
    const desBatch = tf.tensor2d(candidates, [n, OUTPUT_DIM]);
    const scores = criticModel.predict([embBatch, ctxBatch, desBatch]);
    return Array.from(scores.dataSync());
  });
}

async function computeBlendedTasteScores(tf, xVec, candidates, { includeUserTaste = true } = {}) {
  let ownerScores = null;
  if (hasActiveCritic()) {
    const critic = await ensureCriticModel();
    ownerScores = scoreCandidatesWithOwnerCritic(tf, critic, xVec, candidates);
  }

  let userScores = null;
  if (includeUserTaste) {
    userScores = await scoreCandidatesWithUserTaste(xVec, candidates);
  }

  if (!ownerScores && !userScores) return null;

  return candidates.map((_, i) => {
    if (ownerScores && userScores) {
      return ownerScores[i] * 0.45 + userScores[i] * 0.55;
    }
    return userScores ? userScores[i] : ownerScores[i];
  });
}

function blendActorWithCluster(nnOut, cluster) {
  if (!cluster) return nnOut;
  const n = cluster.sampleCount;
  const cOut = cluster.clusterOut;

  // কম ডাটায় রঙ, Align ও ফন্ট Cluster থেকে পরিষ্কার রাখি; জ্যামিতি ধীরে ধীরে NN শেখে
  const geomNnW = clamp(0.2 + n / 90, 0.2, 0.68);
  const styleNnW = clamp(0.12 + n / 120, 0.12, 0.55);

  return nnOut.map((v, idx) => {
    const isAlign = (idx >= 2 && idx <= 4) || (idx >= 29 && idx <= 31);
    const isColorOrFont = (idx >= 8 && idx <= 21) || (idx >= 35 && idx <= 44);
    const w = isAlign ? 0.15 : isColorOrFont ? styleNnW : geomNnW;
    return clamp(v * w + cOut[idx] * (1 - w), 0.02, 0.98);
  });
}

export async function predictDesignWithNN({ vision, layers, includeUserTaste = true }) {
  try {
    const customSamples = loadCustomSamples();
    if (!customSamples.length) return null;

    const tf = await getTf();
    const actor = await ensureActorModel();
    const xVec = await extractFeatureVectorForDesign({ vision, layers });

    const nnOut = tf.tidy(() => {
      const emb = tf.tensor2d([xVec.slice(0, EMB_DIM)], [1, EMB_DIM]);
      const ctx = tf.tensor2d([xVec.slice(EMB_DIM)], [1, CTX_DIM]);
      const pred = actor.predict([emb, ctx]);
      return Array.from(pred.dataSync());
    });

    const cluster = computeClusterAttention(xVec, customSamples);
    const primaryOut = enforceRegionContrast(blendActorWithCluster(nnOut, cluster), vision);

    const candidates = [primaryOut];
    if (cluster?.rankedPrototypes?.length) {
      for (const proto of cluster.rankedPrototypes.slice(0, 3)) {
        candidates.push(enforceRegionContrast(proto, vision));
      }
    }

    const blendedScores = await computeBlendedTasteScores(tf, xVec, candidates, {
      includeUserTaste
    });
    if (!blendedScores) {
      return decodePredictionVector(primaryOut, null);
    }

    let bestIdx = 0;
    for (let i = 1; i < blendedScores.length; i++) {
      if (blendedScores[i] > blendedScores[bestIdx] + 0.04) {
        bestIdx = i;
      }
    }

    return decodePredictionVector(candidates[bestIdx], Number(blendedScores[bestIdx].toFixed(3)));
  } catch {
    return null;
  }
}

export async function generateExploratoryPrediction({
  vision,
  layers,
  rejectedVectors = [],
  includeUserTaste = true
}) {
  const tf = await getTf();
  const actor = await ensureActorModel();
  const customSamples = loadCustomSamples();
  const trained = customSamples.length > 0;
  const xVec = await extractFeatureVectorForDesign({ vision, layers });

  let primaryOut = null;
  let cluster = null;

  if (trained) {
    const nnOut = tf.tidy(() => {
      const emb = tf.tensor2d([xVec.slice(0, EMB_DIM)], [1, EMB_DIM]);
      const ctx = tf.tensor2d([xVec.slice(EMB_DIM)], [1, CTX_DIM]);
      const pred = actor.predict([emb, ctx]);
      return Array.from(pred.dataSync());
    });
    cluster = computeClusterAttention(xVec, customSamples);
    primaryOut = blendActorWithCluster(nnOut, cluster);
  }

  const candidates = [];

  if (primaryOut) {
    candidates.push(enforceRegionContrast(primaryOut, vision));
    if (cluster?.rankedPrototypes?.length) {
      for (const p of cluster.rankedPrototypes) {
        candidates.push(enforceRegionContrast(p, vision));
      }
    }

    const basePool = cluster?.rankedPrototypes?.length
      ? [primaryOut, ...cluster.rankedPrototypes.slice(0, 3)]
      : [primaryOut];

    for (let t = 0; t < 10; t++) {
      const src = basePool[t % basePool.length];
      const vec = [...src];
      vec[0] = clamp(src[0] + (Math.random() - 0.5) * 0.28, 0.08, 0.92);
      vec[1] = clamp(src[1] + (Math.random() - 0.5) * 0.34, 0.08, 0.92);
      vec[27] = clamp(src[27] + (Math.random() - 0.5) * 0.28, 0.08, 0.92);
      vec[28] = clamp(src[28] + (Math.random() - 0.5) * 0.34, 0.08, 0.92);
      vec[6] = clamp(src[6] + (Math.random() - 0.5) * 0.14, 0.08, 0.92);
      vec[33] = clamp(src[33] + (Math.random() - 0.5) * 0.14, 0.08, 0.92);

      if (t % 3 !== 0) {
        const hCls = Math.floor(Math.random() * 3);
        vec[2] = hCls === 0 ? 0.92 : 0.08;
        vec[3] = hCls === 1 ? 0.92 : 0.08;
        vec[4] = hCls === 2 ? 0.92 : 0.08;
        vec[29] = vec[2];
        vec[30] = vec[3];
        vec[31] = vec[4];
      }
      candidates.push(enforceRegionContrast(vec, vision));
    }
  } else {
    const pal = Array.isArray(vision?.palette) && vision.palette.length
      ? vision.palette.map((p) => parseColorRgb(p.hex)).filter(Boolean)
      : [{ r: 248, g: 250, b: 252 }];

    for (let trial = 0; trial < 12; trial++) {
      const vec = new Array(OUTPUT_DIM).fill(0.5);
      const col = pal[trial % pal.length] || { r: 248, g: 250, b: 252 };
      vec[0] = 0.2 + Math.random() * 0.6;
      vec[1] = 0.18 + Math.random() * 0.58;
      vec[27] = vec[0];
      vec[28] = clamp(vec[1] + 0.16, 0.12, 0.9);
      const cls = trial % 3;
      vec[2] = cls === 0 ? 0.92 : 0.08;
      vec[3] = cls === 1 ? 0.92 : 0.08;
      vec[4] = cls === 2 ? 0.92 : 0.08;
      vec[29] = vec[2];
      vec[30] = vec[3];
      vec[31] = vec[4];
      vec[5] = 0.72;
      vec[32] = 0.68;
      vec[6] = 0.3 + Math.random() * 0.35;
      vec[33] = 0.25 + Math.random() * 0.25;
      vec[8] = col.r / 255;
      vec[9] = col.g / 255;
      vec[10] = col.b / 255;
      vec[35] = col.r / 255;
      vec[36] = col.g / 255;
      vec[37] = col.b / 255;
      vec[11] = 0.08;
      vec[15] = 0.08;
      vec[38] = 0.08;
      vec[22] = 0.78;
      vec[23] = 0.4;
      vec[24] = 0;
      vec[25] = 0;
      vec[26] = 0;
      candidates.push(enforceRegionContrast(vec, vision));
    }
  }

  const tasteScores = await computeBlendedTasteScores(tf, xVec, candidates, {
    includeUserTaste
  });

  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const vec = candidates[i];
    let minDist = 1;
    if (rejectedVectors.length > 0) {
      minDist = Infinity;
      for (const rejItem of rejectedVectors.slice(-10)) {
        const rej = Array.isArray(rejItem) ? rejItem : rejItem?.rawVector;
        if (!Array.isArray(rej) || rej.length !== vec.length) continue;
        let d = 0;
        for (let k = 0; k < vec.length; k++) {
          const diff = vec[k] - rej[k];
          d += diff * diff;
        }
        if (d < minDist) minDist = d;
      }
      if (!Number.isFinite(minDist)) minDist = 1;
    }

    const tScore = tasteScores ? tasteScores[i] : 0.5;
    const combined = (tasteScores ? tScore * 1.6 : 0) + Math.min(2.0, minDist) * 0.75;
    if (combined > bestScore) {
      bestScore = combined;
      bestIdx = i;
    }
  }

  const finalScore = tasteScores ? Number(tasteScores[bestIdx].toFixed(3)) : null;
  return decodePredictionVector(candidates[bestIdx], finalScore);
}

async function retrainOwnerModels(tf, custom, criticSamples) {
  const actor = createFreshActorModel(tf);
  let loss = 0;
  if (custom.length > 0) {
    loss = await trainActorOnSamples(tf, actor, custom);
    try {
      await actor.save(IDB_ACTOR_URL);
    } catch {}
  } else {
    try {
      await tf.io.removeModel(IDB_ACTOR_URL);
    } catch {}
  }
  cachedActor = actor;
  actorPromise = Promise.resolve(actor);

  const critic = createFreshCriticModel(tf);
  if (criticSamples.length >= 2) {
    await trainCriticOnSamples(tf, critic, criticSamples);
    try {
      await critic.save(IDB_CRITIC_URL);
    } catch {}
  } else {
    try {
      await tf.io.removeModel(IDB_CRITIC_URL);
    } catch {}
  }
  cachedCritic = critic;
  criticPromise = Promise.resolve(critic);

  return Number(loss.toFixed(4));
}

export async function trainNeuralWithCurrentDesign({ vision, layers, bgConfig }) {
  const tf = await getTf();
  const fontDnaMap = await getFontDnaCatalog();

  const x = await extractFeatureVectorForDesign({ vision, layers });
  const y = extractTargetLabelsFromDesign({ vision, layers, fontDnaMap, bgConfig });
  if (!y) {
    throw new Error('শেখানোর জন্য ক্যানভাসে অন্তত একটি টেক্সট থাকতে হবে');
  }

  const now = Date.now();
  const custom = loadCustomSamples();
  custom.push({ x, y, at: now });
  saveCustomSamples(custom);

  const criticSamples = loadCriticSamples();
  criticSamples.push({ x, y, score: 1, at: now });
  saveCriticSamples(criticSamples);

  let loss = 0;
  if (custom.length <= 35) {
    loss = await retrainOwnerModels(tf, custom, criticSamples);
  } else {
    const actor = await ensureActorModel();
    const critic = await ensureCriticModel();
    loss = Number((await trainActorOnSamples(tf, actor, custom)).toFixed(4));
    try {
      await actor.save(IDB_ACTOR_URL);
    } catch {}
    if (criticSamples.length >= 2) {
      await trainCriticOnSamples(tf, critic, criticSamples);
      try {
        await critic.save(IDB_CRITIC_URL);
      } catch {}
    }
  }

  return {
    totalTrained: custom.length,
    loss,
    criticStats: getCriticStats()
  };
}

export async function rejectDesignForCritic({ vision, layers, rawVector }) {
  if (!Array.isArray(rawVector) || rawVector.length !== OUTPUT_DIM) {
    return getCriticStats();
  }
  const tf = await getTf();
  const critic = await ensureCriticModel();
  const x = await extractFeatureVectorForDesign({ vision, layers });

  const criticSamples = loadCriticSamples();
  criticSamples.push({ x, y: rawVector, score: 0, at: Date.now() });
  saveCriticSamples(criticSamples);

  if (criticSamples.length >= 2) {
    await trainCriticOnSamples(tf, critic, criticSamples);
    try {
      await critic.save(IDB_CRITIC_URL);
    } catch {}
  }

  return getCriticStats();
}

export async function undoLastNeuralSample() {
  const tf = await getTf();
  const custom = loadCustomSamples();
  if (!custom.length) {
    return { totalTrained: 0, loss: 0 };
  }
  const removed = custom.pop();
  saveCustomSamples(custom);

  const criticSamples = loadCriticSamples();
  const matchIdx = criticSamples.findIndex((c) => c?.at && removed?.at && c.at === removed.at);
  if (matchIdx >= 0) {
    criticSamples.splice(matchIdx, 1);
  } else {
    for (let i = criticSamples.length - 1; i >= 0; i--) {
      if (criticSamples[i]?.score === 1) {
        criticSamples.splice(i, 1);
        break;
      }
    }
  }
  saveCriticSamples(criticSamples);

  const loss = await retrainOwnerModels(tf, custom, criticSamples);
  return {
    totalTrained: custom.length,
    loss
  };
}

export function getOwnerDatasetPayload() {
  return {
    version: 'v12-actor-critic',
    updatedAt: Date.now(),
    samples: loadCustomSamples(),
    criticSamples: loadCriticSamples()
  };
}

export async function applyOwnerDatasetFromDrive(remoteData) {
  const list = Array.isArray(remoteData) ? remoteData : remoteData?.samples;
  if (!Array.isArray(list)) {
    throw new Error('Drive-এ সঠিক ডাটা পাওয়া যায়নি');
  }

  const valid = list.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM
  );

  const rawCritic = Array.isArray(remoteData?.criticSamples) ? remoteData.criticSamples : [];
  const validCritic = rawCritic.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM &&
      typeof s?.score === 'number'
  );

  saveCustomSamples(valid);
  saveCriticSamples(validCritic);

  const tf = await getTf();
  const loss = await retrainOwnerModels(tf, valid, validCritic);

  return {
    totalTrained: valid.length,
    loss,
    criticStats: getCriticStats()
  };
}

export function listOwnerSamplesSummary() {
  const samples = loadCustomSamples();
  return samples.map((s, idx) => {
    const y = s.y || [];
    const hx = Math.round((y[0] ?? 0.5) * 100);
    const hy = Math.round((y[1] ?? 0.5) * 100);
    const hAlign = decodeAlignOneHot(y[2] ?? 0, y[3] ?? 1, y[4] ?? 0);
    return {
      index: idx,
      at: s.at || 0,
      summary: `#${idx + 1} • (${hx}%, ${hy}%) • ${hAlign}`
    };
  });
}

export async function deleteOwnerSampleAt(index) {
  const custom = loadCustomSamples();
  if (index < 0 || index >= custom.length) {
    return { totalTrained: custom.length, loss: 0 };
  }
  const [removed] = custom.splice(index, 1);
  saveCustomSamples(custom);

  const criticSamples = loadCriticSamples();
  if (removed?.at) {
    const cIdx = criticSamples.findIndex((c) => c?.at === removed.at);
    if (cIdx >= 0) criticSamples.splice(cIdx, 1);
  }
  saveCriticSamples(criticSamples);

  const tf = await getTf();
  const loss = await retrainOwnerModels(tf, custom, criticSamples);
  return {
    totalTrained: custom.length,
    loss,
    criticStats: getCriticStats()
  };
}

export function exportTrainingDatasetJson() {
  const payload = getOwnerDatasetPayload();
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'adnans_owner_db_v12.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return payload.samples.length;
}

export async function importTrainingDatasetJson(fileText) {
  const parsed = JSON.parse(fileText);
  return applyOwnerDatasetFromDrive(parsed);
}

export async function resetNeuralTraining() {
  const tf = await getTf();
  try {
    localStorage.removeItem(CUSTOM_SAMPLES_KEY);
    localStorage.removeItem(CUSTOM_CRITIC_KEY);
    localStorage.removeItem(LEGACY_SAMPLES_KEY_V11);
    localStorage.removeItem(LEGACY_CRITIC_KEY_V11);
  } catch {}
  try {
    await tf.io.removeModel(IDB_ACTOR_URL);
  } catch {}
  try {
    await tf.io.removeModel(IDB_CRITIC_URL);
  } catch {}

  const actor = createFreshActorModel(tf);
  cachedActor = actor;
  actorPromise = Promise.resolve(actor);

  const critic = createFreshCriticModel(tf);
  cachedCritic = critic;
  criticPromise = Promise.resolve(critic);
  return true;
}
