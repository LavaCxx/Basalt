import { onMount, createSignal, Show, For } from "solid-js";

interface WebmentionAuthor {
  type?: string;
  name?: string;
  url?: string;
  photo?: string;
}

interface WebmentionEntry {
  type?: string;
  author?: WebmentionAuthor;
  content?: { text?: string; html?: string };
  url?: string;
  published?: string;
  "wm-property"?: string;
  "wm-deleted"?: boolean;
}

interface Jf2Feed {
  type?: string;
  children?: WebmentionEntry[];
}

interface ParsedMention {
  authorName: string;
  authorUrl?: string;
  authorPhoto?: string;
  content: string;
  url?: string;
  published: Date | null;
  property: string;
}

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || el.innerText || "").trim();
  }
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseEntries(feed: Jf2Feed): ParsedMention[] {
  const children = feed.children || [];
  return children
    .filter((e) => !e["wm-deleted"])
    .map((e) => {
      const content =
        e.content?.text?.trim() ||
        (e.content?.html ? stripHtml(e.content.html) : "") ||
        "";
      const published = e.published ? new Date(e.published) : null;
      return {
        authorName: e.author?.name || "匿名",
        authorUrl: e.author?.url,
        authorPhoto: e.author?.photo,
        content,
        url: e.url,
        published: published && !isNaN(published.getTime()) ? published : null,
        property: e["wm-property"] || "mention",
      };
    })
    .filter((m) => m.content || m.url)
    .sort((a, b) => {
      if (!a.published) return 1;
      if (!b.published) return -1;
      return b.published.getTime() - a.published.getTime();
    });
}

interface WebmentionsProps {
  target: string;
}

export default function Webmentions(props: WebmentionsProps) {
  const [mentions, setMentions] = createSignal<ParsedMention[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);

  onMount(async () => {
    const username = import.meta.env.PUBLIC_WEBMENTION_USERNAME;
    if (!username || !props.target) {
      setLoading(false);
      return;
    }

    try {
      const endpoint = `https://webmention.io/api/mentions.jf2?target=${encodeURIComponent(
        props.target
      )}&per-page=50`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Jf2Feed = await res.json();
      setMentions(parseEntries(data));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  });

  return (
    <section class="webmentions-section">
      <h2 class="webmentions-heading">
        <span>🔗 Webmentions</span>
        <Show when={!loading() && !error()}>
          <span class="webmentions-count">（{mentions().length}）</span>
        </Show>
      </h2>

      <Show when={loading()}>
        <p class="webmentions-status">加载中…</p>
      </Show>

      <Show when={error()}>
        <p class="webmentions-status">Webmention 加载失败，稍后再试。</p>
      </Show>

      <Show when={!loading() && !error() && mentions().length === 0}>
        <p class="webmentions-status">暂无 Webmentions</p>
      </Show>

      <Show when={!loading() && !error() && mentions().length > 0}>
        <ul class="webmentions-list">
          <For each={mentions()}>
            {(m) => (
              <li class="webmention-item">
                <Show
                  when={m.authorPhoto}
                  fallback={
                    <span class="webmention-avatar webmention-avatar-placeholder">
                      {m.authorName.charAt(0)}
                    </span>
                  }
                >
                  <img
                    class="webmention-avatar"
                    src={m.authorPhoto!}
                    alt={m.authorName}
                    loading="lazy"
                  />
                </Show>
                <div class="webmention-body">
                  <div class="webmention-meta">
                    <Show
                      when={m.authorUrl}
                      fallback={<span class="webmention-author">{m.authorName}</span>}
                    >
                      <a
                        class="webmention-author"
                        href={m.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {m.authorName}
                      </a>
                    </Show>
                    <Show when={m.published}>
                      <time class="webmention-time">{relativeTime(m.published)}</time>
                    </Show>
                  </div>
                  <Show when={m.content}>
                    <p class="webmention-content">{m.content}</p>
                  </Show>
                  <Show when={m.url}>
                    <a
                      class="webmention-source"
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看原文 →
                    </a>
                  </Show>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <style>{`
        .webmentions-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid var(--color-border-subtle, #e5e5e5);
        }

        .webmentions-heading {
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .webmentions-count {
          font-size: 0.875rem;
          font-weight: 400;
          color: var(--color-text-muted);
        }

        .webmentions-status {
          font-family: var(--font-sans);
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .webmentions-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .webmention-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--color-border-subtle, #e5e5e5);
          border-radius: 0.375rem;
          background: var(--color-background-alt, transparent);
        }

        .webmention-avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
        }

        .webmention-avatar-placeholder {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-muted);
          background: var(--color-border, #e5e5e5);
        }

        .webmention-body {
          flex: 1;
          min-width: 0;
        }

        .webmention-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .webmention-author {
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary);
          text-decoration: none;
        }

        .webmention-author:hover {
          text-decoration: underline;
        }

        .webmention-time {
          font-family: var(--font-sans);
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .webmention-content {
          font-family: var(--font-sans);
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--color-text-secondary);
          margin: 0.25rem 0;
          word-break: break-word;
        }

        .webmention-source {
          font-family: var(--font-sans);
          font-size: 0.75rem;
          color: var(--color-text-muted);
          text-decoration: none;
        }

        .webmention-source:hover {
          color: var(--color-text-primary);
          text-decoration: underline;
        }
      `}</style>
    </section>
  );
}
