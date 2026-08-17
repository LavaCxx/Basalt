import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import Lightbox, { type LightboxPhoto } from './Lightbox';

export default function ArticleEnhancements() {
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [lightboxIndex, setLightboxIndex] = createSignal(0);
  const [photos, setPhotos] = createSignal<LightboxPhoto[]>([]);
  let root: HTMLDivElement | undefined;

  onMount(() => {
    if (!root) return;
    const content = root.closest('.article-content');
    if (!content) return;

    const contentImages = Array.from(content.querySelectorAll<HTMLElement>('.article-content-html img'))
      .filter((img) => (
        !img.classList.contains('notion-bookmark-icon')
        && !img.classList.contains('callout-icon')
        && !img.closest('.notion-bookmark-cover')
      ));

    const enhancedPhotos: LightboxPhoto[] = contentImages.map((img) => ({
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
      title: img.closest('figure')?.querySelector('figcaption')?.textContent || undefined,
    }));
    setPhotos(enhancedPhotos);

    contentImages.forEach((img, index) => {
      img.addEventListener('click', () => {
        setLightboxIndex(index);
        setLightboxOpen(true);
        document.body.style.overflow = 'hidden';
      });
      img.style.cursor = 'pointer';
    });

    content.querySelectorAll('.article-content-html .code-block').forEach((block) => {
      const button = document.createElement('button');
      button.className = 'code-copy-btn';
      button.textContent = '复制';
      button.addEventListener('click', async () => {
        const code = block.querySelector('code');
        if (!code) return;

        try {
          await navigator.clipboard.writeText(code.textContent || '');
          button.textContent = '已复制';
          button.classList.add('copied');
        } catch {
          button.textContent = '复制失败';
        }

        setTimeout(() => {
          button.textContent = '复制';
          button.classList.remove('copied');
        }, 1600);
      });
      block.appendChild(button);
    });
  });

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = '';
  };
  const goToPrevious = () => setLightboxIndex((prev) => (prev > 0 ? prev - 1 : photos().length - 1));
  const goToNext = () => setLightboxIndex((prev) => (prev < photos().length - 1 ? prev + 1 : 0));

  onCleanup(() => {
    document.body.style.overflow = '';
  });

  return (
    <div ref={root} class="article-content-wrapper">
      <Show when={lightboxOpen()}>
        <Lightbox
          open={lightboxOpen()}
          photos={photos()}
          index={lightboxIndex()}
          onClose={closeLightbox}
          onPrevious={goToPrevious}
          onNext={goToNext}
        />
      </Show>
    </div>
  );
}
