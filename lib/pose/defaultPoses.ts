import { NormalizedKeypoint, PoseReference } from './types';
import { extractPose } from './vector';

function createBlankPerson(): NormalizedKeypoint[] {
  // Array of 33 keypoints initialized to center
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 }));
}

// Helper to configure a person's upper body points
function buildUpperBody(params: {
  head?: { x: number; y: number };
  shoulderL?: { x: number; y: number };
  shoulderR?: { x: number; y: number };
  elbowL?: { x: number; y: number };
  elbowR?: { x: number; y: number };
  wristL?: { x: number; y: number };
  wristR?: { x: number; y: number };
  hipL?: { x: number; y: number };
  hipR?: { x: number; y: number };
}): NormalizedKeypoint[] {
  const pts = createBlankPerson();
  const {
    head = { x: 0.5, y: 0.25 },
    shoulderL = { x: 0.4, y: 0.4 },
    shoulderR = { x: 0.6, y: 0.4 },
    elbowL = { x: 0.35, y: 0.55 },
    elbowR = { x: 0.65, y: 0.55 },
    wristL = { x: 0.35, y: 0.7 },
    wristR = { x: 0.65, y: 0.7 },
    hipL = { x: 0.43, y: 0.8 },
    hipR = { x: 0.57, y: 0.8 },
  } = params;

  pts[0] = { ...head, v: 1 };
  pts[11] = { ...shoulderL, v: 1 };
  pts[12] = { ...shoulderR, v: 1 };
  pts[13] = { ...elbowL, v: 1 };
  pts[14] = { ...elbowR, v: 1 };
  pts[15] = { ...wristL, v: 1 };
  pts[16] = { ...wristR, v: 1 };
  pts[23] = { ...hipL, v: 1 };
  pts[24] = { ...hipR, v: 1 };

  return pts;
}

// 1. Cheek Heart (Tangan kanan di pipi half heart)
const soloCheekHeart = buildUpperBody({
  head: { x: 0.5, y: 0.28 },
  shoulderL: { x: 0.4, y: 0.45 },
  shoulderR: { x: 0.6, y: 0.45 },
  elbowL: { x: 0.32, y: 0.65 },
  elbowR: { x: 0.68, y: 0.48 },
  wristL: { x: 0.32, y: 0.8 },
  wristR: { x: 0.56, y: 0.32 }, // right hand touching right cheek
});

// 2. Double Peace (Dua tangan tanda V di dekat wajah)
const soloDoublePeace = buildUpperBody({
  head: { x: 0.5, y: 0.28 },
  shoulderL: { x: 0.38, y: 0.48 },
  shoulderR: { x: 0.62, y: 0.48 },
  elbowL: { x: 0.28, y: 0.42 },
  elbowR: { x: 0.72, y: 0.42 },
  wristL: { x: 0.32, y: 0.26 }, // V sign near left eye
  wristR: { x: 0.68, y: 0.26 }, // V sign near right eye
});

// 3. Cat Paws (Dua kepalan tangan di samping dagu)
const soloCatPaws = buildUpperBody({
  head: { x: 0.5, y: 0.28 },
  shoulderL: { x: 0.39, y: 0.46 },
  shoulderR: { x: 0.61, y: 0.46 },
  elbowL: { x: 0.32, y: 0.52 },
  elbowR: { x: 0.68, y: 0.52 },
  wristL: { x: 0.41, y: 0.36 }, // near left chin
  wristR: { x: 0.59, y: 0.36 }, // near right chin
});

// 4. Cool Chin / Thinker (Satu tangan menopang dagu)
const soloCoolChin = buildUpperBody({
  head: { x: 0.5, y: 0.27 },
  shoulderL: { x: 0.38, y: 0.46 },
  shoulderR: { x: 0.62, y: 0.46 },
  elbowL: { x: 0.45, y: 0.58 },
  elbowR: { x: 0.66, y: 0.65 },
  wristL: { x: 0.5, y: 0.34 }, // under chin
  wristR: { x: 0.68, y: 0.75 },
});

// 5. Flower Hands (Dua tangan di bawah dagu)
const soloFlower = buildUpperBody({
  head: { x: 0.5, y: 0.26 },
  shoulderL: { x: 0.38, y: 0.47 },
  shoulderR: { x: 0.62, y: 0.47 },
  elbowL: { x: 0.34, y: 0.58 },
  elbowR: { x: 0.66, y: 0.58 },
  wristL: { x: 0.46, y: 0.35 },
  wristR: { x: 0.54, y: 0.35 },
});

// --- DUO POSES ---

// Duo Big Heart (Orang kiri & kanan membentuk satu hati besar di atas kepala)
const duoBigHeartPersonL = buildUpperBody({
  head: { x: 0.35, y: 0.34 },
  shoulderL: { x: 0.26, y: 0.48 },
  shoulderR: { x: 0.44, y: 0.48 },
  elbowL: { x: 0.24, y: 0.32 },
  elbowR: { x: 0.46, y: 0.65 },
  wristL: { x: 0.45, y: 0.16 }, // curved over head toward center
  wristR: { x: 0.48, y: 0.75 },
});

const duoBigHeartPersonR = buildUpperBody({
  head: { x: 0.65, y: 0.34 },
  shoulderL: { x: 0.56, y: 0.48 },
  shoulderR: { x: 0.74, y: 0.48 },
  elbowL: { x: 0.54, y: 0.65 },
  elbowR: { x: 0.76, y: 0.32 },
  wristL: { x: 0.52, y: 0.75 },
  wristR: { x: 0.55, y: 0.16 }, // curved over head toward center
});

// Duo Cheek Poke (Saling colek pipi teman)
const duoCheekPokePersonL = buildUpperBody({
  head: { x: 0.36, y: 0.32 },
  shoulderL: { x: 0.27, y: 0.47 },
  shoulderR: { x: 0.45, y: 0.47 },
  elbowL: { x: 0.24, y: 0.65 },
  elbowR: { x: 0.52, y: 0.45 },
  wristL: { x: 0.22, y: 0.78 },
  wristR: { x: 0.61, y: 0.33 }, // poking person R cheek
});

const duoCheekPokePersonR = buildUpperBody({
  head: { x: 0.64, y: 0.32 },
  shoulderL: { x: 0.55, y: 0.47 },
  shoulderR: { x: 0.73, y: 0.47 },
  elbowL: { x: 0.48, y: 0.45 },
  elbowR: { x: 0.76, y: 0.65 },
  wristL: { x: 0.39, y: 0.33 }, // poking person L cheek
  wristR: { x: 0.78, y: 0.78 },
});

// Duo Shoulder Hug (Merangkul bahu satu sama lain)
const duoShoulderHugL = buildUpperBody({
  head: { x: 0.38, y: 0.33 },
  shoulderL: { x: 0.3, y: 0.48 },
  shoulderR: { x: 0.46, y: 0.48 },
  elbowL: { x: 0.26, y: 0.66 },
  elbowR: { x: 0.52, y: 0.46 },
  wristL: { x: 0.25, y: 0.78 },
  wristR: { x: 0.58, y: 0.46 }, // arm around R's shoulder
});

const duoShoulderHugR = buildUpperBody({
  head: { x: 0.62, y: 0.33 },
  shoulderL: { x: 0.54, y: 0.48 },
  shoulderR: { x: 0.7, y: 0.48 },
  elbowL: { x: 0.48, y: 0.46 },
  elbowR: { x: 0.74, y: 0.66 },
  wristL: { x: 0.42, y: 0.46 }, // arm around L's shoulder
  wristR: { x: 0.75, y: 0.78 },
});

// --- GROUP POSES (3 Persons) ---

// Group Cheers / Wave
const groupCheersL = buildUpperBody({
  head: { x: 0.25, y: 0.35 },
  shoulderL: { x: 0.18, y: 0.49 },
  shoulderR: { x: 0.32, y: 0.49 },
  elbowL: { x: 0.14, y: 0.36 },
  elbowR: { x: 0.34, y: 0.62 },
  wristL: { x: 0.12, y: 0.22 }, // waving hand high
  wristR: { x: 0.36, y: 0.75 },
});

const groupCheersC = buildUpperBody({
  head: { x: 0.5, y: 0.3 },
  shoulderL: { x: 0.42, y: 0.45 },
  shoulderR: { x: 0.58, y: 0.45 },
  elbowL: { x: 0.38, y: 0.35 },
  elbowR: { x: 0.62, y: 0.35 },
  wristL: { x: 0.38, y: 0.2 }, // both hands in air
  wristR: { x: 0.62, y: 0.2 },
});

const groupCheersR = buildUpperBody({
  head: { x: 0.75, y: 0.35 },
  shoulderL: { x: 0.68, y: 0.49 },
  shoulderR: { x: 0.82, y: 0.49 },
  elbowL: { x: 0.66, y: 0.62 },
  elbowR: { x: 0.86, y: 0.36 },
  wristL: { x: 0.64, y: 0.75 },
  wristR: { x: 0.88, y: 0.22 }, // waving hand high
});

function createPoseEntry(
  id: string,
  name: string,
  description: string,
  category: PoseReference['category'],
  emoji: string,
  skeletons: NormalizedKeypoint[][]
): PoseReference {
  const extracted = extractPose(skeletons, false);
  return {
    id,
    name,
    description,
    category,
    emoji,
    people: skeletons.length,
    vec: extracted?.vec || [],
    skeleton: skeletons,
  };
}

export const DEFAULT_POSES: PoseReference[] = [
  // Solo
  createPoseEntry(
    'solo-cheek-heart',
    'Cheek Heart',
    'Satu tangan di pipi membentuk separuh hati',
    'cute',
    '🫶',
    [[...soloCheekHeart]]
  ),
  createPoseEntry(
    'solo-double-peace',
    'Double Peace',
    'Dua tangan tanda peace di dekat mata/wajah',
    'cute',
    '✌️',
    [[...soloDoublePeace]]
  ),
  createPoseEntry(
    'solo-cat-paws',
    'Cat Paws',
    'Kedua tangan mengepal manis di samping dagu',
    'cute',
    '🐱',
    [[...soloCatPaws]]
  ),
  createPoseEntry(
    'solo-cool-chin',
    'Cool Thinker',
    'Tangan menopang dagu dengan tatapan keren',
    'cool',
    '😎',
    [[...soloCoolChin]]
  ),
  createPoseEntry(
    'solo-flower',
    'Flower Bloom',
    'Dua tangan mekar di bawah dagu seperti bunga',
    'aesthetic',
    '🌸',
    [[...soloFlower]]
  ),

  // Duo
  createPoseEntry(
    'duo-big-heart',
    'Big Love Arch',
    'Lengan melengkung di atas kepala menyatu jadi bentuk hati',
    'cute',
    '💕',
    [[...duoBigHeartPersonL], [...duoBigHeartPersonR]]
  ),
  createPoseEntry(
    'duo-cheek-poke',
    'Colek Pipi',
    'Saling mencolek pipi satu sama lain',
    'funny',
    '👉',
    [[...duoCheekPokePersonL], [...duoCheekPokePersonR]]
  ),
  createPoseEntry(
    'duo-shoulder-hug',
    'Rangkul Sahabat',
    'Saling merangkul bahu tanda kebersamaan',
    'cool',
    '🫂',
    [[...duoShoulderHugL], [...duoShoulderHugR]]
  ),

  // Group
  createPoseEntry(
    'group-cheers',
    'Party Wave',
    'Tangan diangkat ke atas merayakan momen bersama',
    'group',
    '🙌',
    [[...groupCheersL], [...groupCheersC], [...groupCheersR]]
  ),
];
