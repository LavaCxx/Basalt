import { onMount, onCleanup, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { VoxelDriveEngine } from "../../lib/voxel/engine";

const isDev = import.meta.env.DEV;

export default function VoxelDrive(props: { text?: string }) {
  let canvasRef: HTMLCanvasElement | undefined;
  let engine: VoxelDriveEngine | null = null;

  const [fps, setFps] = createSignal(0);
  const [spd, setSpd] = createSignal(0);
  const [panelOpen, setPanelOpen] = createSignal(true);
  const [meshMode, setMeshMode] = createSignal(false);
  const [shape, setShape] = createSignal(3); // 0=square, 1=round, 2=soft, 3=led

  const shapes: { label: string; val: number }[] = [
    { label: "Square", val: 0 },
    { label: "Round", val: 1 },
    { label: "Soft", val: 2 },
    { label: "LED", val: 3 },
  ];

  const sliders = [
    { id: "vox", label: "体素大小", min: 0.07, max: 0.32, step: 0.01, val: 0.14, fmt: 3, apply: (e: VoxelDriveEngine, v: number) => e.setVox(v) },
    { id: "radius", label: "渲染半径", min: 4, max: 13, step: 0.1, val: 8.5, fmt: 1, apply: (e: VoxelDriveEngine, v: number) => e.setRadius(v) },
    { id: "soft", label: "柔边宽度", min: 0.5, max: 5, step: 0.1, val: 2.0, fmt: 1, apply: (e: VoxelDriveEngine, v: number) => e.setSoft(v) },
    { id: "bright", label: "亮度", min: 0.3, max: 4, step: 0.05, val: 1.5, fmt: 2, apply: (e: VoxelDriveEngine, v: number) => e.setBoost(v) },
    { id: "glow", label: "辉光", min: 0, max: 4, step: 0.1, val: 1.2, fmt: 1, apply: (e: VoxelDriveEngine, v: number) => e.setGlow(v) },
    { id: "point", label: "点大小", min: 0.3, max: 2.5, step: 0.05, val: 2.0, fmt: 2, apply: (e: VoxelDriveEngine, v: number) => e.setPointSize(v) },
    { id: "jitter", label: "抖动", min: 0, max: 0.08, step: 0.002, val: 0.03, fmt: 3, apply: (e: VoxelDriveEngine, v: number) => e.setJitter(v) },
    { id: "flicker", label: "闪烁", min: 0, max: 1, step: 0.05, val: 0.3, fmt: 2, apply: (e: VoxelDriveEngine, v: number) => e.setFlicker(v) },
    { id: "speed", label: "车速", min: 0, max: 12, step: 0.2, val: 3.0, fmt: 1, apply: (e: VoxelDriveEngine, v: number) => e.setSpeed(v) },
    { id: "headlight", label: "车灯", min: 0, max: 2, step: 0.05, val: 0, fmt: 2, apply: (e: VoxelDriveEngine, v: number) => e.setHeadlight(v) },
  ];
  const [vals, setVals] = createStore<Record<string, number>>(
    Object.fromEntries(sliders.map((s) => [s.id, s.val]))
  );

  onMount(() => {
    if (!canvasRef) return;
    engine = new VoxelDriveEngine(canvasRef, { onFps: setFps, onSpeed: setSpd }, { text: props.text });
    engine.init();
    engine.start();

    const onScroll = () => {
      const max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const frac = Math.min(1, Math.max(0, window.scrollY / max));
      engine?.setSpeed(3.0 + frac * 6);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
  });

  onCleanup(() => {
    engine?.dispose();
  });

  const toggleRender = () => {
    if (!engine) return;
    const next = !engine.isMeshMode();
    engine.setMeshMode(next);
    setMeshMode(next);
  };

  return (
    <>
      <canvas ref={canvasRef} class="voxel-canvas" />
      <div class="voxel-vignette" />

      <Show when={isDev}>
        <div class="voxel-hud">
          <div class="voxel-hud-row">
            <span class="voxel-hud-val">{fps()}</span>
            <span class="voxel-hud-unit">FPS</span>
          </div>
          <div class="voxel-hud-label">SPEED</div>
          <div>
            <span class="voxel-hud-val voxel-hud-spd">{spd()}</span>
            <span class="voxel-hud-unit">km/h</span>
          </div>
        </div>

        <button class="voxel-toggle-btn" onClick={toggleRender}>
          {meshMode() ? "VOXEL · OFF" : "VOXEL · ON"}
        </button>

        <button class="voxel-panel-toggle" onClick={() => setPanelOpen(!panelOpen())}>
          {panelOpen() ? "收起" : "体素参数"}
        </button>

        <div class="voxel-panel" classList={{ collapsed: !panelOpen() }}>
          <div class="voxel-panel-title">体素调参</div>
          <For each={sliders}>{(s) => (
            <label class="voxel-panel-row">
              <span class="voxel-panel-label">{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={vals[s.id]}
                onInput={(e) => {
                  const v = parseFloat(e.currentTarget.value);
                  setVals(s.id, v);
                  engine && s.apply(engine, v);
                }}
              />
              <span class="voxel-panel-val">{vals[s.id].toFixed(s.fmt)}</span>
            </label>
          )}</For>
          <div class="voxel-panel-shape-group">
            <span class="voxel-panel-label">体素形状</span>
            <div class="voxel-panel-btns">
              <For each={shapes}>{(s) => (
                <button
                  class="voxel-panel-mini-btn"
                  classList={{ active: shape() === s.val }}
                  onClick={() => { setShape(s.val); engine?.setShape(s.val); }}
                >{s.label}</button>
              )}</For>
            </div>
          </div>
          <div class="voxel-panel-hint">
            向下滚动可加速。体素大小/半径/柔边在 mesh 模式下也影响场景可见范围。点大小/抖动/闪烁/形状仅在体素模式生效。
          </div>
        </div>
      </Show>

      <a href="/" class="voxel-back">← 返回</a>
    </>
  );
}
