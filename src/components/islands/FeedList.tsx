/**
 * Feed List — renders mixed feed items using type-specific card components
 * Data is passed from server-side render (index.astro)
 */

import { createMemo, createSignal, Show, For, Switch, Match } from 'solid-js';
import type { FeedItem } from '../../lib/types';
import MicroblogCard from './feed-cards/MicroblogCard';
import PhotoCard from './feed-cards/PhotoCard';
import MediaCard from './feed-cards/MediaCard';
import ArticleCard from './feed-cards/ArticleCard';

interface FeedListProps {
  items?: SerializedFeedItem[];
  nextCursor?: string | null;
  excludeItemId?: string;
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
  const isVisible = (item: FeedItem) => item.id !== props.excludeItemId;
  const visibleItems = createMemo(() => items().filter(isVisible));
  const groups = createMemo(() => {
    const grouped: Array<{ key: string; date: Date; items: FeedItem[] }> = [];

    for (const item of visibleItems()) {
      const date = item.date;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const lastGroup = grouped.at(-1);
      if (lastGroup?.key === key) {
        lastGroup.items.push(item);
      } else {
        grouped.push({ key, date, items: [item] });
      }
    }

    return grouped;
  });

  const formatDay = (date: Date) => date.toLocaleDateString('zh-CN', {
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
  });
  const formatWeekday = (date: Date) => date.toLocaleDateString('zh-CN', { weekday: 'short' });

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
    <div class="feed-timeline">
      <div class="feed-timeline-heading">
        <h2>近期轨迹</h2>
      </div>
      <Show when={error()}>
        <p class="pt-4 text-center text-sm text-text-muted" role="status">{error()}</p>
      </Show>

      <For each={groups()}>
        {(group) => (
          <section class="feed-timeline-day">
            <header class="feed-timeline-date">
              <time datetime={group.date.toISOString()}>{formatDay(group.date)}</time>
              <span>{formatWeekday(group.date)}</span>
            </header>
            <div class="feed-timeline-day-items">
              <For each={group.items}>
                {(item) => (
                  <article class={`feed-timeline-entry feed-timeline-entry--${item.type} group`}>
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
            </div>
          </section>
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
