/**
 * Article Content Renderer
 * Parses HTML content and renders images with PhotoGallery lightbox
 * Includes syntax highlighting using Shiki
 */

import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { isServer } from 'solid-js/web';
import PhotoGallery, { type PhotoItem } from './PhotoGallery';
import { codeToHtml } from 'shiki';

interface ArticleContentProps {
  content: string;
}

interface ContentBlock {
  type: 'html' | 'gallery';
  html?: string;
  photos?: PhotoItem[];
}

export default function ArticleContent(props: ArticleContentProps) {
  const [blocks, setBlocks] = createSignal<ContentBlock[]>([]);
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [lightboxIndex, setLightboxIndex] = createSignal(0);
  const [allPhotos, setAllPhotos] = createSignal<PhotoItem[]>([]);
  const [isHighlighted, setIsHighlighted] = createSignal(false);

  onMount(() => {
    parseContent();
  });

  function parseContent() {
    const html = props.content;
    const parsedBlocks: ContentBlock[] = [];
    const photos: PhotoItem[] = [];

    // Parse HTML to extract images and other content
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

    // Process child nodes
    const processNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;

        if (element.tagName === 'FIGURE' || element.tagName === 'IMG') {
          // Found an image - flush current HTML and collect images
          flushHtml();

          const imgs = element.tagName === 'IMG'
            ? [element as HTMLImageElement]
            : Array.from(element.querySelectorAll('img'));

          for (const img of imgs) {
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
          // Check if this element contains images
          const hasImages = element.querySelector('img') !== null;
          if (!hasImages) {
            // No images, keep as HTML
            currentHtml += element.outerHTML;
          } else {
            // Has images, process children
            for (const child of Array.from(element.childNodes)) {
              processNode(child);
            }
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Skip empty text nodes
        if (node.textContent?.trim()) {
          currentHtml += node.textContent;
        }
      }
    };

    // Process top-level nodes
    for (const child of Array.from(doc.body.childNodes)) {
      processNode(child);
    }

    // Flush remaining content
    flushPhotos();
    flushHtml();

    setBlocks(parsedBlocks);
    setAllPhotos(photos);

    // Apply syntax highlighting after render
    setTimeout(() => {
      highlightCodeBlocks();
      addImageClickHandlers();
    }, 0);
  }

  async function highlightCodeBlocks() {
    const container = document.querySelector('.article-content-wrapper');
    if (!container) return;

    const codeBlocks = container.querySelectorAll('pre code[class*="language-"]');

    for (const block of codeBlocks) {
      const element = block as HTMLElement;
      const classList = Array.from(element.classList);
      const langClass = classList.find(c => c.startsWith('language-'));
      let lang = langClass?.replace('language-', '') || 'text';

      // Map common language names
      const langMap: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'sh': 'bash',
        'shell': 'bash',
        'yml': 'yaml',
        'md': 'markdown',
      };
      lang = langMap[lang] || lang;

      const code = element.textContent || '';

      try {
        const html = await codeToHtml(code, {
          lang,
          theme: 'github-light',
        });
        // Replace the entire pre element with Shiki's highlighted HTML
        const pre = element.parentElement;
        if (pre) {
          pre.outerHTML = html;
        }
      } catch {
        // If language not supported, keep original
        console.warn(`Shiki: Language "${lang}" not supported`);
      }
    }

    setIsHighlighted(true);
  }

  function addImageClickHandlers() {
    const container = document.querySelector('.article-content-wrapper');
    if (!container) return;

    const images = container.querySelectorAll('.article-content-html img');
    images.forEach((img, index) => {
      img.addEventListener('click', () => {
        setLightboxIndex(index);
        setLightboxOpen(true);
        document.body.style.overflow = 'hidden';
      });
      (img as HTMLElement).style.cursor = 'pointer';
    });
  }

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = '';
  };

  const goToPrevious = () => {
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : allPhotos().length - 1));
  };

  const goToNext = () => {
    setLightboxIndex((prev) => (prev < allPhotos().length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!lightboxOpen()) return;
    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
    }
  };

  onMount(() => {
    if (!isServer) {
      document.addEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    if (!isServer) {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  return (
    <div class="article-content-wrapper">
      <For each={blocks()}>
        {(block) => (
          <>
            <Show when={block.type === 'html'}>
              <div class="article-content-html" innerHTML={block.html} />
            </Show>
            <Show when={block.type === 'gallery' && block.photos && block.photos.length > 0}>
              <div class="article-gallery">
                <PhotoGallery
                  photos={block.photos!}
                  columns={Math.min(block.photos!.length, 2)}
                  gap={8}
                  aspectRatio="auto"
                  showInfo={false}
                />
              </div>
            </Show>
          </>
        )}
      </For>

      {/* Lightbox for inline images */}
      <Show when={lightboxOpen() && allPhotos().length > 0}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          <button
            class="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
            onClick={closeLightbox}
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <Show when={allPhotos().length > 1}>
            <button
              class="absolute left-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
              onClick={goToPrevious}
            >
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              class="absolute right-4 z-10 p-2 text-white/70 hover:text-white transition-colors"
              onClick={goToNext}
            >
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </Show>

          <img
            src={allPhotos()[lightboxIndex()]?.src}
            alt={allPhotos()[lightboxIndex()]?.alt || ''}
            class="max-h-[85vh] max-w-[90vw] object-contain"
          />

          <Show when={allPhotos().length > 1}>
            <p class="absolute bottom-4 text-xs text-white/40">
              {lightboxIndex() + 1} / {allPhotos().length}
            </p>
          </Show>
        </div>
      </Show>

      <style>{`
        .article-gallery {
          margin: 2rem 0;
        }
        .article-content-html img {
          cursor: pointer;
          transition: transform 0.2s;
        }
        .article-content-html img:hover {
          transform: scale(1.01);
        }

        /* Code block base styles */
        .article-content-html pre {
          background: #faf9f6;
          border: 1px solid var(--color-border-subtle, #e5e5e5);
          border-radius: 0.375rem;
          padding: 1rem 1.25rem;
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .article-content-html code {
          font-family: var(--font-mono);
          font-size: 0.875rem;
          line-height: 1.6;
          background: transparent;
          padding: 0;
        }

        /* Shiki highlighted code */
        .article-content-html .shiki {
          background: #faf9f6 !important;
          border: 1px solid var(--color-border-subtle, #e5e5e5);
          border-radius: 0.375rem;
          padding: 1rem 1.25rem;
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .article-content-html .shiki code {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
