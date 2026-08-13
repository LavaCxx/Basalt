/**
 * Photo Gallery Component
 * Grid layout with lightbox preview (shared Lightbox component)
 */

import { createSignal, For, Show, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';
import Lightbox from './Lightbox';

export interface PhotoItem {
  id: string;
  src: string;
  thumbnail?: string;
  alt?: string;
  title?: string;
  date?: Date;
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
  columns?: number;
  gap?: number;
  aspectRatio?: 'square' | 'video' | 'auto';
  showInfo?: boolean;
}

export default function PhotoGallery(props: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [currentIndex, setCurrentIndex] = createSignal(0);

  const columns = () => props.columns || 3;
  const gap = () => props.gap || 4;
  const aspectRatio = () => props.aspectRatio || 'auto';
  const showInfo = () => props.showInfo ?? true;

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
    if (!isServer) document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    if (!isServer) document.body.style.overflow = '';
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : props.photos.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < props.photos.length - 1 ? prev + 1 : 0));
  };

  onCleanup(() => {
    if (!isServer) document.body.style.overflow = '';
  });

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
                class="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />

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

      <Lightbox
        open={lightboxOpen()}
        photos={props.photos}
        index={currentIndex()}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />

      <style>{`
        .photo-gallery img {
          background-color: #f5f5f7;
        }
      `}</style>
    </div>
  );
}
