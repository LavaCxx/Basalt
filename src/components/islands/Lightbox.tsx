/**
 * Shared Lightbox component for full-screen image viewing
 * Used by PhotoGallery and ArticleContent
 */

import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { isServer } from 'solid-js/web';
import SmartImage from './SmartImage';

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

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const SINGLE_CLICK_ZOOM = 2;
const DOUBLE_TAP_ZOOM = SINGLE_CLICK_ZOOM;
const DRAG_THRESHOLD = 8;

export default function Lightbox(props: LightboxProps) {
  const photo = () => props.photos[props.index];
  const [zoom, setZoom] = createSignal(MIN_ZOOM);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [imageState, setImageState] = createSignal<'loading' | 'loaded' | 'error'>('loading');
  let viewport: HTMLDivElement | undefined;
  let pointerStart = { x: 0, y: 0 };
  let offsetStart = { x: 0, y: 0 };
  let pinchDistance = 0;
  let pinchZoom = MIN_ZOOM;
  let lastTap = { time: 0, x: 0, y: 0 };
  let dragged = false;
  const [pointerDown, setPointerDown] = createSignal(false);
  const activePointers = new Map<number, { x: number; y: number }>();

  createEffect(() => {
    props.index;
    props.open;
    photo()?.src;
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setImageState('loading');
  });

  const clampOffset = (nextOffset: { x: number; y: number }, nextZoom = zoom()) => {
    if (!viewport || nextZoom <= MIN_ZOOM) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * nextZoom - rect.width) / 2);
    const maxY = Math.max(0, (rect.height * nextZoom - rect.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
      y: Math.min(maxY, Math.max(-maxY, nextOffset.y)),
    };
  };

  const zoomAtPoint = (nextZoomValue: number, point: { x: number; y: number }) => {
    if (imageState() !== 'loaded' || !viewport) return;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomValue));
    const currentZoom = zoom();
    if (nextZoom === currentZoom) return;

    const rect = viewport.getBoundingClientRect();
    const anchor = {
      x: point.x - rect.left - rect.width / 2,
      y: point.y - rect.top - rect.height / 2,
    };
    const currentOffset = offset();
    const nextOffset = {
      x: currentOffset.x + (currentZoom - nextZoom) * anchor.x,
      y: currentOffset.y + (currentZoom - nextZoom) * anchor.y,
    };
    setZoom(nextZoom);
    setOffset(nextZoom === MIN_ZOOM ? { x: 0, y: 0 } : clampOffset(nextOffset, nextZoom));
  };

  const handleWheel = (event: WheelEvent) => {
    if (imageState() !== 'loaded') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAtPoint(zoom() * factor, { x: event.clientX, y: event.clientY });
  };

  const updatePinch = (event: PointerEvent) => {
    if (activePointers.size < 2) return;
    const [first, second] = [...activePointers.values()];
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    zoomAtPoint(pinchZoom * (distance / pinchDistance), midpoint);
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (imageState() !== 'loaded') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 2) {
      const [first, second] = [...activePointers.values()];
      pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      pinchZoom = zoom();
    } else if (activePointers.size === 1) {
      pointerStart = { x: event.clientX, y: event.clientY };
      offsetStart = offset();
      dragged = false;
      setPointerDown(true);
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      updatePinch(event);
      return;
    }
    if (zoom() <= MIN_ZOOM) return;

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    if (Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) dragged = true;
    setOffset(
      clampOffset({
        x: offsetStart.x + deltaX,
        y: offsetStart.y + deltaY,
      })
    );
  };

  const handlePointerUp = (event: PointerEvent) => {
    const canTap = activePointers.size === 1 && !dragged;
    if (canTap && event.pointerType === 'touch' && zoom() <= MIN_ZOOM) {
      const now = Date.now();
      const tap = { x: event.clientX, y: event.clientY };
      if (now - lastTap.time < 300 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 32) {
        lastTap = { time: 0, x: 0, y: 0 };
        zoomAtPoint(DOUBLE_TAP_ZOOM, tap);
      } else {
        lastTap = { time: now, ...tap };
      }
    } else if (canTap && event.pointerType === 'mouse' && event.button === 0) {
      if (zoom() > MIN_ZOOM) {
        setZoom(MIN_ZOOM);
        setOffset({ x: 0, y: 0 });
      } else {
        zoomAtPoint(SINGLE_CLICK_ZOOM, { x: event.clientX, y: event.clientY });
      }
    }
    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) setPointerDown(false);
    if (activePointers.size === 1) {
      const [remaining] = [...activePointers.values()];
      pointerStart = remaining;
      offsetStart = offset();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!props.open) return;
    switch (event.key) {
      case 'Escape':
        props.onClose();
        break;
      case 'ArrowLeft':
        props.onPrevious();
        break;
      case 'ArrowRight':
        props.onNext();
        break;
      case '+':
      case '=':
        zoomAtPoint(zoom() * 1.2, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        break;
      case '-':
        zoomAtPoint(zoom() / 1.2, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        break;
      case '0':
        setZoom(MIN_ZOOM);
        setOffset({ x: 0, y: 0 });
        break;
    }
  };

  onMount(() => {
    if (isServer) return;
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    if (isServer) return;
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={props.open && props.photos.length > 0}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center lightbox-backdrop backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <button
          class="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
          onClick={props.onClose}
          aria-label="Close"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <Show when={props.photos.length > 1}>
          <button
            class="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
            onClick={props.onPrevious}
            aria-label="Previous"
          >
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            class="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
            onClick={props.onNext}
            aria-label="Next"
          >
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Show>

        <div class="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
          <div
            ref={viewport}
            class="lightbox-viewport"
            classList={{ 'lightbox-viewport-zoomed': zoom() > MIN_ZOOM }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <div
              class="lightbox-frame"
              style={{
                transform: `translate3d(${offset().x}px, ${offset().y}px, 0) scale(${zoom()})`,
                cursor:
                  zoom() > MIN_ZOOM
                    ? pointerDown()
                      ? 'grabbing'
                      : 'grab'
                    : 'zoom-in',
              }}
            >
              <SmartImage
                src={photo()?.src}
                alt={photo()?.alt || ''}
                loading="eager"
                naturalSizing
                fit="contain"
                class="max-h-[75vh] max-w-full"
                onStateChange={setImageState}
              />
            </div>
          </div>

          <div class="mt-3 flex items-center justify-center gap-3 text-xs text-white/45">
            <span>{zoom().toFixed(1)}x</span>
            <Show when={zoom() > MIN_ZOOM}>
              <span aria-hidden="true">·</span>
              <span>拖拽移动 / 双击复位</span>
            </Show>
          </div>

          <Show when={photo() && (photo()?.title || photo()?.camera)}>
            <div class="mt-2 text-center text-white/80 text-sm px-4">
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
