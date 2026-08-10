/**
 * Table of Contents Component
 * Uses useScrollSpy hook for heading extraction and scroll tracking
 */

import { createSignal, onMount, For, Show } from 'solid-js';
import { isServer } from 'solid-js/web';
import { useScrollSpy, extractHeadings, type TOCItem } from '../../lib/hooks/useScrollSpy';

export default function TableOfContents() {
  const [items, setItems] = createSignal<TOCItem[]>([]);
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [isVisible, setIsVisible] = createSignal(false);

  const { progress, activeIds, setKnownHeadings, updateProgress, updateVisibleHeadings } =
    useScrollSpy();

  let retryCount = 0;

  onMount(() => {
    if (isServer) return;

    // Watch for article content to be rendered
    const contentWrapper = document.querySelector('.article-content-wrapper');
    if (contentWrapper) {
      const observer = new MutationObserver(tryExtractHeadings);
      observer.observe(contentWrapper, { childList: true, subtree: true });
      onMount(() => observer.disconnect);
    }

    // Try multiple times for async content
    [100, 300, 500, 1000, 2000].forEach((delay) => {
      setTimeout(() => {
        if (items().length === 0 && retryCount < 10) tryExtractHeadings();
      }, delay);
    });

    setTimeout(() => setIsVisible(true), 100);
  });

  function tryExtractHeadings() {
    const prevLength = items().length;
    const headings = extractHeadings('.article-content-html');
    if (headings.length === 0) return;

    setItems(headings);
    setKnownHeadings(new Set(headings.map((h) => h.id)));

    if (headings.length !== prevLength) {
      setTimeout(() => {
        updateVisibleHeadings();
        updateProgress();
      }, 50);
    }
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <nav
      class={`toc-container ${isVisible() ? 'toc-visible' : ''}`}
      aria-label="Table of Contents"
    >
      <div class="toc-progress">
        <div class="toc-progress-bar" style={{ transform: `scaleX(${progress()})` }} />
      </div>
      <div class="toc-progress-text">{Math.round(progress() * 100)}%</div>

      <button class="toc-header" onClick={() => setIsExpanded(!isExpanded())} aria-expanded={isExpanded()}>
        <span class="toc-title">目录</span>
        <svg class={`toc-chevron ${isExpanded() ? 'toc-chevron-expanded' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <Show when={isExpanded()}>
        <ul class="toc-list">
          <For each={items()}>
            {(item) => (
              <li class={`toc-item toc-item-level-${item.level} ${activeIds().has(item.id) ? 'toc-item-active' : ''}`}>
                <button class="toc-link" onClick={() => scrollToHeading(item.id)}>
                  <span class="toc-dot" />
                  <span class="toc-text">{item.text}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </nav>
  );
}
