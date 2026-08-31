import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import Lightbox, { type LightboxPhoto } from './Lightbox';

const LINK_SOURCES = [
  { name: 'github', hosts: ['github.com'] },
  { name: 'x', hosts: ['x.com', 'twitter.com'] },
  { name: 'telegram', hosts: ['t.me', 'telegram.me'] },
  { name: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { name: 'bilibili', hosts: ['bilibili.com', 'b23.tv'] },
  { name: 'notion', hosts: ['notion.so', 'notion.site'] },
] as const;

function getLinkSource(hostname: string) {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  return LINK_SOURCES.find(({ hosts }) => (
    hosts.some((host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`))
  ))?.name;
}

export default function ArticleEnhancements() {
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [lightboxIndex, setLightboxIndex] = createSignal(0);
  const [photos, setPhotos] = createSignal<LightboxPhoto[]>([]);
  const cleanupCallbacks: Array<() => void> = [];
  let root: HTMLDivElement | undefined;

  onMount(() => {
    if (!root) return;
    const content = root.closest('.article-content');
    if (!content) return;

    content.querySelectorAll<HTMLElement>('.article-content-html h1, .article-content-html h2, .article-content-html h3')
      .forEach((heading, index) => {
        if (heading.querySelector(':scope > .heading-link')) return;

        if (!heading.id) heading.id = `heading-${index}`;

        const link = document.createElement('a');
        link.className = 'heading-link';
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.setAttribute('aria-label', `定位到“${heading.textContent?.trim() || '此标题'}”`);

        if (!heading.querySelector('a')) {
          while (heading.firstChild) link.appendChild(heading.firstChild);
        } else {
          link.classList.add('heading-link-marker');
        }

        heading.appendChild(link);
      });

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggleAnimations = new Map<HTMLDetailsElement, Animation>();

    content.querySelectorAll<HTMLDetailsElement>('.article-content-html .notion-toggle')
      .forEach((toggle) => {
        const summary = toggle.querySelector<HTMLElement>(':scope > summary');
        if (!summary) return;

        const handleToggleClick = (event: MouseEvent) => {
          if (reducedMotion.matches) return;

          event.preventDefault();
          toggleAnimations.get(toggle)?.finish();

          const isClosing = toggle.open;
          const startHeight = toggle.getBoundingClientRect().height;

          if (!isClosing) toggle.open = true;

          const computedStyle = window.getComputedStyle(toggle);
          const borderHeight = Number.parseFloat(computedStyle.borderTopWidth)
            + Number.parseFloat(computedStyle.borderBottomWidth);
          const endHeight = isClosing
            ? summary.getBoundingClientRect().height + borderHeight
            : toggle.scrollHeight;

          toggle.style.height = `${startHeight}px`;
          toggle.style.overflow = 'hidden';
          toggle.style.willChange = 'height';

          const animation = toggle.animate(
            { height: [`${startHeight}px`, `${endHeight}px`] },
            {
              duration: isClosing ? 180 : 240,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
          );
          toggleAnimations.set(toggle, animation);

          animation.onfinish = () => {
            if (isClosing) toggle.open = false;
            toggle.style.removeProperty('height');
            toggle.style.removeProperty('overflow');
            toggle.style.removeProperty('will-change');
            if (toggleAnimations.get(toggle) === animation) toggleAnimations.delete(toggle);
          };
        };

        summary.addEventListener('click', handleToggleClick);
        cleanupCallbacks.push(() => summary.removeEventListener('click', handleToggleClick));
      });

    cleanupCallbacks.push(() => {
      toggleAnimations.forEach((animation, toggle) => {
        animation.cancel();
        toggle.style.removeProperty('height');
        toggle.style.removeProperty('overflow');
        toggle.style.removeProperty('will-change');
      });
      toggleAnimations.clear();
    });

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

    content.querySelectorAll<HTMLAnchorElement>('.article-content-html a[href]').forEach((link) => {
      if (
        link.classList.contains('notion-bookmark')
        || link.closest('.notion-bookmark')
        || link.querySelector('img')
      ) return;

      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin === window.location.origin) return;

        const source = getLinkSource(url.hostname);
        if (source) link.dataset.linkSource = source;
      } catch {
        // Leave malformed or non-HTTP links with the standard prose-link treatment.
      }
    });

    content.querySelectorAll('.article-content-html .code-block').forEach((block) => {
      if (block.querySelector('.code-copy-btn')) return;

      const button = document.createElement('button');
      button.className = 'code-copy-btn';
      button.type = 'button';
      button.textContent = '复制';
      button.setAttribute('aria-label', `复制 ${block.getAttribute('data-lang') || '代码'} 代码`);
      button.addEventListener('click', async () => {
        const code = block.querySelector('code');
        if (!code) return;

        try {
          await navigator.clipboard.writeText(code.textContent || '');
          button.textContent = '已复制';
          button.setAttribute('aria-label', '代码已复制');
          button.classList.add('copied');
        } catch {
          button.textContent = '复制失败';
          button.setAttribute('aria-label', '复制失败，请重试');
        }

        setTimeout(() => {
          button.textContent = '复制';
          button.setAttribute('aria-label', `复制 ${block.getAttribute('data-lang') || '代码'} 代码`);
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
    cleanupCallbacks.forEach((cleanup) => cleanup());
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
