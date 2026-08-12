/**
 * Parse article HTML content into blocks (html / gallery)
 * Extracted from ArticleContent.tsx for separation of concerns
 */

export interface PhotoItem {
  id: string;
  src: string;
  thumbnail: string;
  alt: string;
  title?: string;
}

export interface ContentBlock {
  type: 'html' | 'gallery';
  html?: string;
  photos?: PhotoItem[];
}

/**
 * Parse HTML content string into structured blocks.
 * Images are extracted into gallery blocks, remaining HTML preserved as-is.
 * Must run in browser (uses DOMParser).
 */
export function parseArticleContent(html: string): { blocks: ContentBlock[]; photos: PhotoItem[] } {
  const parsedBlocks: ContentBlock[] = [];
  const photos: PhotoItem[] = [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let currentHtml = '';
  let currentPhotos: PhotoItem[] = [];
  let photoId = 0;

  const flushHtml = () => {
    if (currentHtml.trim()) {
      parsedBlocks.push({ type: 'html', html: currentHtml });
      currentHtml = '';
    }
  };

  const flushPhotos = () => {
    if (currentPhotos.length > 0) {
      parsedBlocks.push({ type: 'gallery', photos: [...currentPhotos] });
      photos.push(...currentPhotos);
      currentPhotos = [];
    }
  };

  /** Check if an <img> is a functional icon (not article content) */
  const isFunctionalIcon = (img: Element): boolean => {
    return img.classList.contains('notion-bookmark-icon')
      || img.classList.contains('callout-icon');
  };

  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      if (element.tagName === 'IMG' && !isFunctionalIcon(element)) {
        flushHtml();
        const img = element as HTMLImageElement;
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const title = img.closest('figure')?.querySelector('figcaption')?.textContent || '';
        if (src) {
          currentPhotos.push({
            id: `article-img-${photoId++}`,
            src,
            thumbnail: src,
            alt,
            title,
          });
        }
      } else if (element.tagName === 'FIGURE') {
        flushHtml();
        for (const img of Array.from(element.querySelectorAll('img'))) {
          if (isFunctionalIcon(img)) continue;
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          const title = img.closest('figure')?.querySelector('figcaption')?.textContent || '';
          if (src) {
            currentPhotos.push({
              id: `article-img-${photoId++}`,
              src,
              thumbnail: src,
              alt,
              title,
            });
          }
        }
      } else {
        const hasImages = element.querySelector('img:not(.notion-bookmark-icon):not(.callout-icon)') !== null;
        if (!hasImages) {
          currentHtml += element.outerHTML;
        } else {
          for (const child of Array.from(element.childNodes)) {
            processNode(child);
          }
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) {
        currentHtml += node.textContent;
      }
    }
  };

  for (const child of Array.from(doc.body.childNodes)) {
    processNode(child);
  }

  flushPhotos();
  flushHtml();

  return { blocks: parsedBlocks, photos };
}
