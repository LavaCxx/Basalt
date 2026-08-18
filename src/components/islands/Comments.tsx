import { onMount, createSignal, Show, createEffect } from 'solid-js';

interface CommentsProps {
  /** Discussion mapping term - used to identify the page */
  mapping?: 'pathname' | 'url' | 'title' | 'og:title' | 'specific';
  /** Specific term when mapping is 'specific' */
  term?: string;
}

declare global {
  interface Window {
    giscus: {
      configure: (config: Record<string, unknown>) => void;
    };
  }
}

export default function Comments(props: CommentsProps) {
  let containerRef: HTMLDivElement | undefined;
  const [loaded, setLoaded] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);

  const mapping = () => props.mapping || 'pathname';

  // Custom theme URL - use configured URL or fallback to built-in themes
  const getThemeUrl = (dark: boolean) => {
    const customThemeUrl = import.meta.env.PUBLIC_GISCUS_THEME_URL;
    if (customThemeUrl) {
      return customThemeUrl;
    }
    // Fallback to built-in themes
    return dark ? 'dark' : 'light';
  };

  onMount(() => {
    // Initial theme detection
    setIsDark(false);

    // Giscus configuration
    const giscusConfig: Record<string, string | undefined> = {
      src: 'https://giscus.app/client.js',
      'data-repo': import.meta.env.PUBLIC_GISCUS_REPO,
      'data-repo-id': import.meta.env.PUBLIC_GISCUS_REPO_ID,
      'data-category': import.meta.env.PUBLIC_GISCUS_CATEGORY,
      'data-category-id': import.meta.env.PUBLIC_GISCUS_CATEGORY_ID,
      'data-mapping': mapping(),
      'data-term': props.term,
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': getThemeUrl(isDark()),
      'data-lang': 'zh-CN',
      'data-loading': 'lazy',
      crossorigin: 'anonymous',
    };

    // Only load if repo is configured
    if (!giscusConfig['data-repo']) {
      console.warn('Giscus repo not configured. Set PUBLIC_GISCUS_REPO environment variable.');
      return;
    }

    const script = document.createElement('script');
    Object.entries(giscusConfig).forEach(([key, value]) => {
      if (value) {
        script.setAttribute(key, value);
      }
    });

    script.addEventListener('load', () => setLoaded(true));

    if (containerRef) {
      containerRef.appendChild(script);
    }

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const newIsDark = false;
      setIsDark(newIsDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  });

  // Update giscus theme when dark mode changes
  createEffect(() => {
    const dark = isDark();
    if (loaded() && window.giscus) {
      window.giscus.configure({
        theme: getThemeUrl(dark),
      });
    }
  });

  return (
    <section class="comments-section">
      <Show when={!import.meta.env.PUBLIC_GISCUS_REPO}>
        <div class="p-4 border border-border-subtle rounded-md text-text-muted text-sm">
          评论功能未配置。请在环境变量中设置 PUBLIC_GISCUS_REPO 等变量以启用 Giscus 评论。
        </div>
      </Show>

      <div
        ref={containerRef}
        class="giscus-container"
        classList={{
          'opacity-0': !loaded(),
          'opacity-100 transition-opacity duration-300': loaded(),
        }}
      />

      <style>{`
        .comments-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid var(--color-border-subtle, #e5e5e5);
        }

        .giscus-container {
          min-height: 200px;
        }

        .giscus {
          max-width: 100%;
        }

        .giscus-frame {
          width: 100%;
        }
      `}</style>
    </section>
  );
}
