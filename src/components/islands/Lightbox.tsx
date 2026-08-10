/**
 * Shared Lightbox component for full-screen image viewing
 * Used by PhotoGallery and ArticleContent
 */

import { Show, onMount, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export interface LightboxPhoto {
  src: string;
  alt?: string;
  title?: string;
  camera?: string;
  lens?: string;
  iso?: number;
  shutterSpeed?: string;
  aperture?: string;
  focalLength?: number;
  location?: string;
}

interface LightboxProps {
  open: boolean;
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export default function Lightbox(props: LightboxProps) {
  const photo = () => props.photos[props.index];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;
    switch (e.key) {
      case 'Escape':
        props.onClose();
        break;
      case 'ArrowLeft':
        props.onPrevious();
        break;
      case 'ArrowRight':
        props.onNext();
        break;
    }
  };

  onMount(() => {
    if (!isServer) {
      document.addEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    if (!isServer) {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  return (
    <Show when={props.open && props.photos.length > 0}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <button
          class="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
          onClick={props.onClose}
          aria-label="Close"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <Show when={props.photos.length > 1}>
          <button
            class="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
            onClick={props.onPrevious}
            aria-label="Previous"
          >
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            class="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
            onClick={props.onNext}
            aria-label="Next"
          >
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Show>

        <div class="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
          <img
            src={photo()?.src}
            alt={photo()?.alt || ''}
            class="max-h-[75vh] max-w-full object-contain"
          />

          <Show when={photo() && (photo()?.title || photo()?.camera)}>
            <div class="mt-4 text-center text-white/80 text-sm px-4">
              <Show when={photo()?.title}>
                <p class="font-medium text-white">{photo()?.title}</p>
              </Show>
              <Show when={photo()?.camera || photo()?.location}>
                <div class="flex items-center justify-center gap-4 mt-2 text-xs text-white/60">
                  <Show when={photo()?.camera}>
                    <span>{photo()?.camera}</span>
                  </Show>
                  <Show when={photo()?.lens}>
                    <span>{photo()?.lens}</span>
                  </Show>
                  <Show when={photo()?.aperture || photo()?.shutterSpeed || photo()?.iso}>
                    <span>
                      {photo()?.aperture} {photo()?.shutterSpeed} ISO {photo()?.iso}
                    </span>
                  </Show>
                  <Show when={photo()?.location}>
                    <span>{photo()?.location}</span>
                  </Show>
                </div>
              </Show>
              <Show when={props.photos.length > 1}>
                <p class="mt-2 text-xs text-white/40">
                  {props.index + 1} / {props.photos.length}
                </p>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
