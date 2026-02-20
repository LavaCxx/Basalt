import { createSignal, onMount, For, Show } from 'solid-js';

interface ArchiveItem {
  id: string;
  title: string;
  date: Date;
  type: string;
  url: string;
}

interface ArchiveGroup {
  year: number;
  items: ArchiveItem[];
  count: number;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

export default function ArchiveList() {
  const [groups, setGroups] = createSignal<ArchiveGroup[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await fetch('/api/archives');
      const data = await res.json();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch archives:', error);
    } finally {
      setLoading(false);
    }
  });

  const totalCount = () => groups().reduce((sum, g) => sum + g.count, 0);

  return (
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header class="mb-12">
        <h1 class="font-ui text-4xl font-bold text-text-primary mb-2">
          归档
        </h1>
        <p class="text-text-secondary">
          共 {totalCount()} 篇文章，按时间排序
        </p>
      </header>

      {/* Loading */}
      <Show when={loading()}>
        <div class="py-12 text-center text-text-muted">
          加载中...
        </div>
      </Show>

      {/* Archive List */}
      <div class="space-y-12">
        <For each={groups()}>
          {(group) => (
            <section>
              <div class="flex items-baseline gap-4 mb-4 pb-2 border-b border-border">
                <h2 class="font-ui text-2xl font-semibold text-text-primary">
                  {group.year}
                </h2>
                <span class="text-sm text-text-muted">
                  {group.count} 篇
                </span>
              </div>

              <ul class="space-y-0">
                <For each={group.items}>
                  {(item) => (
                    <li class="group">
                      <a
                        href={item.url}
                        class="flex items-start gap-4 py-3 border-b border-border-subtle hover:bg-background-alt transition-colors -mx-2 px-2 rounded"
                      >
                        <time class="text-sm text-text-muted w-16 flex-shrink-0 pt-0.5">
                          {formatDate(item.date)}
                        </time>
                        <h3 class="text-text-primary group-hover:text-accent transition-colors flex-1">
                          {item.title}
                        </h3>
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>

      {/* Empty State */}
      <Show when={!loading() && groups().length === 0}>
        <div class="text-center py-12">
          <p class="text-text-muted">暂无文章</p>
        </div>
      </Show>
    </div>
  );
}
