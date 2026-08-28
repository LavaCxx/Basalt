/**
 * Scroll spy hook for Table of Contents
 * Extracts headings, tracks scroll progress, and detects visible headings.
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

export interface TOCItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract headings from rendered article content
 */
export function extractHeadings(containerSelector: string): TOCItem[] {
  const containers = document.querySelectorAll(containerSelector);
  if (containers.length === 0) return [];

  const items: TOCItem[] = [];
  let index = 0;

  containers.forEach((container) => {
    container.querySelectorAll('h1, h2, h3').forEach((heading) => {
      if (!heading.id) {
        heading.id = `heading-${index}`;
      }
      items.push({
        id: heading.id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1)),
      });
      index++;
    });
  });

  return items;
}

interface ScrollSpyOptions {
  contentSelector?: string;
  headingContainerSelector?: string;
}

/**
 * Scroll spy: tracks reading progress and which headings are visible
 */
export function useScrollSpy(options?: ScrollSpyOptions) {
  const contentSelector = options?.contentSelector || '.article-content';
  const headingContainerSelector = options?.headingContainerSelector || '.article-content-html';
  const [progress, setProgress] = createSignal(0);
  const [activeIds, setActiveIds] = createSignal<Set<string>>(new Set());
  let knownHeadingIds = new Set<string>();
  let ticking = false;

  function updateProgress() {
    const article = document.querySelector<HTMLElement>(contentSelector);
    if (!article) return;

    const scrollTop = window.scrollY;
    const articleRect = article.getBoundingClientRect();
    const articleTop = articleRect.top + scrollTop;
    const articleHeight = article.offsetHeight;
    const windowHeight = window.innerHeight;

    const scrollableDistance = articleHeight - windowHeight;
    const scrolledDistance = scrollTop - (articleTop - windowHeight * 0.1);

    let progressValue = 0;
    if (scrollableDistance > 0) {
      progressValue = Math.min(Math.max(scrolledDistance / scrollableDistance, 0), 1);
    } else {
      progressValue = 1;
    }

    setProgress(progressValue);
  }

  function updateVisibleHeadings() {
    if (knownHeadingIds.size === 0) return;

    const headings = document.querySelectorAll(
      `${headingContainerSelector} h1, ${headingContainerSelector} h2, ${headingContainerSelector} h3`
    );
    const scrollOffset = 120;
    let activeId: string | null = null;

    headings.forEach((heading) => {
      const id = heading.id;
      if (!id || !knownHeadingIds.has(id)) return;

      const rect = heading.getBoundingClientRect();
      if (rect.top < scrollOffset) {
        activeId = id;
      }
    });

    setActiveIds(activeId ? new Set<string>([activeId]) : new Set<string>());
  }

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

  onMount(() => {
    if (isServer) return;
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    onCleanup(() => window.removeEventListener('scroll', handleScroll));
  });

  function setKnownHeadings(ids: Set<string>) {
    knownHeadingIds = ids;
  }

  return { progress, activeIds, setKnownHeadings, updateProgress, updateVisibleHeadings };
}
