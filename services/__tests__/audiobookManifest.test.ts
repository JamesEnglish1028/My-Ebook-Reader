import { describe, expect, it } from 'vitest';

import { parseAudiobookManifest } from '../audiobookManifest';

describe('parseAudiobookManifest', () => {
  it('parses tracks and resolves relative hrefs', () => {
    const manifest = JSON.stringify({
      metadata: {
        title: 'Sample Audio',
        author: 'Narrator',
      },
      readingOrder: [
        { href: 'tracks/part-1.mp3', title: 'Part 1' },
        { href: '/tracks/part-2.mp3', title: 'Part 2' },
      ],
      toc: [
        { href: 'tracks/part-1.mp3', title: 'Chapter 1' },
      ],
    });

    const parsed = parseAudiobookManifest(manifest, 'https://example.org/library/manifest.json');
    expect(parsed.title).toBe('Sample Audio');
    expect(parsed.author).toBe('Narrator');
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks[0].href).toBe('https://example.org/library/tracks/part-1.mp3');
    expect(parsed.tracks[1].href).toBe('https://example.org/tracks/part-2.mp3');
    expect(parsed.toc[0].href).toBe('https://example.org/library/tracks/part-1.mp3');
  });
});
