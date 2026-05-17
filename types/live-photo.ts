export interface TimestampedChunk {
  blob: Blob;
  timestamp: number;
}

export interface LivePhotoResult {
  photoBlob: Blob;
  photoUrl: string;
  videoBlob: Blob;
  videoUrl: string;
  createdAt: number;
}

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export type RecordingState = 'idle' | 'buffering' | 'capturing' | 'processing';

export interface LivePhotoState {
  stream: MediaStream | null;
  permissionState: PermissionState;
  recordingState: RecordingState;
  capturedPhoto: string | null;
  generatedVideo: string | null;
  isLoading: boolean;
  error: string | null;
  result: LivePhotoResult | null;
}
