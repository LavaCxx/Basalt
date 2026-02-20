/**
 * Photo Gallery Component
 * Grid layout with lightbox preview
 * Built with SolidJS for interactivity
 */

import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export interface PhotoItem {
  id: string;
  src: string;
  thumbnail?: string;
  alt?: string;
  title?: string;
  date?: Date;
  // EXIF data
  camera?: string;
  lens?: string;
  iso?: number;
  shutterSpeed?: string;
  aperture?: string;
  focalLength?: number;
  location?: string;
}

interface PhotoGalleryProps {
  photos: PhotoItem[];
  columns?: number; // Number of columns (2-5)
  gap?: number; // Gap in pixels
  aspectRatio?: 'square' | 'video' | 'auto'; // Image aspect ratio
  showInfo?: boolean; // Show photo info on hover
}

export default function PhotoGallery(props: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);

  const columns = () => props.columns || 3;
  const gap = () => props.gap || 4;
  const aspectRatio = () => props.aspectRatio || 'auto';
  const showInfo = () => props.showInfo ?? true;

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
    if (!isServer) {
      document.body.style.overflow = 'hidden';
    }
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    if (!isServer) {
      document.body.style.overflow = '';
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : props.photos.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < props.photos.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!lightboxOpen()) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
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
      document.body.style.overflow = '';
    }
  });

  const currentPhoto = () => props.photos[currentIndex()];

  const getAspectRatioClass = () => {
    switch (aspectRatio()) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      default:
        return '';
    }
  };

  return (
    <div class="photo-gallery">
      {/* Grid */}
      <div
        class="grid"
        style={{
          'grid-template-columns': `repeat(${columns()}, 1fr)`,
          gap: `${gap()}px`,
        }}
      >
        <For each={props.photos}>
          {(photo, index) => (
            <div
              class="group relative overflow-hidden rounded-lg cursor-pointer bg-surface-secondary"
              classList={{ [getAspectRatioClass()]: !!getAspectRatioClass() }}
              onClick={() => openLightbox(index())}
            >
              <img
                src={photo.thumbnail || photo.src}
                alt={photo.alt || ''}
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />

              {/* Hover overlay with info */}
              <Show when={showInfo() && (photo.title || photo.location)}>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div class="absolute bottom-0 left-0 right-0 p-3">
                    <Show when={photo.title}>
                      <p class="text-white text-sm font-medium truncate">{photo.title}</p>
                    </Show>
                    <Show when={photo.location}>
                      <p class="text-white/70 text-xs truncate">{photo.location}</p>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Lightbox */}
      <Show when={lightboxOpen()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          {/* Close button */}
          <button
            class="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous button */}
          <Show when={props.photos.length > 1}>
            <button
              class="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
              onClick={goToPrevious}
              aria-label="Previous"
            >
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Next button */}
            <button
              class="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
              onClick={goToNext}
              aria-label="Next"
            >
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </Show>

          {/* Main image container */}
          <div class="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
            <div class="relative flex items-center justify-center">
              <img
                src={currentPhoto()?.src}
                alt={currentPhoto()?.alt || ''}
                class="max-h-[75vh] max-w-full object-contain"
                onLoad={() => setIsLoading(false)}
              />
            </div>

            {/* Info bar */}
            <Show when={currentPhoto() && (currentPhoto()?.title || currentPhoto()?.camera)}>
              <div class="mt-4 text-center text-white/80 text-sm px-4">
                <Show when={currentPhoto()?.title}>
                  <p class="font-medium text-white">{currentPhoto()?.title}</p>
                </Show>

                {/* EXIF info */}
                <Show when={currentPhoto()?.camera || currentPhoto()?.location}>
                  <div class="flex items-center justify-center gap-4 mt-2 text-xs text-white/60">
                    <Show when={currentPhoto()?.camera}>
                      <span>{currentPhoto()?.camera}</span>
                    </Show>
                    <Show when={currentPhoto()?.lens}>
                      <span>{currentPhoto()?.lens}</span>
                    </Show>
                    <Show when={currentPhoto()?.aperture || currentPhoto()?.shutterSpeed || currentPhoto()?.iso}>
                      <span>
                        {currentPhoto()?.aperture} {currentPhoto()?.shutterSpeed} ISO {currentPhoto()?.iso}
                      </span>
                    </Show>
                    <Show when={currentPhoto()?.location}>
                      <span>{currentPhoto()?.location}</span>
                    </Show>
                  </div>
                </Show>

                {/* Counter */}
                <Show when={props.photos.length > 1}>
                  <p class="mt-2 text-xs text-white/40">
                    {currentIndex() + 1} / {props.photos.length}
                  </p>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <style>{`
        .photo-gallery img {
          background-color: #f5f5f7;
        }
      `}</style>
    </div>
  );
}
