import { describe, expect, it } from 'vitest';
import { resolveImageContentType } from '../src/lib/image-content-type';

describe('resolveImageContentType', () => {
  it('keeps supported image MIME types and strips parameters', () => {
    expect(resolveImageContentType('image/webp; charset=binary', 'photo.jpg')).toBe('image/webp');
  });

  it('infers Notion generic image responses from the attachment name', () => {
    expect(resolveImageContentType('image', 'photo.JPG')).toBe('image/jpeg');
    expect(resolveImageContentType('image', 'photo.png')).toBe('image/png');
  });

  it('rejects unsupported or ambiguous responses', () => {
    expect(resolveImageContentType('text/html', 'photo.jpg')).toBeNull();
    expect(resolveImageContentType('image', 'photo.svg')).toBeNull();
    expect(resolveImageContentType('image')).toBeNull();
  });
});
