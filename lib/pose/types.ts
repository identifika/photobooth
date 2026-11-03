export type Vec = number[];

export interface NormalizedKeypoint {
  x: number; // 0.0 to 1.0 (relative to container/image width)
  y: number; // 0.0 to 1.0 (relative to container/image height)
  v?: number; // visibility/presence (0.0 to 1.0)
}

export type PoseCategory = 'cute' | 'cool' | 'funny' | 'aesthetic' | 'duo' | 'group' | 'simple';

export interface PoseReference {
  id: string;
  name: string;
  description?: string;
  category: PoseCategory;
  people: number;
  vec: Vec;
  // Skeletons per person (array of persons, each person has array of keypoints)
  skeleton: NormalizedKeypoint[][];
  thumb?: string; // Image thumbnail or emoji
  emoji?: string;
  isCustom?: boolean;
}

export interface ExtractedPose {
  vec: Vec;
  people: number;
  landmarks: NormalizedKeypoint[][];
}

