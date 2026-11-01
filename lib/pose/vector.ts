import { ExtractedPose, NormalizedKeypoint, PoseReference, Vec } from './types';

// Keypoint indices for upper-body photobooth poses
export const UPPER_BODY_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24];

// Bone connections for rendering upper body skeleton overlay
export const UPPER_BODY_BONES: [number, number][] = [
  // Head
  [0, 11],
  [0, 12],
  // Shoulders
  [11, 12],
  // Left arm (Shoulder -> Elbow -> Wrist)
  [11, 13],
  [13, 15],
  // Right arm (Shoulder -> Elbow -> Wrist)
  [12, 14],
  [14, 16],
  // Torso (Shoulders to Hips)
  [11, 23],
  [12, 24],
  [23, 24],
];

/**
 * Extracts normalized vector and screen-space skeleton from MediaPipe landmarks
 */
export function extractPose(
  rawLandmarks: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>,
  mirrorX: boolean = true
): ExtractedPose | null {
  if (!rawLandmarks || rawLandmarks.length === 0) return null;

  // Convert landmarks into normalized screen coordinates
  const persons = rawLandmarks
    .map((person) =>
      person.map((pt) => ({
        x: mirrorX ? 1 - pt.x : pt.x,
        y: pt.y,
        v: pt.visibility !== undefined ? pt.visibility : 1,
      }))
    )
    // Sort persons left-to-right on screen based on shoulder center
    .sort((a, b) => {
      const ax = (a[11]?.x ?? 0.5) + (a[12]?.x ?? 0.5);
      const bx = (b[11]?.x ?? 0.5) + (b[12]?.x ?? 0.5);
      return ax - bx;
    });

  // Calculate group center and average scale (shoulder width / torso)
  let sumCx = 0;
  let sumCy = 0;
  let sumScale = 0;

  for (const p of persons) {
    const sL = p[11] || { x: 0.4, y: 0.3 };
    const sR = p[12] || { x: 0.6, y: 0.3 };
    const hL = p[23] || { x: 0.45, y: 0.7 };
    const hR = p[24] || { x: 0.55, y: 0.7 };

    // Torso center
    const cx = (sL.x + sR.x + hL.x + hR.x) / 4;
    const cy = (sL.y + sR.y + hL.y + hR.y) / 4;
    sumCx += cx;
    sumCy += cy;

    // Scale based on shoulder width and torso height
    const shoulderWidth = Math.hypot(sL.x - sR.x, sL.y - sR.y);
    const torsoHeight = Math.hypot((sL.x + sR.x) / 2 - (hL.x + hR.x) / 2, (sL.y + sR.y) / 2 - (hL.y + hR.y) / 2);
    sumScale += shoulderWidth + torsoHeight * 0.5 || 0.3;
  }

  const groupCx = sumCx / persons.length;
  const groupCy = sumCy / persons.length;
  const groupScale = sumScale / persons.length || 0.3;

  const vec: Vec = [];
  const skeleton: NormalizedKeypoint[][] = [];

  for (const p of persons) {
    const personPoints: NormalizedKeypoint[] = [];
    for (let idx = 0; idx < p.length; idx++) {
      personPoints.push({
        x: p[idx].x,
        y: p[idx].y,
        v: p[idx].v,
      });
    }
    skeleton.push(personPoints);

    // Build vector for distance matching
    for (const i of UPPER_BODY_INDICES) {
      const pt = p[i];
      if (!pt) {
        vec.push(0, 0);
        continue;
      }
      const weight = (pt.v ?? 1) > 0.3 ? 1 : 0;
      const relX = ((pt.x - groupCx) / groupScale) * weight;
      const relY = ((pt.y - groupCy) / groupScale) * weight;
      vec.push(relX, relY);
    }
  }

  return {
    vec,
    people: persons.length,
    landmarks: skeleton,
  };
}

/**
 * Calculates normalized root-mean-square distance between two pose vectors
 */
export function calculatePoseDistance(vecA: Vec, vecB: Vec): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 999;
  let sumSq = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / vecA.length);
}

/**
 * Suggests the next pose for the session:
 * - Matches current group size (people count)
 * - Excludes poses already used in this session
 * - Prioritizes poses that are distinct (distance >= minDiffThreshold) from previous shot
 */
export function suggestNextPose(
  lastPoseVec: Vec | null,
  usedPoseIds: string[],
  library: PoseReference[],
  peopleCount: number = 1,
  minDiffThreshold: number = 0.3
): PoseReference | null {
  // Find candidates for the target people count (or fallback to closest)
  let candidates = library.filter((p) => p.people === peopleCount && !usedPoseIds.includes(p.id));

  // If all poses for this count are exhausted, allow reusing except the immediate last one
  if (candidates.length === 0) {
    const lastId = usedPoseIds[usedPoseIds.length - 1];
    candidates = library.filter((p) => p.people === peopleCount && p.id !== lastId);
  }

  // If still none, fallback to 1-person pose
  if (candidates.length === 0) {
    candidates = library.filter((p) => !usedPoseIds.includes(p.id));
  }

  if (candidates.length === 0) return null;

  // If no last pose vector, pick the first or random candidate
  if (!lastPoseVec) {
    return candidates[0] || null;
  }

  // Score distance against last pose
  const scored = candidates.map((p) => {
    const dist = calculatePoseDistance(lastPoseVec, p.vec);
    return { pose: p, dist };
  });

  // Filter distinct poses
  const distinct = scored.filter((s) => s.dist >= minDiffThreshold);
  const pool = distinct.length > 0 ? distinct : scored;

  // Sort descending by distance so we suggest fresh, different poses
  pool.sort((a, b) => b.dist - a.dist);

  return pool[0]?.pose || candidates[0];
}

/**
 * Check if current live pose matches a reference pose
 * Returns match status and similarity percentage
 */
export function checkPoseMatch(
  currentVec: Vec | null,
  targetVec: Vec | null,
  threshold: number = 0.28
): { isMatched: boolean; score: number } {
  if (!currentVec || !targetVec || currentVec.length !== targetVec.length) {
    return { isMatched: false, score: 0 };
  }

  const dist = calculatePoseDistance(currentVec, targetVec);
  // Transform distance to percentage (0 distance = 100%, 0.5+ distance = 0%)
  const score = Math.max(0, Math.min(100, Math.round((1 - dist / 0.5) * 100)));
  const isMatched = dist <= threshold;

  return { isMatched, score };
}

// Session-level tracking across shots in a photobooth strip
let sessionUsedPoseIds: string[] = [];
let sessionLastPoseVec: Vec | null = null;

export function recordShotPose(poseId?: string, vec?: Vec | null) {
  if (poseId && !sessionUsedPoseIds.includes(poseId)) {
    sessionUsedPoseIds.push(poseId);
  }
  if (vec) {
    sessionLastPoseVec = vec;
  }
}

export function getSessionPoseState() {
  return {
    usedIds: [...sessionUsedPoseIds],
    lastVec: sessionLastPoseVec,
  };
}

export function resetSessionPoseState() {
  sessionUsedPoseIds = [];
  sessionLastPoseVec = null;
}

