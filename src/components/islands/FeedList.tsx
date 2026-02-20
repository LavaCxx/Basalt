import { createSignal, onMount, For, Show } from 'solid-js';
import type { FeedItem } from '../../lib/types';

interface PhotoItem {
  id: string;
  src: string;
  thumbnail: string;
  alt: string;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const isCurrentYear = d.getFullYear() === now.getFullYear();

  if (isCurrentYear) {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

function getPhotoItems(item: FeedItem): PhotoItem[] {
  const attachments = (item.metadata as any)?.attachments || [];
  const photoItems: PhotoItem[] = [];

  if (item.image) {
    photoItems.push({
      id: `${item.id}-main`,
      src: item.image,
      thumbnail: item.image,
      alt: item.title || '',
    });
  }

  for (const att of attachments) {
    if (att.type === 'image' && att.url && !photoItems.some(p => p.src === att.url)) {
      photoItems.push({
        id: `${item.id}-${att.url.slice(-10)}`,
        src: att.url,
        thumbnail: att.thumbnail || att.url,
        alt: att.alt || '',
      });
    }
  }

  return photoItems;
}

export default function FeedList() {
  const [items, setItems] = createSignal<FeedItem[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class="space-y-0">
      <Show when={loading()}>
        <div class="py-12 text-center text-text-muted">
          加载中...
        </div>
      </Show>

      <For each={items()}>
        {(item) => (
          <article class="group">
            {/* Microblog */}
            {item.type === 'microblog' && (
              <div class="py-4 border-b border-border-subtle">
                <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
                  {item.source === 'telegram' && (
                    <span class="inline-flex items-center gap-1 text-sky-500">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                      </svg>
                      Telegram{(item.metadata as any)?.channel ? ` · ${(item.metadata as any).channel}` : ''}
                    </span>
                  )}
                  {item.source === 'notion' && (
                    <span class="inline-flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                      </svg>
                      Notion
                    </span>
                  )}
                  <time class="ml-auto">{formatDate(item.date)}</time>
                </div>
                <p class="text-text-primary leading-relaxed">{item.content}</p>
                <Show when={getPhotoItems(item).length >= 1}>
                  <div class="mt-3 flex gap-1">
                    <For each={getPhotoItems(item).slice(0, 3)}>
                      {(photo) => (
                        <img
                          src={photo.thumbnail}
                          alt={photo.alt}
                          class="rounded object-cover"
                          classList={{
                            'max-w-xs': getPhotoItems(item).length === 1,
                            'w-24 h-24': getPhotoItems(item).length > 1,
                          }}
                          loading="lazy"
                        />
                      )}
                    </For>
                  </div>
                </Show>
                <div class="mt-2 flex items-center gap-4 text-xs text-text-muted">
                  <Show when={(item.metadata as any)?.likes !== undefined}>
                    <span>{(item.metadata as any).likes} 赞</span>
                  </Show>
                  <Show when={(item.metadata as any)?.replies !== undefined}>
                    <span>{(item.metadata as any).replies} 评论</span>
                  </Show>
                </div>
              </div>
            )}

            {/* Photo */}
            {item.type === 'photo' && item.image && (
              <div class="py-4 border-b border-border-subtle">
                <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
                  {item.source === 'notion' && (
                    <span class="inline-flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                      </svg>
                      Notion
                    </span>
                  )}
                  {item.source === 'telegram' && (
                    <span class="inline-flex items-center gap-1 text-sky-500">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                      </svg>
                      Telegram{(item.metadata as any)?.channel ? ` · ${(item.metadata as any).channel}` : ''}
                    </span>
                  )}
                  <time class="ml-auto">{formatDate(item.date)}</time>
                </div>
                <div class="flex gap-4">
                  <a href={item.url || '#'} class="block flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.title || ''}
                      class="w-32 h-32 rounded-lg object-cover"
                      loading="lazy"
                    />
                  </a>
                  <div class="flex-1 min-w-0 py-1">
                    <Show when={item.title}>
                      <h3 class="font-ui text-lg text-text-primary">{item.title}</h3>
                    </Show>
                    <Show when={(item.metadata as any)?.location}>
                      <p class="mt-1 text-xs text-text-muted">{(item.metadata as any).location}</p>
                    </Show>
                  </div>
                </div>
              </div>
            )}

            {/* Media */}
            {item.type === 'media' && (
              <div class="py-4 border-b border-border-subtle">
                <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
                  {item.source === 'douban' && (
                    <span class="inline-flex items-center gap-1 text-[#2D963D]">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.51 3.06h22.98V.755H.51V3.06Zm20.976 2.537v9.608h-2.137l-1.669 5.76H24v2.28H0v-2.28h6.32l-1.67-5.76H2.515V5.597h18.972Zm-5.066 9.608H7.58l1.67 5.76h5.501l1.67-5.76ZM18.367 7.9H5.634v5.025h12.733V7.9Z"/>
                      </svg>
                      豆瓣 · {(item.metadata as any)?.mediaType === 'book' ? '书籍' : (item.metadata as any)?.mediaType === 'movie' ? '电影' : (item.metadata as any)?.mediaType === 'tv' ? '剧集' : (item.metadata as any)?.mediaType === 'music' ? '音乐' : '媒体'}
                    </span>
                  )}
                  <time class="ml-auto">{formatDate(item.date)}</time>
                </div>
                <div class="flex gap-4 items-start">
                  <Show when={item.image}>
                    <a href={item.url || '#'} class="block flex-shrink-0" target="_blank" rel="noopener">
                      <img
                        src={item.image}
                        alt={item.title || ''}
                        class="w-16 h-24 object-cover rounded flex-shrink-0 hover:opacity-80 transition-opacity"
                        loading="lazy"
                      />
                    </a>
                  </Show>
                  <div class="flex-1 min-w-0 -mt-1">
                    <Show when={(item.metadata as any)?.status === 'completed'}>
                      <span class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium leading-none
                        ${(item.metadata as any)?.mediaType === 'book' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                        ${(item.metadata as any)?.mediaType === 'movie' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : ''}
                        ${(item.metadata as any)?.mediaType === 'tv' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                        ${(item.metadata as any)?.mediaType === 'music' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' : ''}
                      `}>
                        {(item.metadata as any)?.mediaType === 'book' && '读完'}
                        {(item.metadata as any)?.mediaType === 'movie' && '看完'}
                        {(item.metadata as any)?.mediaType === 'tv' && '看完'}
                        {(item.metadata as any)?.mediaType === 'music' && '听完'}
                      </span>
                    </Show>
                    <Show when={(item.metadata as any)?.status === 'in_progress'}>
                      <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {(item.metadata as any)?.mediaType === 'book' && '在读'}
                        {(item.metadata as any)?.mediaType === 'movie' && '在看'}
                        {(item.metadata as any)?.mediaType === 'tv' && '在看'}
                        {(item.metadata as any)?.mediaType === 'music' && '在听'}
                      </span>
                    </Show>
                    <Show when={(item.metadata as any)?.status === 'wishlist'}>
                      <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium leading-none bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {(item.metadata as any)?.mediaType === 'book' && '想读'}
                        {(item.metadata as any)?.mediaType === 'movie' && '想看'}
                        {(item.metadata as any)?.mediaType === 'tv' && '想看'}
                        {(item.metadata as any)?.mediaType === 'music' && '想听'}
                      </span>
                    </Show>
                    <a href={item.url || '#'} class="group/title" target="_blank" rel="noopener">
                      <h3 class="font-ui text-base text-text-primary group-hover/title:text-accent transition-colors mt-1.5">{item.title}</h3>
                    </a>
                    <Show when={(item.metadata as any)?.creator}>
                      <p class="text-xs text-text-muted mt-0.5">{(item.metadata as any).creator}</p>
                    </Show>
                    <Show when={(item.metadata as any)?.rating}>
                      <div class="mt-1 flex items-center gap-2">
                        <span class="text-xs tracking-tight">
                          <span class="text-amber-500">{'★'.repeat(Math.round((item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) * 5))}</span>
                          <span class="text-gray-300">{'☆'.repeat(5 - Math.round((item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) * 5))}</span>
                        </span>
                        <span class="text-xs text-text-muted">
                          {((item.metadata as any).rating >= 5 || (item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) >= 0.9) ? '力荐' :
                           ((item.metadata as any).rating >= 4 || (item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) >= 0.7) ? '推荐' :
                           ((item.metadata as any).rating >= 3 || (item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) >= 0.5) ? '还行' :
                           ((item.metadata as any).rating >= 2 || (item.metadata as any).rating / ((item.metadata as any)?.maxRating || 5) >= 0.3) ? '较差' : '很差'}
                        </span>
                      </div>
                    </Show>
                    <Show when={(item.metadata as any)?.review}>
                      <p class="text-sm text-text-secondary mt-1">{(item.metadata as any).review}</p>
                    </Show>
                  </div>
                </div>
              </div>
            )}

            {/* Article */}
            {item.type === 'article' && (
              <div class="py-4 border-b border-border-subtle">
                <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
                  {item.source === 'notion' && (
                    <span class="inline-flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                      </svg>
                      Notion
                    </span>
                  )}
                  {item.source === 'rss' && (
                    <span class="inline-flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
                      </svg>
                      {(item.metadata as any)?.feedName || 'RSS'}
                    </span>
                  )}
                  <time class="ml-auto">{formatDate(item.date)}</time>
                </div>
                <div class="flex gap-4">
                  <Show when={item.image}>
                    <a href={item.url || '#'} class="block flex-shrink-0">
                      <img
                        src={item.image!}
                        alt={item.title || ''}
                        class="w-32 h-24 rounded-lg object-cover"
                        loading="lazy"
                      />
                    </a>
                  </Show>
                  <div class="flex-1 min-w-0">
                    <a href={item.url || '#'} class="group/link">
                      <h3 class="font-ui text-lg text-text-primary group-hover/link:text-accent transition-colors">
                        {item.title}
                      </h3>
                    </a>
                    <Show when={(item.metadata as any)?.excerpt}>
                      <p class="mt-1 text-sm text-text-secondary line-clamp-2">{(item.metadata as any).excerpt}</p>
                    </Show>
                    <Show when={(item.metadata as any)?.readingTime}>
                      <p class="mt-2 text-xs text-text-muted">阅读需要约 {(item.metadata as any).readingTime} 分钟</p>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </article>
        )}
      </For>
    </div>
  );
}
