import { For, Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount } from 'solid-js';
import '../../styles/riso-music-player.css';

interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  url: string;
  plate: string;
  cover?: string;
}

interface LyricLine {
  time: number | null;
  text: string;
}

interface MusicResponse {
  source: string;
  tracks: Array<Omit<MusicTrack, 'plate'>>;
}

type MusicRequestType = 'song' | 'album' | 'playlist';

interface RisoMusicPlayerProps {
  type?: MusicRequestType;
  id?: string;
  variant?: 'lab' | 'article';
}

const fallbackTracks: MusicTrack[] = [
  {
    id: 'paper-current',
    name: 'Paper Current',
    artist: 'SoundHelix',
    album: 'RISO Lab Session 01',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    plate: '01',
  },
  {
    id: 'green-frequency',
    name: 'Green Frequency',
    artist: 'SoundHelix',
    album: 'RISO Lab Session 02',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    plate: '02',
  },
  {
    id: 'offset-garden',
    name: 'Offset Garden With A Deliberately Long Title',
    artist: 'SoundHelix · Lab Ensemble',
    album: 'RISO Lab Session 03',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    plate: '03',
  },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function PlayIcon(props: { playing: boolean }) {
  return (
    <Show
      when={props.playing}
      fallback={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
    </Show>
  );
}

function SkipIcon(props: { direction: 'previous' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" classList={{ 'is-reversed': props.direction === 'next' }}>
      <path d="M6 5h2v14H6zm3 7 9-7v14z" />
    </svg>
  );
}

function BayerMark(props: { variant?: number }) {
  return (
    <span class="riso-music-bayer" data-variant={(props.variant ?? 0) % 3} aria-hidden="true">
      <For each={Array.from({ length: 16 })}>{() => <i />}</For>
    </span>
  );
}

function parseLyrics(value: string): LyricLine[] {
  const result: LyricLine[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const text = rawLine.replace(/\[(?:\d{1,3}:\d{2}(?:\.\d{1,3})?|[^\]]+:.*?)\]/g, '').trim();
    if (!text) continue;
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!timestamps.length) {
      result.push({ time: null, text });
      continue;
    }
    for (const timestamp of timestamps) {
      const fraction = Number(`0.${timestamp[3] || '0'}`);
      result.push({ time: Number(timestamp[1]) * 60 + Number(timestamp[2]) + fraction, text });
    }
  }
  return result.sort((a, b) => (a.time ?? -1) - (b.time ?? -1));
}

export default function RisoMusicPlayer(props: RisoMusicPlayerProps) {
  let audio: HTMLAudioElement | undefined;
  let lyricScroller: HTMLDivElement | undefined;
  let lyricResumeTimer: ReturnType<typeof setTimeout> | undefined;
  let lyricCenterFrame: number | undefined;
  const instanceId = createUniqueId();
  const initialTracks = props.id ? [{
    id: props.id,
    name: '正在载入音乐…',
    artist: '网易云音乐',
    album: '',
    url: '',
    plate: '01',
  }] : fallbackTracks;
  const [tracks, setTracks] = createSignal<MusicTrack[]>(initialTracks);
  const [trackIndex, setTrackIndex] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(0.72);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [sourceState, setSourceState] = createSignal<'loading' | 'netease' | 'fallback' | 'error'>('loading');
  const [playlistOpen, setPlaylistOpen] = createSignal(props.variant !== 'article');
  const [lyricsOpen, setLyricsOpen] = createSignal(props.variant !== 'article');
  const [lyrics, setLyrics] = createSignal<LyricLine[]>([]);
  const [lyricState, setLyricState] = createSignal<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [lyricFollowEnabled, setLyricFollowEnabled] = createSignal(true);
  const [browsedLyricIndex, setBrowsedLyricIndex] = createSignal(-1);
  const currentTrack = createMemo(() => tracks()[trackIndex()] ?? tracks()[0]);
  const progress = createMemo(() => duration() ? Math.min(currentTime() / duration(), 1) : 0);
  const hasTimedLyrics = createMemo(() => lyrics().some((line) => line.time !== null));
  const displayedLyrics = createMemo(() => hasTimedLyrics()
    ? lyrics().filter((line) => line.time !== null)
    : lyrics());
  const activeLyricIndex = createMemo(() => {
    let active = -1;
    displayedLyrics().forEach((line, index) => {
      if (line.time !== null && line.time <= currentTime()) active = index;
    });
    return active;
  });
  const highlightedLyricIndex = createMemo(() => (
    !lyricFollowEnabled() && browsedLyricIndex() >= 0
      ? browsedLyricIndex()
      : activeLyricIndex()
  ));
  const requestType = createMemo<MusicRequestType>(() => props.type ?? 'playlist');
  const requestId = createMemo(() => props.id ?? '8676645748');
  const showsTrackList = createMemo(() => requestType() !== 'song');
  const trackListLabel = createMemo(() => requestType() === 'album' ? '曲目' : '歌单');
  const showsLyrics = createMemo(() => lyricState() === 'loading' || lyricState() === 'ready');

  const resumeLyricFollow = () => {
    if (lyricResumeTimer) clearTimeout(lyricResumeTimer);
    lyricResumeTimer = undefined;
    setBrowsedLyricIndex(-1);
    setLyricFollowEnabled(true);
  };

  const pauseLyricFollow = () => {
    setLyricFollowEnabled(false);
    if (lyricResumeTimer) clearTimeout(lyricResumeTimer);
    lyricResumeTimer = setTimeout(resumeLyricFollow, 3_000);
  };

  const updateCenteredLyric = () => {
    if (lyricFollowEnabled() || !lyricScroller) return;
    if (lyricCenterFrame !== undefined) cancelAnimationFrame(lyricCenterFrame);
    lyricCenterFrame = requestAnimationFrame(() => {
      lyricCenterFrame = undefined;
      if (!lyricScroller) return;
      const scrollerRect = lyricScroller.getBoundingClientRect();
      const center = scrollerRect.top + scrollerRect.height / 2;
      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;
      lyricScroller.querySelectorAll<HTMLElement>('[data-lyric-index]').forEach((element) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = Number(element.dataset.lyricIndex);
        }
      });
      setBrowsedLyricIndex(closestIndex);
    });
  };

  const handleLyricScroll = () => {
    if (lyricFollowEnabled()) return;
    pauseLyricFollow();
    updateCenteredLyric();
  };

  onCleanup(() => {
    if (lyricResumeTimer) clearTimeout(lyricResumeTimer);
    if (lyricCenterFrame !== undefined) cancelAnimationFrame(lyricCenterFrame);
  });

  const loadTrack = (index: number, shouldPlay = false) => {
    if (!audio) return;
    const list = tracks();
    if (!list.length) return;
    const nextIndex = (index + list.length) % list.length;
    resumeLyricFollow();
    setTrackIndex(nextIndex);
    setCurrentTime(0);
    setDuration(0);
    setError('');
    setLoading(true);
    audio.src = list[nextIndex].url;
    audio.load();
    if (shouldPlay) {
      audio.play()
        .then(() => { setPlaying(true); setLoading(false); })
        .catch(() => {
          setPlaying(false);
          setLoading(false);
          setError('浏览器没有开始播放，请再按一次播放键。');
        });
    }
  };

  const loadMetingPlaylist = async () => {
    setSourceState('loading');
    try {
      const params = new URLSearchParams({ type: requestType(), id: requestId() });
      const response = await fetch(`/api/lab/music?${params}`);
      if (!response.ok) throw new Error(`Music API returned ${response.status}`);
      const payload = await response.json() as MusicResponse;
      if (!Array.isArray(payload.tracks) || !payload.tracks.length) throw new Error('Playlist is empty');

      const nextTracks = payload.tracks.map((track, index) => ({
        ...track,
        plate: String(index + 1).padStart(2, '0'),
      }));
      audio?.pause();
      setTracks(nextTracks);
      setTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
      setError('');
      setSourceState('netease');
      if (audio) {
        audio.src = nextTracks[0].url;
        audio.load();
      }
    } catch (loadError) {
      console.warn('Meting playlist unavailable:', loadError);
      if (props.id) {
        setSourceState('error');
        setError('音乐信息加载失败，请稍后重试。');
      } else {
        setTracks(fallbackTracks);
        setSourceState('fallback');
      }
    }
  };

  onMount(() => { void loadMetingPlaylist(); });

  onMount(() => {
    const pauseOtherPlayer = (event: Event) => {
      const playingAudio = (event as CustomEvent<HTMLAudioElement>).detail;
      if (audio && playingAudio !== audio && !audio.paused) audio.pause();
    };
    window.addEventListener('riso-music-play', pauseOtherPlayer);
    onCleanup(() => window.removeEventListener('riso-music-play', pauseOtherPlayer));
  });

  createEffect(() => {
    const track = currentTrack();
    if (sourceState() !== 'netease' || !/^\d{1,20}$/.test(track.id)) {
      setLyrics([]);
      setLyricState('empty');
      return;
    }

    const controller = new AbortController();
    setLyrics([]);
    setLyricState('loading');
    void fetch(`/api/lab/lyric?id=${encodeURIComponent(track.id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Lyric API returned ${response.status}`);
        const payload = await response.json() as { lyric?: string };
        const nextLyrics = parseLyrics(payload.lyric || '');
        setLyrics(nextLyrics);
        setLyricState(nextLyrics.length ? 'ready' : 'empty');
      })
      .catch((lyricError) => {
        if (lyricError instanceof Error && lyricError.name === 'AbortError') return;
        console.warn('Lyrics unavailable:', lyricError);
        setLyricState('error');
      });
    onCleanup(() => controller.abort());
  });

  createEffect(() => {
    const index = activeLyricIndex();
    if (!lyricsOpen() || !hasTimedLyrics() || !lyricFollowEnabled() || index < 0) return;

    const frame = requestAnimationFrame(() => {
      const target = lyricScroller?.querySelector<HTMLElement>(`[data-lyric-index="${index}"]`);
      if (!lyricScroller || !target) return;
      const top = target.offsetTop - (lyricScroller.clientHeight - target.offsetHeight) / 2;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      lyricScroller.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const togglePlayback = () => {
    if (!audio) return;
    setError('');
    if (audio.paused) {
      setLoading(true);
      audio.play()
        .then(() => { setPlaying(true); setLoading(false); })
        .catch(() => {
          setPlaying(false);
          setLoading(false);
          setError('音频暂时无法播放，请检查网络后重试。');
        });
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek = (value: string) => {
    if (!audio) return;
    const nextTime = Number(value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const seekToLyric = (line: LyricLine) => {
    if (!audio || line.time === null) return;
    resumeLyricFollow();
    audio.currentTime = line.time;
    setCurrentTime(line.time);
  };

  const changeVolume = (value: string) => {
    if (!audio) return;
    const nextVolume = Number(value);
    audio.volume = nextVolume;
    setVolume(nextVolume);
  };

  return (
    <div class="riso-music-player">
      <audio
        ref={(element) => { audio = element; element.volume = volume(); }}
        preload="metadata"
        src={initialTracks[0].url || undefined}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onPlay={(event) => {
          setPlaying(true);
          setLoading(false);
          window.dispatchEvent(new CustomEvent('riso-music-play', { detail: event.currentTarget }));
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => loadTrack(trackIndex() + 1, true)}
        onError={() => {
          setPlaying(false);
          setLoading(false);
          setError(showsTrackList()
            ? '这首音频加载失败，可以切换曲目或稍后重试。'
            : '这首音频加载失败，请稍后重试。');
        }}
      />

      <div class="riso-music-main">
        <div class="riso-music-cover" classList={{ 'has-image': Boolean(currentTrack().cover) }} data-plate={currentTrack().plate} aria-hidden="true">
          <Show when={currentTrack().cover} fallback={<><span>RISO</span><i /></>}>
            {(cover) => <img src={cover()} alt="" referrerpolicy="no-referrer" />}
          </Show>
        </div>

        <div class="riso-music-side">
          <div class="riso-music-console">
          <div class="riso-music-heading">
            <div>
              <h3>{currentTrack().name}</h3>
              <p class="riso-music-byline">{currentTrack().artist}</p>
              <p class="riso-music-album">{currentTrack().album}</p>
            </div>
          </div>

          <div class="riso-music-progress">
            <label for={`${instanceId}-seek`}>播放进度</label>
            <input
              id={`${instanceId}-seek`}
              type="range"
              min="0"
              max={Math.max(duration(), 0)}
              step="0.1"
              value={Math.min(currentTime(), duration() || 0)}
              style={{ '--progress': `${progress() * 100}%` }}
              onInput={(event) => seek(event.currentTarget.value)}
            />
            <div class="riso-music-time" aria-live="off">
              <span>{formatTime(currentTime())}</span>
              <span>{formatTime(duration())}</span>
            </div>
          </div>

          <div class="riso-music-controls">
            <button type="button" aria-label="上一首" onClick={() => loadTrack(trackIndex() - 1, playing())}>
              <SkipIcon direction="previous" />
            </button>
            <button
              class="riso-music-play"
              type="button"
              aria-label={playing() ? '暂停' : '播放'}
              aria-pressed={playing()}
              onClick={togglePlayback}
            >
              <PlayIcon playing={playing()} />
            </button>
            <button type="button" aria-label="下一首" onClick={() => loadTrack(trackIndex() + 1, playing())}>
              <SkipIcon direction="next" />
            </button>

            <div class="riso-music-volume">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zm11.5-.5a5 5 0 0 1 0 7l1.4 1.4a7 7 0 0 0 0-9.8z" /></svg>
              <label for={`${instanceId}-volume`}>音量</label>
              <input
                id={`${instanceId}-volume`}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume()}
                style={{ '--progress': `${volume() * 100}%` }}
                onInput={(event) => changeVolume(event.currentTarget.value)}
              />
            </div>

            <span class="riso-music-status" role="status">
              {sourceState() === 'loading' ? '连接网易云…' : sourceState() === 'error' ? '连接失败' : loading() ? '装版中…' : playing() ? '播放中' : '待播放'}
            </span>
          </div>

          <Show when={error()}>
            <p class="riso-music-error" role="alert">{error()}</p>
          </Show>
          </div>

          <Show when={showsLyrics()}>
          <div class="riso-music-lyrics-drawer" classList={{ 'is-open': lyricsOpen() }}>
            <button
              class="riso-music-lyrics-toggle"
              type="button"
              aria-expanded={lyricsOpen()}
              aria-controls={`${instanceId}-lyrics`}
              aria-label={lyricsOpen() ? '收起歌词' : '展开歌词'}
              onClick={() => setLyricsOpen(!lyricsOpen())}
            >
              <span>歌词</span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4 4.5-4" /></svg>
            </button>

            <div
              class="riso-music-lyrics-reveal"
              aria-hidden={!lyricsOpen()}
              inert={!lyricsOpen() ? true : undefined}
            >
              <section id={`${instanceId}-lyrics`} class="riso-music-lyrics" aria-label={`${currentTrack().name} 歌词`}>
              <Show when={lyricState() === 'ready'} fallback={
                <p class="riso-music-lyrics-state" role="status">
                  {lyricState() === 'loading' ? '正在载入歌词…' : '这首歌暂无歌词。'}
                </p>
              }>
                <div
                  ref={(element) => { lyricScroller = element; }}
                  class="riso-music-lyrics-scroll"
                  classList={{ 'is-timed': hasTimedLyrics(), 'is-static': !hasTimedLyrics() }}
                  aria-label={!hasTimedLyrics() ? '未同步歌词' : undefined}
                  aria-live="off"
                  tabindex={hasTimedLyrics() ? 0 : undefined}
                  onWheel={pauseLyricFollow}
                  onScroll={handleLyricScroll}
                  onPointerDown={pauseLyricFollow}
                  onPointerMove={(event) => { if (event.buttons) pauseLyricFollow(); }}
                  onPointerUp={pauseLyricFollow}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
                      pauseLyricFollow();
                    }
                  }}
                >
                  <Show when={!hasTimedLyrics()}>
                    <span class="riso-music-lyrics-sync-warning" role="img" aria-label="歌词同步失败">
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4.5 6.5A6 6 0 0 1 15 7.8L16.5 9M16.5 5.5V9h-3.5M15.5 13.5A6 6 0 0 1 5 12.2L3.5 11M3.5 14.5V11H7M4 4l12 12" />
                      </svg>
                    </span>
                  </Show>
                  <For each={displayedLyrics()}>{(line, index) => (
                    <Show
                      when={hasTimedLyrics()}
                      fallback={<p>{line.text}</p>}
                    >
                      <button
                        type="button"
                        data-lyric-index={index()}
                        classList={{
                          'is-current': index() === highlightedLyricIndex(),
                          'is-near': Math.abs(index() - highlightedLyricIndex()) === 1,
                          'is-browse-center': !lyricFollowEnabled() && index() === browsedLyricIndex(),
                        }}
                        aria-current={index() === activeLyricIndex() ? 'true' : undefined}
                        aria-label={`跳转到 ${formatTime(line.time ?? 0)}：${line.text}`}
                        onClick={() => seekToLyric(line)}
                      >
                        <span class="riso-music-lyric-text">{line.text}</span>
                        <Show when={!lyricFollowEnabled() && index() === browsedLyricIndex()}>
                          <time class="riso-music-lyric-time" datetime={`PT${line.time ?? 0}S`}>
                            {formatTime(line.time ?? 0)}
                          </time>
                        </Show>
                      </button>
                    </Show>
                  )}</For>
                </div>
              </Show>
              </section>
            </div>
          </div>
          </Show>
        </div>
      </div>

      <Show when={showsTrackList()}>
      <button
        class="riso-music-playlist-toggle"
        classList={{ 'is-open': playlistOpen() }}
        type="button"
        aria-expanded={playlistOpen()}
        aria-controls={`${instanceId}-playlist`}
        onClick={() => setPlaylistOpen(!playlistOpen())}
      >
        <span>
          <strong>{trackListLabel()}</strong>
          <small>{tracks().length} 首</small>
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4 4.5-4" /></svg>
      </button>

      <div
        class="riso-music-playlist-reveal"
        classList={{ 'is-open': playlistOpen() }}
        aria-hidden={!playlistOpen()}
        inert={!playlistOpen() ? true : undefined}
      >
        <ol id={`${instanceId}-playlist`} class="riso-music-playlist">
          <For each={tracks()}>{(track, index) => (
            <li classList={{ 'is-current': index() === trackIndex() }}>
              <button
                type="button"
                aria-current={index() === trackIndex() ? 'true' : undefined}
                onClick={() => loadTrack(index(), playing())}
              >
                <span class="riso-music-track-number">{track.plate}</span>
                <span class="riso-music-track-copy"><strong>{track.name}</strong><small>{track.artist} · {track.album}</small></span>
                <span class="riso-music-track-end">
                  <BayerMark variant={index()} />
                  <span class="riso-music-track-state">{index() === trackIndex() ? (playing() ? 'PLAY' : 'READY') : 'LOAD'}</span>
                </span>
              </button>
            </li>
          )}</For>
        </ol>
      </div>
      </Show>
    </div>
  );
}
