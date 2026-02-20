import { createSignal, onMount, For, Show } from 'solid-js';
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

export default function MemoriesGallery() {
  const [photoGroups, setPhotoGroups] = createSignal<Record<number, PhotoItem[]>>({});
  const [sortedYears, setSortedYears] = createSignal<number[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await fetch('/api/photos');
      const photos: RawPhoto[] = await res.json();

      // Transform and group by year
      const groups: Record<number, PhotoItem[]> = {};

      photos
        .filter((p) => p.image)
        .forEach((p) => {
          const date = new Date(p.date);
          const year = date.getFullYear();

          if (!groups[year]) {
            groups[year] = [];
          }

          groups[year].push({
            id: p.id,
            src: p.image!,
            thumbnail: p.image!,
            alt: p.title,
            title: p.title,
            date: date,
            location: p.metadata?.location,
          });
        });

      setPhotoGroups(groups);
      setSortedYears(Object.keys(groups).map(Number).sort((a, b) => b - a));
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setLoading(false);
    }
  });

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
