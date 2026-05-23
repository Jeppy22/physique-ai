import type {
  MuscleGroup,
  MuscleGroupAssessment,
  MuscleRating,
} from './types';

const VALID_RATINGS = new Set<MuscleRating>([
  'NEEDS_WORK',
  'DEVELOPING',
  'SOLID',
  'STRONG',
  'STAGE_READY',
]);

export interface ParsedAssistantContent {
  prose: string;
  ratings: MuscleGroupAssessment[] | null;
}

const RATINGS_BLOCK = /```ratings\s*\n([\s\S]*?)```/;
export const RATINGS_FENCE = '```ratings';

/**
 * Returns the portion of an assistant message that should be visible while it
 * streams. Once the ```ratings fence has fully appeared in `content`, the fence
 * and everything after it are hidden from the rendered prose; the parser still
 * sees the full string when streaming finishes.
 */
export function stripRatingsBlockForStream(content: string): string {
  const fenceIndex = content.indexOf(RATINGS_FENCE);
  if (fenceIndex === -1) return content;
  return content.slice(0, fenceIndex).trimEnd();
}

export function parseAssistantContent(raw: string): ParsedAssistantContent {
  const match = raw.match(RATINGS_BLOCK);
  if (!match) {
    return { prose: raw, ratings: null };
  }

  const jsonText = match[1].trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { prose: raw.replace(match[0], '').trim(), ratings: null };
  }

  if (!Array.isArray(parsed)) {
    return { prose: raw.replace(match[0], '').trim(), ratings: null };
  }

  const validRatings: MuscleGroupAssessment[] = [];
  for (const item of parsed) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'group' in item &&
      typeof (item as Record<string, unknown>).group === 'string' &&
      'rating' in item &&
      typeof (item as Record<string, unknown>).rating === 'string' &&
      VALID_RATINGS.has((item as Record<string, unknown>).rating as MuscleRating) &&
      'note' in item &&
      typeof (item as Record<string, unknown>).note === 'string'
    ) {
      const obj = item as { group: string; rating: string; note: string };
      validRatings.push({
        group: obj.group as MuscleGroup,
        rating: obj.rating as MuscleRating,
        note: obj.note.slice(0, 200),
      });
    }
  }

  return {
    prose: raw.replace(match[0], '').trim(),
    ratings: validRatings.length > 0 ? validRatings : null,
  };
}
