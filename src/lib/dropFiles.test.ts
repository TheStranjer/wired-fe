/**
 * Tests for reading pastes and drops: the files of a payload, the drags that
 * carry files, and which files are media.
 */
import { describe, expect, it } from 'vitest';

import { carriedFiles, carriesFiles, isMedia } from './dropFiles';

/** A data transfer stub holding {@link files} and reporting {@link types}. */
function transfer(files: readonly File[], types: readonly string[]): DataTransfer {
  return { files, types } as unknown as DataTransfer;
}

describe(carriedFiles, () => {
  it('lists the files of a payload', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    expect(carriedFiles(transfer([file], ['Files']))).toStrictEqual([file]);
  });

  it('is empty without a payload', () => {
    expect(carriedFiles(null)).toStrictEqual([]);
    expect(carriedFiles(undefined)).toStrictEqual([]);
  });
});

describe(carriesFiles, () => {
  it('is true for a drag of files and false for a drag of text or nothing', () => {
    expect(carriesFiles(transfer([], ['Files']))).toBe(true);
    expect(carriesFiles(transfer([], ['text/plain']))).toBe(false);
    expect(carriesFiles(null)).toBe(false);
  });
});

describe(isMedia, () => {
  it('takes images, video and audio, and nothing else', () => {
    const named = (type: string): File => new File(['x'], 'f', { type });

    expect(isMedia(named('image/png'))).toBe(true);
    expect(isMedia(named('video/mp4'))).toBe(true);
    expect(isMedia(named('audio/mpeg'))).toBe(true);
    expect(isMedia(named('text/plain'))).toBe(false);
  });
});
