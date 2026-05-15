import { TimestampedChunk } from '@/types/live-photo';

/**
 * Merges an array of timestamped chunks into a single video Blob.
 * 
 * IMPORTANT: The first chunk in the recording session contains the WebM/container
 * header. Without it, the video is unplayable. We always include all chunks from
 * the start of the buffer to ensure the header is present.
 */
export function mergeChunks(
  chunks: TimestampedChunk[],
  captureTime: number,
  beforeMs: number = 2000,
  afterMs: number = 2000
): Blob {
  if (chunks.length === 0) {
    return new Blob([], { type: 'video/webm' });
  }

  const endTime = captureTime + afterMs;

  // Include all chunks from the beginning (to preserve the WebM header)
  // up to the end time. The pruning already ensures we only have ~3s of old data.
  const relevantChunks = chunks.filter(
    (chunk) => chunk.timestamp <= endTime
  );

  const blobs = relevantChunks.map((chunk) => chunk.blob);
  const mimeType = blobs.length > 0 ? blobs[0].type : 'video/webm';

  return new Blob(blobs, { type: mimeType });
}

/**
 * Filters chunks to only keep those within a time window.
 * Used for the rolling buffer cleanup.
 */
export function pruneChunks(
  chunks: TimestampedChunk[],
  maxAgeMs: number = 3000
): TimestampedChunk[] {
  const cutoff = Date.now() - maxAgeMs;
  return chunks.filter((chunk) => chunk.timestamp >= cutoff);
}
