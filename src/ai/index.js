import { analyzeCanvasVision } from './visionAnalyzer.js';
import { getFontDnaCatalog, pickBestMatchingFont } from './fontVisionAnalyzer.js';
import {
  extractFeatureVectorForDesign,
  generateExploratoryPrediction,
  getCriticStats,
  hasTrainedModelData,
  predictDesignWithNN,
  rejectDesignForCritic,
  trainNeuralWithCurrentDesign
} from './neuralEngine.js';
import {
  exportUserTasteJson,
  getUserTasteStats,
  recordUserTasteFeedback,
  resetUserTasteProfile
} from './userTasteEngine.js';
import { applyNeuralDesignToLayers, buildNeuralBgPatch } from './layoutEngine.js';

export async function runAiDesignCoach({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 }
}) {
  const [vision, fontDnaMap] = await Promise.all([
    analyzeCanvasVision(bgConfig, canvasSize),
    getFontDnaCatalog()
  ]);

  const isTrained = hasTrainedModelData();
  const nnPrediction = isTrained
    ? await predictDesignWithNN({ vision, layers, includeUserTaste: true })
    : null;

  const unlockedTexts = layers.filter(
    (l) => l.visible !== false && !l.locked && l.type === 'text'
  );
  const headText = [...unlockedTexts].sort((a, b) => a.y - b.y)[0]?.text || '';
  const predictedFont =
    nnPrediction && unlockedTexts.length
      ? pickBestMatchingFont(fontDnaMap, nnPrediction.headFontStyle, {
          needBangla: /[\u0980-\u09FF]/.test(headText),
          rankIndex: 0
        })
      : null;

  return {
    bgSummary: vision.transparent
      ? 'ট্রান্সপারেন্ট ক্যানভাস'
      : vision.isDark
      ? 'গাঢ় ব্যাকগ্রাউন্ড'
      : 'উজ্জ্বল ব্যাকগ্রাউন্ড',
    genreLabel: unlockedTexts.length >= 2 ? 'হেডলাইন + সাবটেক্সট' : 'একক টেক্সট',
    zoneLabel: nnPrediction
      ? `(${Math.round(nnPrediction.headX)}%, ${Math.round(nnPrediction.headY)}%)`
      : 'ট্রেইনিংয়ের অপেক্ষায়',
    palette: vision.palette || [],
    criticStats: getCriticStats(),
    userTasteStats: getUserTasteStats(),
    hasUnlockedText: unlockedTexts.length > 0,
    isTrained,
    predictedFont,
    fontCount: fontDnaMap?.size || 0,
    nnContext: { vision, bgConfig },
    nnPrediction,
    nextBg: buildNeuralBgPatch(bgConfig, nnPrediction),
    applyNeuralDesign: (curLayers, variantIndex = 0) =>
      applyNeuralDesignToLayers({
        curLayers,
        vision,
        nnPrediction,
        fontDnaMap,
        variantIndex
      })
  };
}

export async function generateAiReviewCandidate({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rejectedVectors = [],
  includeUserTaste = true,
  explore = true
}) {
  const [vision, fontDnaMap] = await Promise.all([
    analyzeCanvasVision(bgConfig, canvasSize),
    getFontDnaCatalog()
  ]);

  let pred = null;
  if (!explore && hasTrainedModelData()) {
    pred = await predictDesignWithNN({ vision, layers, includeUserTaste });
  }
  if (!pred) {
    pred = await generateExploratoryPrediction({
      vision,
      layers,
      rejectedVectors,
      includeUserTaste
    });
  }

  const nextLayers = applyNeuralDesignToLayers({
    curLayers: layers,
    vision,
    nnPrediction: pred,
    fontDnaMap,
    variantIndex: 0
  });

  const nextBg = buildNeuralBgPatch(bgConfig, pred);

  return {
    prediction: pred,
    nextLayers,
    nextBg
  };
}

export async function approveAndTrainReviewDesign({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 }
}) {
  const vision = await analyzeCanvasVision(bgConfig, canvasSize);
  return trainNeuralWithCurrentDesign({ vision, layers, bgConfig });
}

export async function rejectAndTrainReviewDesign({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rawVector
}) {
  const vision = await analyzeCanvasVision(bgConfig, canvasSize);
  return rejectDesignForCritic({ vision, layers, rawVector });
}

export async function recordUserDesignFeedback({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rawVector,
  liked
}) {
  const vision = await analyzeCanvasVision(bgConfig, canvasSize);
  const xVec = await extractFeatureVectorForDesign({ vision, layers });
  return recordUserTasteFeedback({ xVec, rawVector, liked });
}

export function getUserPersonalStats() {
  return getUserTasteStats();
}

export function resetUserPersonalTaste() {
  return resetUserTasteProfile();
}

export function exportUserPersonalTaste() {
  return exportUserTasteJson();
}
