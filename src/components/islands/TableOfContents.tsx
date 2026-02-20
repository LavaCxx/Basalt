/**
 * Table of Contents Component
 * Dynamic TOC with scroll-based highlighting and smooth animations
 * Design: Minimal, matches Frank Chimero / Craig Mod aesthetic
 */

import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { isServer } from 'solid-js/web';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  class?: string;
}

export default function TableOfContents(props: TableOfContentsProps) {
  const [items, setItems] = createSignal<TOCItem[]>([]);
  const [activeIds, setActiveIds] = createSignal<Set<string>>(new Set());
  const [progress, setProgress] = createSignal(0);
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [isVisible, setIsVisible] = createSignal(false);

  let mutationObserver: MutationObserver | null = null;
  let retryCount = 0;
  const maxRetries = 10;
  let knownHeadingIds: Set<string> = new Set(); // Store known heading IDs

  onMount(() => {
    if (isServer) return;

    // Watch for article content to be rendered
    const contentWrapper = document.querySelector('.article-content-wrapper');

    // Set up mutation observer to detect when content is rendered
    mutationObserver = new MutationObserver(() => {
      tryExtractHeadings();
    });

    if (contentWrapper) {
      mutationObserver.observe(contentWrapper, {
        childList: true,
        subtree: true,
      });
    }

    // Try multiple times with delays to handle async content
    tryExtractHeadings();

    // Retry with increasing delays
    const retryIntervals = [100, 300, 500, 1000, 2000];
    retryIntervals.forEach((delay) => {
      setTimeout(() => {
        if (items().length === 0 && retryCount < maxRetries) {
          tryExtractHeadings();
        }
      }, delay);
    });

    // Track scroll progress and visible headings
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    // Show TOC after a brief delay for entrance animation
    setTimeout(() => setIsVisible(true), 100);

    onCleanup(() => {
      mutationObserver?.disconnect();
      window.removeEventListener('scroll', handleScroll);
    });
  });

  function tryExtractHeadings() {
    const prevLength = items().length;
    extractHeadings();
    const newLength = items().length;

    // If we just found headings (or found more), update visibility and progress
    if (newLength > 0 && newLength !== prevLength) {
      // Small delay to ensure DOM is updated with IDs
      setTimeout(() => {
        updateVisibleHeadings();
        updateProgress();
      }, 50);
    }
  }

  function extractHeadings() {
    // Query ALL .article-content-html elements, not just the first
    const containers = document.querySelectorAll('.article-content-html');
    if (containers.length === 0) return;

    const tocItems: TOCItem[] = [];
    const newKnownIds = new Set<string>();
    let globalIndex = 0;

    containers.forEach((container) => {
      const headings = container.querySelectorAll('h1, h2, h3');

      headings.forEach((heading) => {
        // Generate ID if not present
        if (!heading.id) {
          heading.id = `heading-${globalIndex}`;
        }

        const id = heading.id;
        tocItems.push({
          id,
          text: heading.textContent || '',
          level: parseInt(heading.tagName.charAt(1)),
        });

        newKnownIds.add(id);
        globalIndex++;
      });
    });

    // Don't update if no headings found yet
    if (tocItems.length === 0) return;

    // Store known IDs for visibility checking
    knownHeadingIds = newKnownIds;
    setItems(tocItems);
  }

  let ticking = false;

  function handleScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateProgress();
        updateVisibleHeadings();
        ticking = false;
      });
      ticking = true;
    }
  }

  function updateProgress() {
    const article = document.querySelector('.article-content');
    if (!article) return;

    const scrollTop = window.scrollY;
    const articleRect = article.getBoundingClientRect();
    const articleTop = articleRect.top + scrollTop; // Current position from page top
    const articleHeight = article.offsetHeight;
    const windowHeight = window.innerHeight;

    // Calculate progress based on how much of the article has been scrolled past
    // 0% = article top is at viewport top
    // 100% = article bottom is at viewport bottom
    const scrollableDistance = articleHeight - windowHeight;
    const scrolledDistance = scrollTop - (articleTop - windowHeight * 0.1);

    let progressValue = 0;
    if (scrollableDistance > 0) {
      progressValue = Math.min(Math.max(scrolledDistance / scrollableDistance, 0), 1);
    } else {
      // Article is shorter than viewport
      progressValue = 1;
    }

    setProgress(progressValue);
  }

  function updateVisibleHeadings() {
    // Skip if we haven't found any headings yet
    if (knownHeadingIds.size === 0) return;

    const headings = document.querySelectorAll('.article-content-html h1, .article-content-html h2, .article-content-html h3');
    const windowHeight = window.innerHeight;
    const zoneTop = -50; // Buffer above viewport
    const zoneBottom = windowHeight - 50; // Almost entire viewport

    const visibleIds = new Set<string>();

    headings.forEach((heading) => {
      const id = heading.id;
      // Skip if no ID or not in our known headings
      if (!id || !knownHeadingIds.has(id)) return;

      const rect = heading.getBoundingClientRect();

      // Check if heading is within the visible zone
      if (rect.top < zoneBottom && rect.bottom > zoneTop) {
        visibleIds.add(id);
      }
    });

    setActiveIds(visibleIds);
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id);
    if (!element) return;

    const offset = 100; // Account for fixed header if any
    const top = element.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }

  function toggleExpand() {
    setIsExpanded(!isExpanded());
  }

  return (
    <nav
      class={`toc-container ${props.class || ''} ${isVisible() ? 'toc-visible' : ''}`}
      aria-label="Table of Contents"
    >
      {/* Progress bar */}
      <div class="toc-progress">
        <div
          class="toc-progress-bar"
          style={{ transform: `scaleX(${progress()})` }}
        />
      </div>
      <div class="toc-progress-text">{Math.round(progress() * 100)}%</div>

      {/* Header */}
      <button
        class="toc-header"
        onClick={toggleExpand}
        aria-expanded={isExpanded()}
      >
        <span class="toc-title">目录</span>
        <svg
          class={`toc-chevron ${isExpanded() ? 'toc-chevron-expanded' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Items */}
      <Show when={isExpanded()}>
        <ul class="toc-list">
          <For each={items()}>
            {(item) => (
              <li
                class={`toc-item toc-item-level-${item.level} ${
                  activeIds().has(item.id) ? 'toc-item-active' : ''
                }`}
              >
                <button
                  class="toc-link"
                  onClick={() => scrollToHeading(item.id)}
                  data-active={activeIds().has(item.id)}
                >
                  <span class="toc-dot" />
                  <span class="toc-text">{item.text}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <style>{`
        .toc-container {
          position: sticky;
          top: 5rem;
          max-height: calc(100vh - 7rem);
          display: flex;
          flex-direction: column;
          font-family: var(--font-sans);
          opacity: 0;
          transform: translateX(10px);
          transition: opacity 0.4s ease, transform 0.4s ease;
          user-select: none;
        }

        .toc-visible {
          opacity: 1;
          transform: translateX(0);
        }

        /* Progress bar */
        .toc-progress {
          flex-shrink: 0;
          height: 2px;
          background: var(--color-border-subtle, #e5e5e5);
          border-radius: 1px;
          overflow: hidden;
          margin-bottom: 2px;
        }

        .toc-progress-bar {
          height: 100%;
          background: var(--color-text-primary);
          transform-origin: left;
          transition: transform 0.1s ease-out;
        }

        .toc-progress-text {
          font-size: 0.625rem;
          font-weight: 500;
          color: var(--color-text-muted);
          text-align: right;
          margin-bottom: 1rem;
          font-variant-numeric: tabular-nums;
        }

        /* Header */
        .toc-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.5rem 0;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .toc-title {
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-text-muted);
        }

        .toc-chevron {
          width: 0.875rem;
          height: 0.875rem;
          color: var(--color-text-muted);
          transition: transform 0.2s ease;
        }

        .toc-chevron-expanded {
          transform: rotate(90deg);
        }

        /* List */
        .toc-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: visible;
          list-style: none;
          padding: 0;
          padding-left: 4px;
          margin: 0.75rem 0 0;
        }

        /* Scrollbar styling */
        .toc-list::-webkit-scrollbar {
          width: 3px;
        }
        .toc-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .toc-list::-webkit-scrollbar-thumb {
          background: var(--color-border-subtle, #e5e5e5);
          border-radius: 2px;
        }

        /* Item */
        .toc-item {
          margin: 0;
          padding: 0;
        }

        .toc-link {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          width: 100%;
          padding: 0.375rem 0.5rem;
          margin-left: -0.5rem;
          background: none;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .toc-link:hover {
          background: rgba(0, 0, 0, 0.06);
        }

        .toc-text {
          font-size: 0.8125rem;
          line-height: 1.4;
          color: var(--color-text-muted);
          transition: color 0.2s ease;
        }

        /* Dot indicator */
        .toc-dot {
          flex-shrink: 0;
          width: 6px;
          height: 6px;
          margin-top: 0.4rem;
          border-radius: 50%;
          background: var(--color-border-subtle, #e5e5e5);
          transition: all 0.25s ease;
        }

        /* Level indentation */
        .toc-item-level-1 {
          padding-left: 0.25rem;
        }
        .toc-item-level-2 {
          padding-left: 1rem;
        }
        .toc-item-level-3 {
          padding-left: 1.75rem;
        }

        /* Active state */
        .toc-item-active .toc-dot {
          background: var(--color-text-primary);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
          transform: scale(1.2);
        }

        .toc-item-active .toc-text {
          color: var(--color-text-primary);
          font-weight: 500;
        }

        /* Hover state */
        .toc-link:hover .toc-text {
          color: var(--color-text-primary);
        }

        .toc-link:hover .toc-dot {
          background: var(--color-text-secondary);
        }

        .toc-item-active .toc-link:hover .toc-dot {
          background: var(--color-text-primary);
        }

        /* Entrance animation for items */
        .toc-list .toc-item {
          animation: tocItemFadeIn 0.3s ease forwards;
          opacity: 0;
        }

        @keyframes tocItemFadeIn {
          from {
            opacity: 0;
            transform: translateX(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .toc-list .toc-item:nth-child(1) { animation-delay: 0.05s; }
        .toc-list .toc-item:nth-child(2) { animation-delay: 0.1s; }
        .toc-list .toc-item:nth-child(3) { animation-delay: 0.15s; }
        .toc-list .toc-item:nth-child(4) { animation-delay: 0.2s; }
        .toc-list .toc-item:nth-child(5) { animation-delay: 0.25s; }
        .toc-list .toc-item:nth-child(6) { animation-delay: 0.3s; }
        .toc-list .toc-item:nth-child(7) { animation-delay: 0.35s; }
        .toc-list .toc-item:nth-child(8) { animation-delay: 0.4s; }
        .toc-list .toc-item:nth-child(9) { animation-delay: 0.45s; }
        .toc-list .toc-item:nth-child(10) { animation-delay: 0.5s; }
      `}</style>
    </nav>
  );
}
