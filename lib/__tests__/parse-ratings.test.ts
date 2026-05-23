import { describe, it, expect } from 'vitest';
import {
  parseAssistantContent,
  stripRatingsBlockForStream,
} from '../parse-ratings';

describe('parseAssistantContent', () => {
  it('extracts ratings from valid response', () => {
    const raw = `Here is my assessment.

\`\`\`ratings
[
  { "group": "chest", "rating": "SOLID", "note": "good development, fullness present" },
  { "group": "quads", "rating": "NEEDS_WORK", "note": "lacking sweep and inner detail" }
]
\`\`\``;
    const parsed = parseAssistantContent(raw);
    expect(parsed.ratings).toHaveLength(2);
    expect(parsed.ratings![0].group).toBe('chest');
    expect(parsed.ratings![0].rating).toBe('SOLID');
    expect(parsed.prose).not.toContain('```ratings');
    expect(parsed.prose).toContain('Here is my assessment.');
  });

  it('returns null ratings for malformed JSON', () => {
    const raw = `Here is my assessment.\n\n\`\`\`ratings\n[ invalid json \`\`\``;
    const parsed = parseAssistantContent(raw);
    expect(parsed.ratings).toBeNull();
  });

  it('filters out invalid rating values', () => {
    const raw = `text\n\n\`\`\`ratings\n[{"group":"chest","rating":"AMAZING","note":"n"},{"group":"abs","rating":"SOLID","note":"n"}]\n\`\`\``;
    const parsed = parseAssistantContent(raw);
    expect(parsed.ratings).toHaveLength(1);
    expect(parsed.ratings![0].group).toBe('abs');
  });

  it('returns prose only when no ratings block exists', () => {
    const raw = `Just prose, no ratings here.`;
    const parsed = parseAssistantContent(raw);
    expect(parsed.prose).toBe(raw);
    expect(parsed.ratings).toBeNull();
  });
});

describe('stripRatingsBlockForStream', () => {
  it('strips ratings fence and everything after', () => {
    const input = `Here is my assessment.\n\nLots of prose.\n\n\`\`\`ratings\n[{"group":"chest","rating":"SOLID"}]\n\`\`\``;
    expect(stripRatingsBlockForStream(input)).toBe(
      'Here is my assessment.\n\nLots of prose.',
    );
  });

  it('returns content unchanged when no fence is present', () => {
    const input = `Just regular prose, no fence.`;
    expect(stripRatingsBlockForStream(input)).toBe(input);
  });

  it('handles partial fence mid-stream (does not strip until full fence appears)', () => {
    // While the typewriter is mid-typing "```ratings" char by char, indexOf
    // returns -1 until the whole substring lands. We must NOT strip before that.
    const input = `Some prose.\n\n\`\`\`rat`;
    expect(stripRatingsBlockForStream(input)).toBe(input);
  });
});
