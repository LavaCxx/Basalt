import { createSignal, For, Show } from "solid-js";

// ============================================================
// 风来之国 (Eastward) 风格 · CRT 像素菜单试验
// 纯展示：无外部字体 / 无外部图片，所有图标与爱心均为内联 SVG/CSS 像素画
// ============================================================

type ScreenId = "settings" | "inventory" | "recipe" | "saves";

type IconGrid = string[];

// ------------------------------------------------------------
// 像素网格图标（'.'=透明  '#'=主色  '*'=强调色）
// ------------------------------------------------------------
const I = {
  tv: [
    "..####..",
    ".#....#.",
    ".#.##.#.",
    ".#.##.#.",
    ".#....#.",
    "..####..",
    "...##...",
    "...##...",
  ],
  bag: [
    "..####..",
    ".#....#.",
    "########",
    "########",
    "########",
    "########",
    ".#....#.",
    "..#..#..",
  ],
  pot: [
    ".#....#.",
    ".#....#.",
    "########",
    "########",
    "########",
    "########",
    "..####..",
    "........",
  ],
  save: [
    "########",
    "#......#",
    "#.####.#",
    "#.#..#.#",
    "#.#..#.#",
    "#.#..#.#",
    "#.####.#",
    "########",
  ],
  clock: [
    "..####..",
    ".#....#.",
    ".#..##.#",
    ".#...#.#",
    ".#....#.",
    ".#....#.",
    "..####..",
    "........",
  ],
  coin: [
    "..####..",
    ".#....#.",
    ".#.##.#.",
    ".#.##.#.",
    ".#....#.",
    "..#..#..",
  ],
  leaf: [
    "...#..#.",
    "..#.....",
    ".##.....",
    "########",
    ".######.",
    ".#####..",
    "..####..",
    "........",
  ],
  heart: [
    ".##..##.",
    "########",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
  ],
} as const;

// 物品像素图标集
const IT = {
  ammo: [
    "..####..",
    ".#.##.#.",
    "#.###.#.",
    "#.###.#.",  // 弹匣/背包
    "#.#####.",
    "#.#####.",
    ".#####..",
    "..####..",
  ],
  can: [
    ".######.",
    ".#....#.",
    ".#....#.",
    ".######.",
    ".######.",
    ".######.",
    ".#....#.",
    ".######.",
  ],
  bottle: [
    "...##...",
    ".######.",
    ".#....#.",
    ".#....#.",
    ".#....#.",
    ".#....#.",
    ".#....#.",
    ".######.",
  ],
  plate: [
    "........",
    ".######.",
    ".##..##.",
    ".#.##.#.",
    ".#.##.#.",
    ".##..##.",
    ".######.",
    "........",
  ],
  salad: [
    "..####..",
    ".##..##.",
    ".##..##.",
    ".######.",
    ".######.",
    ".#....#.",
    ".######.",
    "........",
  ],
  apple: [
    "...##...",
    "..####..",
    ".######.",
    ".######.",
    ".######.",
    ".######.",
    "..####..",
    "...##...",
  ],
  ramen: [
    ".######.",
    ".##..##.",
    ".##..##.",
    ".######.",
    ".######.",
    "..####..",
    ".#....#.",
    ".######.",
  ],
  stew: [
    ".#....#.",
    ".#....#.",
    "########",
    "########",
    "########",
    "########",
    "..####..",
    "........",
  ],
  banana: [
    "....#...",
    "...##...",
    "..##....",
    ".##.....",
    ".##.....",
    ".##.....",
    "..##....",
    "...#....",
  ],
  soup: [
    "..####..",
    ".#....#.",
    ".#....#.",
    "########",
    ".######.",
    "..####..",
    "........",
    "........",
  ],
} as const;

// ------------------------------------------------------------
// 像素图标渲染：把字符网格画成 SVG rect
// ------------------------------------------------------------
function PixelIcon(props: {
  grid: IconGrid;
  main?: string;
  accent?: string;
  size?: number;
  glow?: boolean;
}) {
  const rows = props.grid.length;
  const cols = props.grid[0].length;
  const cell = (props.size ?? 28) / cols;
  const main = props.main ?? "#e8e6e0";
  const accent = props.accent ?? "#c9a15a";
  return (
    <svg
      width={cols * cell}
      height={rows * cell}
      viewBox={`0 0 ${cols} ${rows}`}
      shape-rendering="crispEdges"
      aria-hidden="true"
      style={props.glow ? `filter: drop-shadow(0 0 6px ${main});` : undefined}
    >
      {props.grid.flatMap((row, y) =>
        row.split("").map((c, x) => {
          if (c === ".") return null;
          return <rect x={x} y={y} width={1} height={1} fill={c === "*" ? accent : main} />;
        }),
      )}
    </svg>
  );
}

// 一排像素爱心
function PixelHearts(props: { count?: number; size?: number; color?: string; dim?: boolean }) {
  const count = props.count ?? 15;
  const size = props.size ?? 22;
  const color = props.color ?? "#e8543f";
  return (
    <div class="ewc-hearts" aria-hidden="true" style={`color:${color}`}>
      <For each={Array.from({ length: count })}>
        {() => (
          <span class="ewc-heart">
            <PixelIcon grid={I.heart} size={count >= 14 ? Math.max(9, size * 0.4) : size} main="currentColor" />
          </span>
        )}
      </For>
    </div>
  );
}

// ------------------------------------------------------------
// 版面数据
// ------------------------------------------------------------
const settingsItems = ["重置当前关卡", "关闭菜单", "设定", "操作说明", "成就", "返回标题画面", "退出游戏"];

type InvItem = { name: string; desc: string; grid: IconGrid; tint: string; badge?: string };
const inventoryItems: InvItem[] = [
  { name: "大包子弹", desc: "轻松塞满弹药仓，能对应一切武器。", grid: IT.ammo, tint: "#9a938a", badge: "100%" },
  { name: "能量饮料", desc: "补充体力，短暂提升移动速度。", grid: IT.can, tint: "#4aa37e" },
  { name: "汽水", desc: "清爽的碳酸饮料，恢复少量生命。", grid: IT.bottle, tint: "#d9b25a" },
  { name: "香煎肉排", desc: "热腾腾的肉排，填饱肚子。", grid: IT.plate, tint: "#c86a4a" },
  { name: "蔬菜沙拉", desc: "新鲜的蔬菜，清爽健康。", grid: IT.salad, tint: "#7fae4e" },
  { name: "苹果", desc: "清甜多汁的水果。", grid: IT.apple, tint: "#d8543f" },
  { name: "拉面", desc: "热汤拉面，抚慰心灵。", grid: IT.ramen, tint: "#e0a64e" },
  { name: "炖菜", desc: "一锅暖胃的炖菜。", grid: IT.stew, tint: "#b47b4a" },
  { name: "香蕉", desc: "补充能量的水果。", grid: IT.banana, tint: "#e6c95a" },
  { name: "蘑菇汤", desc: "香气浓郁的浓汤。", grid: IT.soup, tint: "#a3865a" },
  { name: "能量块", desc: "便携的高热量食品。", grid: IT.can, tint: "#5aa4d9" },
  { name: "姜饼", desc: "甜甜的烘焙点心。", grid: IT.apple, tint: "#c98a4a" },
];

type Recipe = { name: string; desc: string; ingredients: string[]; grid: IconGrid; tint: string };
const recipes: Recipe[] = [
  { name: "炒蔬菜", desc: "新鲜的蔬菜直接下锅，看大厨的手艺了。", ingredients: ["蔬菜"], grid: IT.salad, tint: "#7fae4e" },
  { name: "香煎肉排", desc: "大火煎至金黄，肉汁四溢。", ingredients: ["肉", "油"], grid: IT.plate, tint: "#c86a4a" },
  { name: "拉面", desc: "慢熬高汤，配上劲道面条。", ingredients: ["面粉", "高汤"], grid: IT.ramen, tint: "#e0a64e" },
  { name: "苹果派", desc: "香甜的苹果馅饼。", ingredients: ["苹果", "面粉"], grid: IT.apple, tint: "#d8543f" },
  { name: "炖菜", desc: "一锅暖胃的时令炖菜。", ingredients: ["蔬菜", "肉"], grid: IT.stew, tint: "#b47b4a" },
  { name: "能量饮料", desc: "补充体力的配方。", ingredients: ["果实"], grid: IT.can, tint: "#4aa37e" },
  { name: "蘑菇汤", desc: "香气浓郁的浓汤。", ingredients: ["蘑菇"], grid: IT.soup, tint: "#a3865a" },
  { name: "汽水", desc: "清爽提神的气泡水。", ingredients: ["水", "糖"], grid: IT.bottle, tint: "#d9b25a" },
];

type Save = { label?: string; auto?: boolean; time: string; chapter: string; hues: string[]; last?: boolean };
const saves: Save[] = [
  { label: "自动存档", auto: true, time: "20:53:34", chapter: "第八章「卡戎」", hues: ["#2c2433", "#42314a", "#5a3d55"] },
  { time: "20:42:02", chapter: "第八章「卡戎」", hues: ["#1f2a33", "#283c44", "#2f4a3a"] },
  { label: "自动存档", auto: true, time: "20:54:45", chapter: "第八章「卡戎」", hues: ["#33282a", "#4a3228", "#5c3a2c"] },
  { label: "自动存档", auto: true, time: "21:07:27", chapter: "第八章「卡戎」", hues: ["#26262e", "#36343f", "#47404f"], last: true },
];

const TAB_ICON: Record<ScreenId, IconGrid> = {
  settings: I.tv,
  inventory: I.bag,
  recipe: I.pot,
  saves: I.save,
};
const TAB_LABEL: Record<ScreenId, string> = {
  settings: "系统设定",
  inventory: "物品道具",
  recipe: "料理配方",
  saves: "读取记录",
};
const SCREENS: ScreenId[] = ["settings", "inventory", "recipe", "saves"];

// 网格列数（用于键盘导航换行）
const COLS = { inventory: 6, recipe: 5, saves: 4 } as const;

// ------------------------------------------------------------
// 主组件
// ------------------------------------------------------------
export default function EastwardMenuLab() {
  const [screen, setScreen] = createSignal<ScreenId>("settings");

  const [dots, setDots] = createSignal(0.35);
  const [aberration, setAberration] = createSignal(0.7);
  const [vignette, setVignette] = createSignal(0.75);
  const [grain, setGrain] = createSignal(false);

  const [settingsIndex, setSettingsIndex] = createSignal(2);
  const [itemIndex, setItemIndex] = createSignal(0);
  const [recipeIndex, setRecipeIndex] = createSignal(0);
  const [saveIndex, setSaveIndex] = createSignal(3);

  const screenStyle = () =>
    `--ewc-dots:${dots()};` +
    `--ewc-aber:${aberration()};` +
    `--ewc-vig:${vignette()};` +
    `--ewc-grain:${grain() ? 1 : 0};`;

  // 键盘导航：方向键移动 / Enter 确认
  const onKeyDown = (e: KeyboardEvent) => {
    const sc = screen();
    const { settingsIndex: si, itemIndex: ii, recipeIndex: ri, saveIndex: svi } = { settingsIndex: settingsIndex(), itemIndex: itemIndex(), recipeIndex: recipeIndex(), saveIndex: saveIndex() };
    let handled = true;
    if (sc === "settings") {
      if (e.key === "ArrowUp") setSettingsIndex((v) => Math.max(0, v - 1));
      else if (e.key === "ArrowDown") setSettingsIndex((v) => Math.min(settingsItems.length - 1, v + 1));
      else handled = false;
    } else {
      const cols = COLS[sc as keyof typeof COLS];
      const len = sc === "inventory" ? inventoryItems.length : sc === "recipe" ? recipes.length : saves.length;
      const cur = sc === "inventory" ? ii : sc === "recipe" ? ri : svi;
      const set = sc === "inventory" ? setItemIndex : sc === "recipe" ? setRecipeIndex : setSaveIndex;
      if (e.key === "ArrowLeft") set((v) => (v - 1 + len) % len);
      else if (e.key === "ArrowRight") set((v) => (v + 1) % len);
      else if (e.key === "ArrowUp") set((v) => (v - cols + len) % len);
      else if (e.key === "ArrowDown") set((v) => (v + cols) % len);
      else handled = false;
    }
    if (handled) e.preventDefault();
  };

  const inv = () => inventoryItems[itemIndex()];
  const rec = () => recipes[recipeIndex()];
  const sv = () => saves[saveIndex()];

  return (
    <div class="ewc-lab">
      {/* CRT 屏幕 */}
      <div class="ewc-screen" tabindex={0} role="application" aria-label="风来之国 CRT 菜单演示" style={screenStyle()} onKeyDown={onKeyDown}>
        {/* 叠加层：像素纹理 / 暗角 / 反光 / 颗粒（不拦截交互） */}
        <div class="ewc-layers" aria-hidden="true">
          <div class="ewc-pixels" />
          <div class="ewc-glare" />
          <div class="ewc-vignette" />
          <div class="ewc-grain" />
        </div>

        {/* 菜单内容 */}
        <div class="ewc-menu">
          <div class="ewc-topbar">
            <div class="ewc-tabs" role="tablist" aria-label="菜单页签">
              <For each={SCREENS}>
                {(id) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={screen() === id}
                    class="ewc-tab"
                    classList={{ active: screen() === id }}
                    onClick={() => setScreen(id)}
                    title={TAB_LABEL[id]}
                  >
                    <PixelIcon grid={TAB_ICON[id]} size={30} main={screen() === id ? "#f2f0ea" : "#8f8b82"} accent="#c9a15a" glow={screen() === id} />
                  </button>
                )}
              </For>
            </div>
            <div class="ewc-topright">
              <span class="ewc-title">{TAB_LABEL[screen()]}</span>
              <span class="ewc-money">
                <PixelIcon grid={I.coin} size={24} main="#e6c95a" />
                <span class="ewc-money-num">1139</span>
              </span>
            </div>
          </div>

          <div class="ewc-stage">
            <Show when={screen() === "settings"}>
              <nav class="ewc-settings" aria-label="系统设定">
                <For each={settingsItems}>
                  {(label, i) => (
                    <button
                      type="button"
                      class="ewc-setup-item"
                      classList={{ active: settingsIndex() === i() }}
                      onMouseEnter={() => setSettingsIndex(i())}
                      onClick={() => setSettingsIndex(i())}
                    >
                      <span class="ewc-setup-label">{label}</span>
                      {settingsIndex() === i() && <span class="ewc-caret" aria-hidden="true">▶</span>}
                    </button>
                  )}
                </For>
              </nav>
            </Show>

            <Show when={screen() === "inventory"}>
              <div class="ewc-inv">
                <div class="ewc-inv-head">
                  <span class="ewc-pill">背包 <b>›</b></span>
                  <span class="ewc-key"><kbd>R</kbd> 快速切换</span>
                  <span class="ewc-key"><kbd>E</kbd> 整理背包</span>
                </div>
                <div class="ewc-inv-body">
                  <div class="ewc-item-grid" role="listbox" aria-label="物品">
                    <For each={inventoryItems}>
                      {(it, i) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={itemIndex() === i()}
                          class="ewc-item"
                          classList={{ active: itemIndex() === i() }}
                          onMouseEnter={() => setItemIndex(i())}
                          onClick={() => setItemIndex(i())}
                          style={`--ewc-item:${it.tint}`}
                        >
                          <PixelIcon grid={it.grid} size={40} main="currentColor" accent={it.tint} glow={itemIndex() === i()} />
                          <Show when={itemIndex() === i() && it.badge}>
                            <span class="ewc-item-badge">{it.badge}</span>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="ewc-inv-stats">
                    <span><PixelIcon grid={I.heart} size={16} main="#e8543f" /> 0/4</span>
                    <span><PixelIcon grid={IT.can} size={16} main="#8f8b82" /> ×0</span>
                    <span><PixelIcon grid={IT.bottle} size={16} main="#8f8b82" /> ×2</span>
                  </div>
                </div>
                <div class="ewc-desc">
                  <h4 class="ewc-desc-name">{inv().name}</h4>
                  <p class="ewc-desc-text">{inv().desc}</p>
                </div>
              </div>
            </Show>

            <Show when={screen() === "recipe"}>
              <div class="ewc-recipe">
                <div class="ewc-recipe-list" role="listbox" aria-label="料理配方">
                  <For each={recipes}>
                    {(r, i) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={recipeIndex() === i()}
                        class="ewc-dish"
                        classList={{ active: recipeIndex() === i() }}
                        onMouseEnter={() => setRecipeIndex(i())}
                        onClick={() => setRecipeIndex(i())}
                        style={`--ewc-item:${r.tint}`}
                      >
                        {/* 选中括号 [ ] */}
                        <span class="ewc-bracket ewc-bracket-l" aria-hidden="true" />
                        <PixelIcon grid={r.grid} size={34} main="currentColor" accent={r.tint} />
                        <span class="ewc-bracket ewc-bracket-r" aria-hidden="true" />
                      </button>
                    )}
                  </For>
                </div>
                <div class="ewc-recipe-detail">
                  <div class="ewc-recipe-figure" style={`--ewc-item:${rec().tint}`}>
                    <PixelIcon grid={rec().grid} size={96} main="currentColor" accent={rec().tint} glow />
                  </div>
                  <div class="ewc-recipe-info">
                    <h4 class="ewc-recipe-name">{rec().name}</h4>
                    <p class="ewc-recipe-desc">{rec().desc}</p>
                    <div class="ewc-ingredients">
                      <span class="ewc-ingredients-title">所需食材</span>
                      <ul>
                        <For each={rec().ingredients}>
                          {(ing) => (
                            <li>
                              <PixelIcon grid={I.leaf} size={24} main="#7fae4e" />
                              <span>{ing}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </div>
                </div>
                <span class="ewc-key ewc-recipe-hint"><kbd>空格</kbd> 菜谱</span>
              </div>
            </Show>

            <Show when={screen() === "saves"}>
              <div class="ewc-saves" role="listbox" aria-label="读取记录">
                <For each={saves}>
                  {(s, i) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={saveIndex() === i()}
                      class="ewc-save"
                      classList={{ active: saveIndex() === i() }}
                      onMouseEnter={() => setSaveIndex(i())}
                      onClick={() => setSaveIndex(i())}
                      style={`--ewc-h1:${s.hues[0]};--ewc-h2:${s.hues[1]};--ewc-h3:${s.hues[2]};`}
                    >
                      <Show when={s.auto}>
                        <span class="ewc-autosave">{s.label}</span>
                      </Show>
                      <div class="ewc-thumb" aria-hidden="true" />
                      <div class="ewc-save-meta">
                        <span class="ewc-save-time">
                          <PixelIcon grid={I.clock} size={20} main="#c9c4b8" />
                          <b>{s.time}</b>
                        </span>
                        <PixelHearts count={15} size={22} color="#e8543f" />
                        <span class="ewc-save-chapter">{s.chapter}</span>
                      </div>
                      <Show when={s.last && saveIndex() === i()}>
                        <span class="ewc-last-tip">上一次存档</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="ewc-footer">
            <div class="ewc-heartsbar">
              <span class="ewc-heartsbar-badge" aria-hidden="true"><PixelIcon grid={I.bag} size={22} main="#e8543f" /></span>
              <PixelHearts count={13} size={34} color="#e8543f" />
            </div>
            <div class="ewc-hints">
              <span><kbd>ESC</kbd> 返回</span>
              <span><kbd>方向键</kbd> 浏览</span>
            </div>
          </div>
        </div>
      </div>

      {/* CRT 控制面板 */}
      <div class="ewc-controls">
        <h4 class="ewc-controls-title">CRT 效果</h4>
        <SliderRow label="像素纹理" value={dots()} min={0} max={1} step={0.01} display={() => `${Math.round(dots() * 100)}%`} onChange={setDots} />
        <SliderRow label="色散" value={aberration()} min={0} max={1} step={0.01} display={() => `${Math.round(aberration() * 100)}%`} onChange={setAberration} />
        <SliderRow label="暗角" value={vignette()} min={0} max={1} step={0.01} display={() => `${Math.round(vignette() * 100)}%`} onChange={setVignette} />
        <div class="ewc-controls-row">
          <button type="button" classList={{ on: grain() }} onClick={() => setGrain(!grain())}>屏幕颗粒</button>
        </div>
        <p class="ewc-note">点按屏幕或用方向键浏览；页面底部有可调节的 CRT 参数。</p>
      </div>
    </div>
  );
}

function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: () => string;
  onChange: (v: number) => void;
}) {
  return (
    <label class="ewc-slider">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(+e.currentTarget.value)}
      />
      <span class="ewc-val">{props.display()}</span>
    </label>
  );
}
