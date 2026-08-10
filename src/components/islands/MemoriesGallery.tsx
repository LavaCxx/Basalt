import { createSignal, For, Show } from 'solid-js';
import PhotoGallery, { type PhotoItem } from './PhotoGallery';

interface RawPhoto {
  id: string;
  image?: string;
  title?: string;
  date: string;
  metadata?: {
    location?: string;
  };
}

interface MemoriesGalleryProps {
  photoGroups?: Record<string, RawPhoto[]>;
}

export default function MemoriesGallery(props: MemoriesGalleryProps) {
  // Transform pre-grouped photos from server
  const groups: Record<number, PhotoItem[]> = {};
  for (const [year, photos] of Object.entries(props.photoGroups || {})) {
    groups[Number(year)] = photos
      .filter((p) => p.image)
      .map((p) => ({
        id: p.id,
        src: p.image!,
        thumbnail: p.image!,
        alt: p.title,
        title: p.title,
        date: new Date(p.date),
        location: p.metadata?.location,
      }));
  }

  const [photoGroups] = createSignal<Record<number, PhotoItem[]>>(groups);
  const [sortedYears] = createSignal<number[]>(
    Object.keys(groups).map(Number).sort((a, b) => b - a)
  );
  const [loading] = createSignal(false);

  return (
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header class="mb-12">
        <h1 class="font-ui text-4xl font-bold text-text-primary mb-2">
          相册
        </h1>
        <p class="text-text-secondary">
          定格时光的照片与记忆
        </p>
      </header>

      {/* Loading */}
      <Show when={loading()}>
        <div class="py-12 text-center text-text-muted">
          加载中...
        </div>
      </Show>

      {/* Empty */}
      <Show when={!loading() && sortedYears().length === 0}>
        <div class="text-center py-12 text-text-secondary">
          <p>暂无照片</p>
        </div>
      </Show>

      {/* Photo Galleries by Year */}
      <For each={sortedYears()}>
        {(year) => (
          <section class="mb-12">
            <h2 class="font-ui text-2xl font-semibold text-text-primary mb-6">
              {year}
            </h2>
            <PhotoGallery
              photos={photoGroups()[year]}
              columns={4}
              gap={8}
              aspectRatio="square"
              showInfo={true}
            />
          </section>
        )}
      </For>
    </div>
  );
}
