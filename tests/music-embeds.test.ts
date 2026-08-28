import { describe, expect, it } from 'vitest';
import { parseMusicEmbeds } from '../src/lib/utils/parse-music-embeds';

describe('parseMusicEmbeds', () => {
  it('splits a Notion paragraph marker from surrounding HTML', () => {
    expect(parseMusicEmbeds('<p>前文</p><p>[music type=&quot;song&quot; id=&quot;1974443814&quot;]</p><p>后文</p>')).toEqual([
      { type: 'html', html: '<p>前文</p>' },
      { type: 'music', musicType: 'song', id: '1974443814' },
      { type: 'html', html: '<p>后文</p>' },
    ]);
  });

  it('supports album and playlist markers with either attribute order', () => {
    expect(parseMusicEmbeds('<p>[music id="1" type="album"]</p><p>[music type="playlist" id="2"]</p>')).toEqual([
      { type: 'music', musicType: 'album', id: '1' },
      { type: 'music', musicType: 'playlist', id: '2' },
    ]);
  });

  it('leaves invalid or unsupported markers untouched', () => {
    const html = '<p>[music type="artist" id="1"]</p><p>[music type="song" id="oops"]</p>';
    expect(parseMusicEmbeds(html)).toEqual([{ type: 'html', html }]);
  });

  it('does not interpret syntax examples inside code blocks', () => {
    const html = '<pre><code>[music type="song" id="1"]</code></pre>';
    expect(parseMusicEmbeds(html)).toEqual([{ type: 'html', html }]);
  });
});
