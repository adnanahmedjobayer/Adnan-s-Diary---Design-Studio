import { analyzeCanvasVision } from './visionAnalyzer';
import { getFontDnaCatalog, pickBestMatchingFont } from './fontVisionAnalyzer';
import {
  TOTAL_NEURAL_VARIANTS,
  generateExploratoryBatchPredictions,
  generateExploratoryPrediction,
  hasTrainedModelData,
  rejectNeuralDesign,
  trainNeuralWithCurrentDesign
} from './neuralEngine';
import { applyNeuralDesignToLayers, buildNeuralBgPatch } from './layoutEngine';

export async function runAiDesignCoach({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rejectedVectors = []
}) {
  const [vision, fontDnaMap] = await Promise.all([
    analyzeCanvasVision(bgConfig, canvasSize),
    getFontDnaCatalog()
  ]);

  const isTrained = hasTrainedModelData();
  const variantPredictions = await generateExploratoryBatchPredictions({
    vision,
    layers,
    count: TOTAL_NEURAL_VARIANTS,
    rejectedVectors,
    isOwnerReview: false
  });
  const basePrediction = variantPredictions[0];

  const unlockedTexts = layers.filter(
    (l) => l.visible !== false && !l.locked && l.type === 'text'
  );
  const headText = [...unlockedTexts].sort((a, b) => a.y - b.y)[0]?.text || '';
  const predictedFont =
    basePrediction && unlockedTexts.length
      ? pickBestMatchingFont(fontDnaMap, basePrediction.headFontStyle, {
          needBangla: /[\u0980-\u09FF]/.test(headText)
        })
      : null;

  const predY = basePrediction?.targetY ?? 50;
  const zoneLabel = predY < 38 ? 'উপরের অংশ' : predY > 62 ? 'নিচের অংশ' : 'মাঝখান';

  return {
    bgSummary: vision.transparent
      ? 'ট্রান্সপারেন্ট ক্যানভাস'
      : vision.isDark
      ? 'গাঢ় ব্যাকগ্রাউন্ড'
      : 'উজ্জ্বল ব্যাকগ্রাউন্ড',
    zoneLabel,
    genreLabel: 'নিউরাল v11 Actor-Critic',
    palette: vision.palette || [],
    coachIssues: [],
    totalVariants: variantPredictions.length,
    hasUnlockedText: unlockedTexts.length > 0,
    isTrained,
    predictedFont,
    fontCount: fontDnaMap?.size || 0,
    nnContext: { vision, bgConfig },
    nnPrediction: basePrediction,
    variantPredictions,
    nextBg: buildNeuralBgPatch(bgConfig, basePrediction),
    getBgForVariant: (variantIndex = 0) => {
      const pred = variantPredictions[variantIndex % variantPredictions.length] || basePrediction;
      return buildNeuralBgPatch(bgConfig, pred);
    },
    applyNeuralDesign: (curLayers, variantIndex = 0) => {
      const pred = variantPredictions[variantIndex % variantPredictions.length] || basePrediction;
      return applyNeuralDesignToLayers({
        curLayers,
        vision,
        nnPrediction: pred,
        fontDnaMap
      });
    },
    generateNextUserDesign: async (curLayers, userRejectedVectors = []) => {
      const pred = await generateExploratoryPrediction({
        vision,
        layers: curLayers,
        rejectedVectors: userRejectedVectors,
        isOwnerReview: false
      });
      return {
        prediction: pred,
        nextLayers: applyNeuralDesignToLayers({
          curLayers,
          vision,
          nnPrediction: pred,
          fontDnaMap
        }),
        nextBg: buildNeuralBgPatch(bgConfig, pred)
      };
    }
  };
}

export async function generateAiReviewCandidate({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rejectedVectors = [],
  isOwnerReview = false
}) {
  const [vision, fontDnaMap] = await Promise.all([
    analyzeCanvasVision(bgConfig, canvasSize),
    getFontDnaCatalog()
  ]);

  const pred = await generateExploratoryPrediction({
    vision,
    layers,
    rejectedVectors,
    isOwnerReview
  });

  const nextLayers = applyNeuralDesignToLayers({
    curLayers: layers,
    vision,
    nnPrediction: pred,
    fontDnaMap
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

export async function rejectReviewDesign({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  rejectedPrediction
}) {
  const vision = await analyzeCanvasVision(bgConfig, canvasSize);
  return rejectNeuralDesign({ vision, layers, rejectedPrediction });
}
