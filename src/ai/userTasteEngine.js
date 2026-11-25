const USER_TASTE_KEY = 'adnans_user_taste_v11';
const USER_TASTE_IDB_URL = 'indexeddb://adnans-user-taste-v11';

const EMB_DIM = 1280;
const CTX_DIM = 89;
const INPUT_DIM = EMB_DIM + CTX_DIM;
const OUTPUT_DIM = 47;

let tfPromise = null;
let cachedTf = null;
let userModelPromise = null;
let cachedUserModel = null;

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

export function loadUserTasteSamples() {
  try {
    const raw = localStorage.getItem(USER_TASTE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserTasteSamples(list) {
  try {
    localStorage.setItem(USER_TASTE_KEY, JSON.stringify(list.slice(-120)));
  } catch {}
}

export function getUserTasteStats() {
  const list = loadUserTasteSamples();
  let likes = 0;
  let dislikes = 0;
  for (const s of list) {
    if (s?.score >= 0.5) likes++;
    else dislikes++;
  }
  return { total: list.length, likes, dislikes };
}

function createFreshUserTasteModel(tf) {
  const inEmb = tf.input({ shape: [EMB_DIM], name: 'u_emb' });
  const inCtx = tf.input({ shape: [CTX_DIM], name: 'u_ctx' });
  const inDes = tf.input({ shape: [OUTPUT_DIM], name: 'u_des' });

  const embH = tf.layers
    .dense({
      units: 24,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 5e-4 })
    })
    .apply(inEmb);
  const ctxH = tf.layers
    .dense({
      units: 20,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 5e-4 })
    })
    .apply(inCtx);
  const desH = tf.layers
    .dense({
      units: 28,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 5e-4 })
    })
    .apply(inDes);

  const merged = tf.layers.concatenate().apply([embH, ctxH, desH]);
  const hidden = tf.layers
    .dense({
      units: 24,
      activation: 'elu',
      kernelRegularizer: tf.regularizers.l2({ l2: 5e-4 })
    })
    .apply(merged);
  const drop = tf.layers.dropout({ rate: 0.15 }).apply(hidden);
  const score = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(drop);

  const model = tf.model({ inputs: [inEmb, inCtx, inDes], outputs: score });
  model.compile({
    optimizer: tf.train.adam(0.0025),
    loss: 'binaryCrossentropy'
  });
  return model;
}

async function trainUserTasteModel(tf, model, samples = []) {
  const valid = samples.filter(
    (s) =>
      Array.isArray(s?.x) &&
      s.x.length === INPUT_DIM &&
      Array.isArray(s?.y) &&
      s.y.length === OUTPUT_DIM &&
      typeof s?.score === 'number'
  );
  if (!valid.length) return 0;

  const epochs = valid.length < 2 ? 10 : Math.min(45, 16 + valid.length);
  const xsEmb = tf.tensor2d(valid.map((d) => d.x.slice(0, EMB_DIM)), [valid.length, EMB_DIM]);
  const xsCtx = tf.tensor2d(valid.map((d) => d.x.slice(EMB_DIM)), [valid.length, CTX_DIM]);
  const xsDes = tf.tensor2d(valid.map((d) => d.y), [valid.length, OUTPUT_DIM]);
  const ys = tf.tensor2d(valid.map((d) => [d.score]), [valid.length, 1]);

  let finalLoss = 0;
  try {
    const hist = await model.fit([xsEmb, xsCtx, xsDes], ys, {
      epochs,
      batchSize: Math.min(8, valid.length),
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

async function ensureUserTasteModel() {
  if (cachedUserModel) return cachedUserModel;
  if (userModelPromise) return userModelPromise;

  userModelPromise = (async () => {
    const tf = await getTf();
    const samples = loadUserTasteSamples();
    let model = null;

    if (samples.length >= 1) {
      try {
        model = await tf.loadLayersModel(USER_TASTE_IDB_URL);
        model.compile({ optimizer: tf.train.adam(0.0025), loss: 'binaryCrossentropy' });
      } catch {
        model = createFreshUserTasteModel(tf);
        await trainUserTasteModel(tf, model, samples);
        try {
          await model.save(USER_TASTE_IDB_URL);
        } catch {}
      }
    } else {
      model = createFreshUserTasteModel(tf);
    }

    cachedUserModel = model;
    return model;
  })();

  return userModelPromise;
}

export async function recordUserTasteFeedback({ xVec, rawVector, liked }) {
  if (!Array.isArray(xVec) || xVec.length !== INPUT_DIM) {
    throw new Error('ভেক্টর ডাটা পাওয়া যায়নি');
  }
  if (!Array.isArray(rawVector) || rawVector.length !== OUTPUT_DIM) {
    throw new Error('ডিজাইন ডাটা পাওয়া যায়নি');
  }

  const tf = await getTf();
  const model = await ensureUserTasteModel();

  const samples = loadUserTasteSamples();
  samples.push({
    x: xVec,
    y: rawVector,
    score: liked ? 1 : 0,
    at: Date.now()
  });
  saveUserTasteSamples(samples);

  await trainUserTasteModel(tf, model, samples);
  try {
    await model.save(USER_TASTE_IDB_URL);
  } catch {}

  return getUserTasteStats();
}

export async function scoreCandidatesWithUserTaste(xVec, candidates) {
  const samples = loadUserTasteSamples();
  if (!samples.length || !Array.isArray(candidates) || !candidates.length) {
    return null;
  }

  const tf = await getTf();
  const model = await ensureUserTasteModel();

  return tf.tidy(() => {
    const n = candidates.length;
    const embRow = xVec.slice(0, EMB_DIM);
    const ctxRow = xVec.slice(EMB_DIM);
    const embBatch = tf.tensor2d(new Array(n).fill(embRow), [n, EMB_DIM]);
    const ctxBatch = tf.tensor2d(new Array(n).fill(ctxRow), [n, CTX_DIM]);
    const desBatch = tf.tensor2d(candidates, [n, OUTPUT_DIM]);
    const scores = model.predict([embBatch, ctxBatch, desBatch]);
    return Array.from(scores.dataSync());
  });
}

export async function resetUserTasteProfile() {
  const tf = await getTf();
  try {
    localStorage.removeItem(USER_TASTE_KEY);
  } catch {}
  try {
    await tf.io.removeModel(USER_TASTE_IDB_URL);
  } catch {}

  const model = createFreshUserTasteModel(tf);
  cachedUserModel = model;
  userModelPromise = Promise.resolve(model);
  return getUserTasteStats();
}

export function exportUserTasteJson() {
  const samples = loadUserTasteSamples();
  const content = JSON.stringify({ version: 'v11-user-taste', samples }, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'adnans_user_taste_v11.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return samples.length;
}
