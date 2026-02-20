/**
 * Mock data for development and testing
 * Replace with actual API calls in production
 */

import type {
  FeedItem,
  FriendLink,
  CurrentItem,
  ArchiveGroup,
  SiteConfig,
} from './types';

/**
 * Site configuration
 */
export const siteConfig: SiteConfig = {
  title: '玄武',
  description: '数字花园与内容聚合站',
  author: '玄武',
  url: 'https://example.com',
  social: {
    twitter: 'https://twitter.com/username',
    github: 'https://github.com/username',
    telegram: 'https://t.me/username',
    email: 'hello@example.com',
  },
};

/**
 * Mock feed items for the home page
 */
export const mockFeedItems: FeedItem[] = [
  // Articles
  {
    id: 'article-1',
    type: 'article',
    title: '用 Notion 搭建第二大脑',
    content: `<p>在尝试了各种笔记软件多年之后，我终于找到了一个适合自己的系统。以下是我如何使用 Notion 来组织我的数字生活。</p>
<h2>为什么选择 Notion</h2>
<p>Notion 的灵活性是它最大的优势。它不是一个单一的笔记应用，而是一个可以随需求变化的工具。</p>
<h2>核心原则</h2>
<p>核心洞察是把笔记当作积木而非静态档案。每条笔记都应该是可操作的、可关联的、可发现的。</p>
<h3>可操作</h3>
<p>每条笔记都应该能够转化为行动。不要只是收集信息，要思考如何使用它。</p>
<h3>可关联</h3>
<p>笔记之间应该建立连接。Notion 的数据库功能让这变得简单。</p>
<h3>可发现</h3>
<p>好的系统应该让你在需要时找到需要的信息。标签和搜索是关键。</p>
<h2>实践方法</h2>
<p>从简单的开始，逐步构建你的系统。不要一开始就追求完美。</p>
<pre><code class="language-javascript">const notion = new Client({ auth: process.env.NOTION_API_KEY });
const response = await notion.databases.query({
  database_id: process.env.NOTION_DATABASE_ID,
});</code></pre>
<h2>总结</h2>
<p>搭建第二大脑是一个持续的过程。工具只是手段，重要的是建立自己的知识体系。</p>`,
    date: new Date('2025-02-15'),
    source: 'notion',
    url: '/articles/building-second-brain',
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80',
    metadata: {
      readingTime: 8,
      tags: ['效率', 'Notion', '知识管理'],
      excerpt: '我是如何使用 Notion 来组织数字生活、搭建第二大脑的。',
      featured: true,
    },
  },
  {
    id: 'article-2',
    type: 'article',
    title: '慢读的艺术',
    content: `<p>在无限滚动的时代，慢读是一种激进的行为。它关乎质量而非数量，深度而非广度。</p>
<p>这不是关于读得更快或更慢——而是关于有意识地阅读。</p>`,
    date: new Date('2025-02-10'),
    source: 'notion',
    url: '/articles/slow-reading',
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
    metadata: {
      readingTime: 5,
      tags: ['阅读', '哲学', '正念'],
      excerpt: '为什么慢读可能是你做的最有生产力的事情。',
    },
  },
  {
    id: 'article-3',
    type: 'article',
    title: '为可读性而设计',
    content: `<p>好的排版是隐形的。伟大的排版是难忘的。这是我在让内容更易读方面学到的东西。</p>`,
    date: new Date('2025-01-28'),
    source: 'notion',
    url: '/articles/designing-readability',
    metadata: {
      readingTime: 6,
      tags: ['设计', '排版', 'Web'],
      excerpt: 'Web 排版设计的原则。',
    },
  },
  {
    id: 'article-4',
    type: 'article',
    title: '我的 2024 写作工作流',
    content: `<p>从构思到发布，以下是我如何跨平台写作和发布内容。</p>`,
    date: new Date('2024-12-20'),
    source: 'notion',
    url: '/articles/writing-workflow-2024',
    metadata: {
      readingTime: 10,
      tags: ['写作', '工作流', '工具'],
      excerpt: '一窥我的端到端写作流程。',
    },
  },

  // Microblog posts
  {
    id: 'micro-1',
    type: 'microblog',
    content: '终于搭好了我的数字花园。再也不用把笔记散落在十个不同的 App 里了。目标：写一次，发到处，不维护。',
    date: new Date('2025-02-18'),
    source: 'telegram',
    metadata: {
      platform: 'telegram',
      likes: 12,
      replies: 3,
    },
  },
  {
    id: 'micro-2',
    type: 'microblog',
    content: '第三次读《程序员修炼之道》。有了更多上下文之后感觉完全不同。有些书是会和你一起成长的。',
    date: new Date('2025-02-16'),
    source: 'telegram',
    metadata: {
      platform: 'telegram',
      likes: 8,
    },
  },
  {
    id: 'micro-3',
    type: 'microblog',
    content: '暴论：最好的笔记 App 就是你真正会用的那个。别再优化了，开始写吧。',
    date: new Date('2025-02-12'),
    source: 'telegram',
    metadata: {
      platform: 'telegram',
      likes: 24,
      replies: 7,
    },
  },

  // Media logs
  {
    id: 'media-1',
    type: 'media',
    title: '设计心理学',
    content: '任何为人类设计东西的人都应该读的经典之作。',
    date: new Date('2025-02-14'),
    source: 'douban',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
    metadata: {
      mediaType: 'book',
      rating: 5,
      maxRating: 5,
      review: '必读。改变了我对用户界面的思考方式。',
      status: 'completed',
      creator: '唐纳德·诺曼',
      year: 1988,
    },
  },
  {
    id: 'media-2',
    type: 'media',
    title: '奥本海默',
    content: '三个小时的道德复杂性。',
    date: new Date('2025-02-08'),
    source: 'douban',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
    metadata: {
      mediaType: 'movie',
      rating: 9,
      maxRating: 10,
      review: '诺兰最雄心勃勃的作品。光是音效设计就值回票价。',
      status: 'completed',
      creator: '克里斯托弗·诺兰',
      year: 2023,
    },
  },

  // Photos
  {
    id: 'photo-1',
    type: 'photo',
    title: '金色黄昏',
    content: '捕捉到一天中最后的光线。',
    date: new Date('2025-02-17'),
    source: 'notion',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    metadata: {
      album: '日常散步',
      location: '旧金山',
      exif: {
        camera: 'Fujifilm X-T5',
        lens: 'XF 23mm f/2',
        iso: 400,
        shutterSpeed: '1/500',
        aperture: 'f/8',
        focalLength: 23,
        dateTaken: new Date('2025-02-17T17:45:00'),
      },
    },
  },
  {
    id: 'photo-2',
    type: 'photo',
    title: '街头',
    content: '',
    date: new Date('2025-02-15'),
    source: 'notion',
    image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
    metadata: {
      album: '街头摄影',
      location: '东京',
      exif: {
        camera: 'Leica Q3',
        lens: 'Summilux 28mm f/1.7',
        iso: 200,
        shutterSpeed: '1/1000',
        aperture: 'f/4',
        focalLength: 28,
        dateTaken: new Date('2025-02-15T14:20:00'),
      },
    },
  },

  // More articles for archive
  {
    id: 'article-5',
    type: 'article',
    title: '为什么我切换到了 SolidJS',
    content: '<p>用了 React 多年之后，这是我切换的原因。</p>',
    date: new Date('2024-11-15'),
    source: 'notion',
    url: '/articles/switching-to-solidjs',
    metadata: {
      readingTime: 7,
      tags: ['JavaScript', 'SolidJS', '前端'],
    },
  },
  {
    id: 'article-6',
    type: 'article',
    title: 'Web 设计中的极简主义',
    content: '<p>少即是多，但只有当它是有意为之的时候。</p>',
    date: new Date('2024-10-20'),
    source: 'notion',
    url: '/articles/minimalism-web-design',
    metadata: {
      readingTime: 4,
      tags: ['设计', '极简主义'],
    },
  },
  {
    id: 'article-7',
    type: 'article',
    title: '使用无聊技术的理由',
    content: '<p>为有趣的问题选择无聊的技术。</p>',
    date: new Date('2024-09-05'),
    source: 'notion',
    url: '/articles/boring-technology',
    metadata: {
      readingTime: 6,
      tags: ['工程', '架构'],
    },
  },
];

/**
 * Friend links for sidebar
 */
export const mockFriendLinks: FriendLink[] = [
  {
    name: '小明',
    url: 'https://xiaoming.example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Xiaoming',
    description: '设计师 & 写作者',
  },
  {
    name: '阿杰',
    url: 'https://ajie.example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ajie',
    description: '软件工程师',
  },
  {
    name: '小红',
    url: 'https://xiaohong.example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Xiaohong',
    description: '摄影师',
  },
  {
    name: '大伟',
    url: 'https://dawei.example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dawei',
    description: '产品经理',
  },
];

/**
 * Currently consuming items
 */
export const mockCurrentItems: CurrentItem[] = [
  {
    type: 'reading',
    mediaType: 'book',
    title: '思考，快与慢',
    author: '丹尼尔·卡尼曼',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&q=80',
    progress: 45,
    date: new Date('2025-02-15'),
  },
  {
    type: 'watching',
    mediaType: 'tv',
    title: '幕府将军',
    cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80',
    progress: 60,
    date: new Date('2025-02-12'),
  },
  {
    type: 'listening',
    mediaType: 'music',
    title: '机核 GADIO 游戏电台',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=80',
    date: new Date('2025-02-10'),
  },
];

/**
 * Archive items grouped by year
 */
export function getArchiveGroups(items: FeedItem[]): ArchiveGroup[] {
  const groups = new Map<number, FeedItem[]>();

  // Filter to only articles and sort by date
  const articles = items
    .filter((item) => item.type === 'article' && item.title)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  // Group by year
  for (const item of articles) {
    const year = item.date.getFullYear();
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year)!.push(item);
  }

  // Convert to array and sort by year descending
  return Array.from(groups.entries())
    .map(([year, yearItems]) => ({
      year,
      items: yearItems.map((item) => ({
        id: item.id,
        title: item.title!,
        date: item.date,
        type: item.type,
        url: item.url || `/articles/${item.id}`,
      })),
      count: yearItems.length,
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * Get archive groups from mock data
 */
export const mockArchiveGroups = getArchiveGroups(mockFeedItems);

/**
 * Helper to get featured items
 */
export function getFeaturedItems(items: FeedItem[]): FeedItem[] {
  return items.filter(
    (item) =>
      item.type === 'article' &&
      (item.metadata as any)?.featured
  );
}

/**
 * Helper to get items by type
 */
export function getItemsByType(items: FeedItem[], type: FeedItem['type']): FeedItem[] {
  return items.filter((item) => item.type === type);
}

/**
 * Helper to get recent items
 */
export function getRecentItems(items: FeedItem[], count: number = 10): FeedItem[] {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, count);
}
