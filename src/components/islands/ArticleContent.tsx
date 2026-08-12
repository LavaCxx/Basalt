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
          transition: transform 0.2s;
        }
        .article-content-html img:hover {
          transform: scale(1.01);
        }

        /* Code blocks — let Shiki's github-dark background show through */
        .article-content-html pre,
        .article-content-html .shiki {
          border-radius: 0.5rem;
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        /* Inline code (outside pre) keeps light background */
        .article-content-html :not(pre) > code {
          font-family: var(--font-mono);
          background: var(--color-background-alt, #f5f5f7);
          color: var(--color-text-primary);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
      `}</style>
    </div>
  );
}
