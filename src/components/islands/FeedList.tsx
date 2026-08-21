/**
 * Feed List — renders mixed feed items using type-specific card components
 * Data is passed from server-side render (index.astro)
 */

import { createSignal, Show, For, Switch, Match } from 'solid-js';
import type { FeedItem } from '../../lib/types';
import MicroblogCard from './feed-cards/MicroblogCard';
import PhotoCard from './feed-cards/PhotoCard';
import MediaCard from './feed-cards/MediaCard';
import ArticleCard from './feed-cards/ArticleCard';

interface FeedListProps {
  items?: SerializedFeedItem[];
  nextCursor?: string | null;
}

type SerializedFeedItem = FeedItem extends infer Item
  ? Item extends FeedItem
    ? Omit<Item, 'date'> & { date: string | Date }
    : never
  : never;

export default function FeedList(props: FeedListProps) {
  const [items, setItems] = createSignal<FeedItem[]>(
    (props.items || []).map((item) => ({
      ...item,
      date: new Date(item.date),
    })) as FeedItem[]
  );
  const [nextCursor, setNextCursor] = createSignal(props.nextCursor || null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const loadMore = async () => {
    const cursor = nextCursor();
    if (!cursor || loading()) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/feed?limit=30&cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error(`Feed request failed with ${response.status}`);
      const page = await response.json() as {
        items: Array<Record<string, unknown> & { id: string; date: string }>;
        nextCursor: string | null;
      };
      const nextItems = page.items.map((item) => ({
        ...item,
        date: new Date(item.date),
      })) as FeedItem[];
      const existingIds = new Set(items().map((item) => item.id));
      setItems((current) => [...current, ...nextItems.filter((item) => !existingIds.has(item.id))]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      console.error('Failed to load more feed items:', loadError);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-0">
      <Show when={error()}>
        <p class="pt-4 text-center text-sm text-text-muted" role="status">{error()}</p>
      </Show>

      <For each={items()}>
        {(item) => (
          <article class="group">
            <Switch fallback={<div></div>}>
              <Match when={item.type === 'microblog'}>
                <MicroblogCard item={item as any} />
              </Match>
              <Match when={item.type === 'photo' && item.image}>
                <PhotoCard item={item as any} />
              </Match>
              <Match when={item.type === 'media'}>
                <MediaCard item={item as any} />
              </Match>
              <Match when={item.type === 'article'}>
                <ArticleCard item={item as any} />
              </Match>
            </Switch>
          </article>
        )}
      </For>

      <Show when={nextCursor()}>
        <button
          type="button"
          class="mt-6 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-secondary transition-all hover:border-text-muted hover:text-text-primary disabled:cursor-wait disabled:opacity-60"
          disabled={loading()}
          aria-busy={loading()}
          onClick={loadMore}
        >
          {loading() ? '加载中…' : '加载更多'}
        </button>
      </Show>
    </div>
  );
}
