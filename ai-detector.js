/** * ai-detector.js
 * AI RISK DETECTION ENGINE (TensorFlow.js)
 * Malay/Manglish translation, Severity Tiering (Low/Medium/High), Distress Floor.
 * Performance: IndexedDB anchor caching, precomputed anchor norms, model warmup.
 */

let aiModel = null;
let riskAnchorData = null;
let safeAnchorData = null;
let riskNorms = null;
let safeNorms = null;

// Set true to skip embedding when an explicit keyword already forces "high".
// Faster, but stores finalScore = 1 instead of the real semantic score —
// leave false if you want genuine scores logged for your research data.
const SKIP_EMBED_ON_REGEX = false;

// 1. EXTENSIVE MALAY & MANGLISH SLANG DICTIONARY
const SLANG_MAP = {
  // --- Severe Risk / Suicidal Ideation ---
  "bunuh diri": "commit suicide",
  "bnh diri": "commit suicide",
  "nak mati": "want to die",
  "nk mati": "want to die",
  "mati jela": "better off dead",
  "baik aku mati": "better off dead",
  "tamatkan nyawa": "end my life",
  "kelar tangan": "cut my wrists",
  "toreh tangan": "cut my wrists",
  "terjun bangunan": "jump off a building",
  "penat nak hidup": "tired of living",
  "malas nak hidup": "tired of living",
  "rasa macam beban": "i am a burden",
  "menyusahkan orang": "i am a burden to people",
  "takde function": "i am worthless",
  "tkde function": "i am worthless",
  "kosong": "i feel empty inside",

  // --- Severe Stress / Venting (Academic) ---
  "fyp ni": "this fyp",
  "koyak teruk": "extremely stressed",
  "koyak rabak": "mentally broken",
  "koyak mental": "mentally broken",
  "otak barai": "my brain is fried",
  "barai teruk": "completely destroyed",
  "serabut gila": "extremely stressed",
  "serabut sial": "extremely stressed",
  "serabut doh": "extremely stressed",
  "penat sial": "so tired",
  "penat gila": "so tired",
  "penat doh": "so tired",
  "tak larat": "cannot take it anymore",
  "tk larat": "cannot take it anymore",
  "tlarat": "cannot take it anymore",
  "putus asa": "give up",
  "dah givap": "i give up",
  "dah fedup": "i am fed up",

  // --- Single Word Slang ---
  "koyak": "stressed and broken",
  "barai": "destroyed",
  "rabak": "torn apart",
  "mampus": "dead",
  "matilah": "i am dead",
  "penat": "tired",
  "serabut": "stressed",
  "gila": "crazy",
  "stres": "stressed",
  "tolonglah": "please help",

  // --- Gen-Z / Internet English Slang ---
  "kms": "kill myself",
  "kys": "kill yourself",
  "unalive": "kill",
  "sewerslide": "suicide",
  "acc": "actually",
  "fr": "for real",
  "rn": "right now",
  "gg": "doomed",
  "cooked": "doomed",
  "idek": "i dont even know"
};

// Precompiled slang patterns — built once instead of on every normalizeText() call.
const SLANG_PATTERNS = Object.keys(SLANG_MAP)
  .sort((a, b) => b.length - a.length) // longest first: "nak mati" before "mati"
  .map(slang => ({ re: new RegExp(`\\b${slang}\\b`, 'gi'), replacement: SLANG_MAP[slang] }));

// 2. SEMANTIC ANCHORS
const RISK_ANCHORS = [
  "I want to die", "I want to kill myself", "I am going to commit suicide",
  "ending my life", "no reason to live", "I am worthless",
  "cutting myself", "overdose on pills", "tired of living",
  "self harm", "hurting myself", "I am a burden to everyone"
];

const SAFE_ANCHORS = [
  "another fyp meeting i think im gonna actually kill myself if he tells me to redo it",
  "this exam is going to kill me",
  "this fyp is killing me",
  "literally whats the point of trying so hard if im just gonna fail anyway",
  "my brain is actually fried i cant do this anymore whats the point",
  "if i fail this assignment i am doomed"
];

// 3. REGEX FALLBACK & EVASION CATCHER
const RISK_REGEX = [
  // English Regex
  /suicid/i, /kill\s+(my|me|my\s*self)/i, /end\s+(it|my\s*life)/i,
  /want\s+to\s+die/i, /better\s+off\s+dead/i, /self\s*harm/i, /hurt(ing)?\s*my\s*self/i,
  /sleep\s+forever/i, /can'?t\s+take\s+this\s+pain/i, /unalive/i, /sewerslide/i, /\bkms\b/i,

  // Malay Regex
  /bunuh\s*diri/i, /bnh\s*diri/i, /n[a|k]k?\s*mati/i, /tamat(kan)?\s*nyawa/i,
  /kelar\s*tangan/i, /toreh\s*tangan/i, /terjun\s*bangunan/i, /baik\s*aku\s*mati/i,
  /penat\s*n[a|k]k?\s*hidup/i, /malas\s*n[a|k]k?\s*hidup/i
];

// 4. SEVERITY THRESHOLDS — tune as you collect labeled test data
const THRESHOLDS = {
  HIGH: 0.78,
  MEDIUM: 0.65,
  LOW: 0.45,
  SAFE_VETO: 0.55
};

// Messages shorter than this (ignoring spaces) skip embedding entirely,
// unless regex or the distress floor already matched.
const MIN_LENGTH_FOR_EMBEDDING = 4;

// 4b. DISTRESS FLOOR — severe-stress/venting phrases that translate to plain
// English but sit semantically far from the suicide/self-harm anchors, so they
// often fail to clear LOW on their own. A match floors the tier at "low" so a
// therapist still sees it rather than it vanishing as "none".
const DISTRESS_FLOOR_TERMS = [
  "koyak teruk", "koyak rabak", "koyak mental", "otak barai", "barai teruk",
  "serabut gila", "serabut sial", "serabut doh", "penat sial", "penat gila",
  "penat doh", "tak larat", "tk larat", "tlarat", "putus asa", "dah givap",
  "dah fedup", "rasa macam beban", "menyusahkan orang", "takde function",
  "tkde function", "kosong"
];

const DISTRESS_FLOOR_PATTERNS = DISTRESS_FLOOR_TERMS.map(t => new RegExp(`\\b${t}\\b`, 'i'));

function hasDistressFloor(rawText) {
  const lower = rawText.toLowerCase();
  return DISTRESS_FLOOR_PATTERNS.some(re => re.test(lower));
}

// 5. SMART TEXT NORMALIZATION
function normalizeText(text) {
  let normalized = text.toLowerCase();
  for (const { re, replacement } of SLANG_PATTERNS) {
    re.lastIndex = 0; // reset global regex state between calls
    normalized = normalized.replace(re, replacement);
  }
  return normalized;
}

// 6. MATH HELPERS
// Anchor magnitudes never change, so precompute them once and reuse.
function computeNorms(flatData, count) {
  const norms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    const offset = i * 512;
    for (let j = 0; j < 512; j++) { const v = flatData[offset + j]; sum += v * v; }
    norms[i] = Math.sqrt(sum);
  }
  return norms;
}

function vectorNorm(vec) {
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

// Cosine similarity using precomputed magnitudes — only the dot product per call.
function cosineWithNorms(vec, vecNorm, flatData, anchorIndex, anchorNorm) {
  let dot = 0;
  const offset = anchorIndex * 512;
  for (let i = 0; i < 512; i++) dot += vec[i] * flatData[offset + i];
  return dot / (vecNorm * anchorNorm);
}

// Kept for backward compatibility with any code still calling it directly.
function cosineSimilarity(a, b) {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

// 7. INDEXEDDB CACHE (anchor embeddings)
// Bump the version suffix whenever you EDIT existing anchor text — the
// length checks below only catch anchors being added or removed.
const ANCHOR_CACHE_KEY = "anchors-v1";
const IDB_NAME = "serene-ai-cache";
const IDB_STORE = "embeddings";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbi = req.result;
      if (!dbi.objectStoreNames.contains(IDB_STORE)) dbi.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const dbi = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbi.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.warn("IDB read failed:", e); return null; }
}

async function idbSet(key, value) {
  try {
    const dbi = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbi.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.warn("IDB write failed:", e); return false; }
}

// 8. AI INITIALIZATION (cached anchors + warmup)
async function loadAI() {
  if (aiModel) return;

  try {
    aiModel = await use.load();

    const cached = await idbGet(ANCHOR_CACHE_KEY);
    if (cached && cached.riskLen === RISK_ANCHORS.length && cached.safeLen === SAFE_ANCHORS.length) {
      riskAnchorData = new Float32Array(cached.risk);
      safeAnchorData = new Float32Array(cached.safe);
      console.log("AI Engine: Anchor embeddings loaded from cache.");
    } else {
      console.log("AI Engine: Calculating anchor embeddings...");
      const riskEmb = await aiModel.embed(RISK_ANCHORS);
      const safeEmb = await aiModel.embed(SAFE_ANCHORS);
      riskAnchorData = await riskEmb.data();
      safeAnchorData = await safeEmb.data();
      riskEmb.dispose(); safeEmb.dispose();

      await idbSet(ANCHOR_CACHE_KEY, {
        risk: Array.from(riskAnchorData),
        safe: Array.from(safeAnchorData),
        riskLen: RISK_ANCHORS.length,
        safeLen: SAFE_ANCHORS.length
      });
      console.log("AI Engine: Anchor embeddings calculated and cached.");
    }

    // Precompute anchor magnitudes once
    riskNorms = computeNorms(riskAnchorData, RISK_ANCHORS.length);
    safeNorms = computeNorms(safeAnchorData, SAFE_ANCHORS.length);

    // Warm up the model so the first real message doesn't pay kernel-compile cost
    try { (await aiModel.embed(["warmup"])).dispose(); } catch (e) { /* non-fatal */ }

    document.getElementById("aiDot").className = "status-dot status-ready";
    document.getElementById("aiText").textContent = "AI Active";
  } catch (e) {
    console.error("AI Initialization Error:", e);
    document.getElementById("aiText").textContent = "AI Failed (Regex only)";
    document.getElementById("aiDot").style.backgroundColor = "#ff4d6a";
  }
}

// 9. CORE ANALYSIS
// Returns { finalScore, safeScore, isRegexMatch, riskLevel, isRisk, distressFloor }
// riskLevel: "none" | "low" | "medium" | "high"
async function analyzeRisk(rawText) {
  const cleanText = normalizeText(rawText);
  const distressFloor = hasDistressFloor(rawText);

  let isRegexMatch = false;
  for (const p of RISK_REGEX) {
    if (p.test(cleanText)) { isRegexMatch = true; break; }
  }

  // Optional fast path: regex already forces "high", so skip the model.
  if (SKIP_EMBED_ON_REGEX && isRegexMatch) {
    return { finalScore: 1, safeScore: null, isRegexMatch: true, riskLevel: "high", isRisk: true, distressFloor };
  }

  // AI not loaded — regex-only tiering with distress floor applied
  if (!aiModel || !riskAnchorData || !safeAnchorData || !riskNorms || !safeNorms) {
    const riskLevel = isRegexMatch ? "high" : (distressFloor ? "low" : "none");
    return { finalScore: isRegexMatch ? 1 : 0, safeScore: null, isRegexMatch, riskLevel, isRisk: riskLevel !== "none", distressFloor };
  }

  // Trivially short input can't carry meaningful semantic risk — skip inference.
  if (!isRegexMatch && !distressFloor && cleanText.replace(/\s/g, "").length < MIN_LENGTH_FOR_EMBEDDING) {
    return { finalScore: 0, safeScore: null, isRegexMatch: false, riskLevel: "none", isRisk: false, distressFloor: false };
  }

  try {
    const emb = await aiModel.embed([cleanText]);
    const vec = await emb.data();
    emb.dispose();

    const vecNorm = vectorNorm(vec); // computed once, not per anchor

    let maxRiskScore = 0;
    let maxSafeScore = 0;

    for (let i = 0; i < RISK_ANCHORS.length; i++) {
      const score = cosineWithNorms(vec, vecNorm, riskAnchorData, i, riskNorms[i]);
      if (score > maxRiskScore) maxRiskScore = score;
    }
    for (let i = 0; i < SAFE_ANCHORS.length; i++) {
      const score = cosineWithNorms(vec, vecNorm, safeAnchorData, i, safeNorms[i]);
      if (score > maxSafeScore) maxSafeScore = score;
    }

    let riskLevel;

    // Safe-anchor veto — never overrides an explicit keyword match
    if (!isRegexMatch && maxSafeScore > maxRiskScore && maxSafeScore > THRESHOLDS.SAFE_VETO) {
      console.log(`[AI Veto] Safe:${(maxSafeScore*100).toFixed(1)}% > Risk:${(maxRiskScore*100).toFixed(1)}%`);
      riskLevel = "none";
    } else if (isRegexMatch || maxRiskScore >= THRESHOLDS.HIGH) {
      riskLevel = "high";
    } else if (maxRiskScore >= THRESHOLDS.MEDIUM) {
      riskLevel = "medium";
    } else if (maxRiskScore >= THRESHOLDS.LOW) {
      riskLevel = "low";
    } else {
      riskLevel = "none";
    }

    // Distress floor applied last — lifts "none" to "low" for severe-stress phrases
    if (riskLevel === "none" && distressFloor) riskLevel = "low";

    if (riskLevel !== "none") {
      console.log(`[AI Alert] Level: ${riskLevel.toUpperCase()} | Score: ${(maxRiskScore*100).toFixed(1)}% | Regex: ${isRegexMatch} | DistressFloor: ${distressFloor}`);
    }

    return { finalScore: maxRiskScore, safeScore: maxSafeScore, isRegexMatch, riskLevel, isRisk: riskLevel !== "none", distressFloor };

  } catch (e) {
    console.warn("AI Inference Error:", e);
    const riskLevel = isRegexMatch ? "high" : (distressFloor ? "low" : "none");
    return { finalScore: isRegexMatch ? 1 : 0, safeScore: null, isRegexMatch, riskLevel, isRisk: riskLevel !== "none", distressFloor };
  }
}

// 10. BACKWARD-COMPATIBLE WRAPPER (returns plain boolean)
async function checkRisk(rawText) {
  const result = await analyzeRisk(rawText);
  return result.isRisk;
}