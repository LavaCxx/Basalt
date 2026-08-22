import { Show } from 'solid-js';
import type { ArticleFeedItem } from '../../../lib/types';
import SourceBadge from '../SourceBadge';
import SmartImage from '../SmartImage';
import { formatTime } from './formatDate';

export default function ArticleCard(props: { item: ArticleFeedItem }) {
  const item = () => props.item;
  const meta = () => item().metadata;
  const hasImage = () => Boolean(item().image);

  return (
    <div class="article-feed-card" classList={{ 'article-feed-card--no-image': !hasImage() }}>
      <div class="article-feed-meta">
        <SourceBadge source={item().source} feedName={meta()?.feedName} />
        <time class="feed-card-time">{formatTime(item().date)}</time>
        <Show when={meta()?.readingTime}>
          <span class="article-feed-reading">约 {meta()!.readingTime} 分钟</span>
        </Show>
      </div>
      <div class="article-feed-layout">
        <Show when={item().image}>
          <Show
            when={item().url}
            fallback={<SmartImage src={item().image} alt={item().title || ''} class="article-feed-image" width={256} height={192} />}
          >
            {(url) => (
              <a href={url()} class="article-feed-image-link" aria-label={`阅读文章：${item().title || ''}`}>
                <SmartImage src={item().image} alt="" class="article-feed-image" width={256} height={192} />
              </a>
            )}
          </Show>
        </Show>
        <div class="article-feed-copy">
          <Show
            when={item().url}
            fallback={<h3 class="article-feed-title">{item().title}</h3>}
          >
            {(url) => (
              <a href={url()} class="group/link">
                <h3 class="article-feed-title">{item().title}</h3>
              </a>
            )}
          </Show>
          <Show when={meta()?.excerpt}>
            <p class="article-feed-excerpt line-clamp-2">{meta()!.excerpt}</p>
          </Show>
          <Show when={item().url}>
            <span class="article-feed-read" aria-hidden="true">阅读全文<span class="article-feed-arrow link-arrow-icon">↗</span></span>
          </Show>
        </div>
      </div>
    </div>
  );
}
