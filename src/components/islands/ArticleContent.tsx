/**
 * Article Content Renderer
 * Parses HTML content into blocks and renders images with PhotoGallery + Lightbox
 * Syntax highlighting is done server-side via Shiki in notion.ts
 */

import { createSignal, onMount, Show, For } from 'solid-js';
import PhotoGallery from './PhotoGallery';
import Lightbox from './Lightbox';
import { parseArticleContent, type ContentBlock, type PhotoItem } from '../../lib/utils/parse-content';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent(props: ArticleContentProps) {
  const [blocks, setBlocks] = createSignal<ContentBlock[]>([]);
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [lightboxIndex, setLightboxIndex] = createSignal(0);
  const [allPhotos, setAllPhotos] = createSignal<PhotoItem[]>([]);

  onMount(() => {
    const { blocks: parsedBlocks, photos } = parseArticleContent(props.content);
    setBlocks(parsedBlocks);
    setAllPhotos(photos);

    // Attach click handlers to images for lightbox
    setTimeout(() => {
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

      // Inject copy buttons into code blocks
      const codeBlocks = container.querySelectorAll('.article-content-html .code-block');
      codeBlocks.forEach((block) => {
        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = '复制';
        btn.addEventListener('click', async () => {
          const code = block.querySelector('code');
          if (!code) return;
          try {
            await navigator.clipboard.writeText(code.textContent || '');
            btn.textContent = '已复制';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.textContent = '复制';
              btn.classList.remove('copied');
            }, 2000);
          } catch {
            btn.textContent = '复制失败';
            setTimeout(() => { btn.textContent = '复制'; }, 2000);
          }
        });
        block.appendChild(btn);
      });

    }, 0);
  });

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

      <Lightbox
        open={lightboxOpen()}
        photos={allPhotos()}
        index={lightboxIndex()}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />

      <style>{`
        .article-gallery {
          margin: 2rem 0;
        }
        .article-content-html img {
          cursor: pointer;
        }

        /* Code blocks — light gray theme, let Shiki bg show */
        .article-content-html pre,
        .article-content-html .shiki {
          border-radius: 0.5rem;
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.875rem;
          line-height: 1.6;
          border: 1px solid var(--color-border, #e5e5e5);
        }

        /* Shiki: keep its own background, override only in dark mode */
        .dark .article-content-html .shiki,
        .dark .article-content-html .shiki span {
          color: var(--color-dark-text-secondary, #a3a3a3) !important;
          background-color: var(--color-dark-background-alt, #141414) !important;
        }

        /* Inline code (outside pre) — Notion style: gray bg + red text */
        .article-content-html :not(pre) > code {
          font-family: var(--font-mono);
          background: #ededf0;
          color: #e16259;
          padding: 0.15em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}
