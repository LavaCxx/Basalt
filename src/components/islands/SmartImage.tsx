import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  class?: string;
  classList?: Record<string, boolean>;
  loading?: 'lazy' | 'eager';
  width?: number | string;
  height?: number | string;
  children?: JSX.Element;
  naturalSizing?: boolean;
  fit?: 'cover' | 'contain';
}

export default function SmartImage(props: SmartImageProps) {
  const [state, setState] = createSignal<'loading' | 'loaded' | 'error'>(
    props.src ? 'loading' : 'error'
  );
  let imageRef: HTMLImageElement | undefined;

  const syncImageState = () => {
    if (!imageRef) return;
    setState(imageRef.complete ? (imageRef.naturalWidth > 0 ? 'loaded' : 'error') : 'loading');
  };

  onMount(() => {
    syncImageState();

    const interval = window.setInterval(() => {
      if (imageRef?.complete) syncImageState();
    }, 50);

    onCleanup(() => window.clearInterval(interval));
  });

  return (
    <span
      class={`smart-image ${props.class || ''}`}
      classList={{ ...props.classList, 'smart-image-loaded': state() === 'loaded' }}
      data-natural-sizing={props.naturalSizing ? 'true' : undefined}
      data-fit={props.fit}
    >
      <span
        class="smart-image-placeholder"
        classList={{
          'smart-image-loading': state() === 'loading',
          'smart-image-error': state() === 'error',
          'smart-image-loaded': state() === 'loaded',
        }}
        aria-hidden="true"
      >
        <Show when={state() === 'loading'}>
          <span class="smart-image-glyph">▤</span>
          <span class="smart-image-label">SCANNING</span>
        </Show>
        <Show when={state() === 'error'}>
          <svg class="smart-image-crack" viewBox="16 16 224 224" aria-hidden="true">
            <g>
              <rect width="256" height="256" fill="none" />
              <path
                d="M104,208H40a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H216a8,8,0,0,1,8,8V88l-48,16-16,40-40,16Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="9"
              />
              <path
                d="M137.73,208l7.94-23.8,39-15.58,15.58-39,23.8-7.94V200a8,8,0,0,1-8,8Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="9"
              />
              <path
                d="M32,168.69l54.34-54.35a8,8,0,0,1,11.32,0l39,39"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="9"
              />
            </g>
          </svg>
          <span class="smart-image-label">图片加载失败</span>
        </Show>
      </span>
      <img
        src={props.src || undefined}
        alt={props.alt}
        class="smart-image-img"
        classList={{ 'smart-image-loading': state() === 'loading', 'smart-image-loaded': state() === 'loaded', 'smart-image-error': state() === 'error' }}
        loading={props.loading || 'lazy'}
        decoding={props.loading === 'eager' ? 'sync' : 'async'}
        width={props.width}
        height={props.height}
        style={props.src && state() !== 'error' ? undefined : 'display: none'}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        ref={(node) => {
          imageRef = node;
          syncImageState();
        }}
      />
      {props.children}
    </span>
  );
}
