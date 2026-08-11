import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import {
  type DitherMethod,
  type BayerSize,
  applyDither,
  bayerDither,
  floydSteinbergDitherStable,
} from '../../lib/dither';

// ============================================================
// 1-Bit Lab - 实验室主组件
// ============================================================

export default function OneBitLab() {
  const [tab, setTab] = createSignal<"background" | "image">("background");
  return (
    <div class="onebit-lab">
      <div class="lab-tabs">
        <button class="lab-tab" classList={{ active: tab() === "background" }} onClick={() => setTab("background")}>
          动态背景
        </button>
        <button class="lab-tab" classList={{ active: tab() === "image" }} onClick={() => setTab("image")}>
          图像抖动
        </button>
      </div>
      <Show when={tab() === "background"} fallback={<ImageDitherPanel />}>
        <BackgroundPanel />
      </Show>
    </div>
  );
}

// ============================================================
// Tab 1: 动态背景
// ============================================================

type BgPattern = "plasma" | "domain" | "flow" | "ripple" | "strata";

function BackgroundPanel() {
  let canvasRef: HTMLCanvasElement | undefined;
  let rafId = 0;
  let startTime = 0;
  let fsPrev: Float32Array | undefined; // F-S 时域平滑缓冲
  const runningRef = { current: true };

  const [pattern, setPattern] = createSignal<BgPattern>("domain");
  const [threshold, setThreshold] = createSignal(128);
  const [speed, setSpeed] = createSignal(1);
  const [running, setRunning] = createSignal(true);
  const [ditherMode, setDitherMode] = createSignal<"bayer" | "fs">("bayer");
  const [bayerSize, setBayerSize] = createSignal<BayerSize>(4);

  const mouse = { x: 0.5, y: 0.5 };

  const patterns: { id: BgPattern; label: string }[] = [
    { id: "domain", label: "Domain Warp" },
    { id: "plasma", label: "Plasma" },
    { id: "flow", label: "Flow Field" },
    { id: "strata", label: "Strata" },
    { id: "ripple", label: "Ripple" },
  ];

  const bayerSizes: { id: BayerSize; label: string }[] = [
    { id: 4, label: "4x4" },
    { id: 8, label: "8x8" },
    { id: 16, label: "16x16" },
  ];

  onMount(() => {
    const canvas = canvasRef!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      // 提高分辨率：更细腻的网点
      const targetW = Math.min(480, Math.floor(rect.width));
      const targetH = Math.round(targetW * (rect.height / rect.width));
      canvas.width = targetW;
      canvas.height = targetH;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = (e.clientY - rect.top) / rect.height;
    };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("touchmove", (e: TouchEvent) => {
      if (e.touches[0]) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = (e.touches[0].clientX - rect.left) / rect.width;
        mouse.y = (e.touches[0].clientY - rect.top) / rect.height;
      }
    });

    startTime = performance.now();

    // 用闭包内的最新信号值（避免每帧重新绑定 render）
    const getVals = () => ({
      p: pattern(), th: threshold(), sp: speed(),
      dm: ditherMode(), bs: bayerSize(), fs: fsStability(),
    });

    const render = () => {
      const { p, th, sp, dm, bs, fs } = getVals();
      const w = canvas.width;
      const h = canvas.height;
      const t = (performance.now() - startTime) * 0.001 * sp;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      const mx = mouse.x;
      const my = mouse.y;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let v = 0;
          const nx = x / w;
          const ny = y / h;

          switch (p) {
            // --- Domain Warping: 用 sin 扭曲坐标采样，产生有机流动 ---
            case "domain": {
              const warpX = nx + 0.3 * Math.sin(ny * 6 + t * 0.8);
              const warpY = ny + 0.3 * Math.cos(nx * 6 + t * 0.6);
              v = Math.sin(warpX * 5 + t) * Math.cos(warpY * 5 - t * 0.7);
              v += 0.5 * Math.sin((warpX + warpY) * 8 + t * 1.2);
              v = (v / 1.5 + 1) / 2;
              break;
            }
            // --- Plasma (保留) ---
            case "plasma": {
              v = Math.sin(nx * 8 + t)
                + Math.sin(ny * 8 + t * 1.3)
                + Math.sin((nx + ny) * 6 + t * 0.7)
                + Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 20 - t * 2);
              v = ((v / 4) + 1) / 2;
              break;
            }
            // --- Flow Field: 多层旋转场叠加 ---
            case "flow": {
              const angle1 = Math.sin(nx * 4 + t * 0.5) * Math.PI;
              const angle2 = Math.cos(ny * 4 + t * 0.3) * Math.PI;
              const dx = Math.cos(angle1 + angle2);
              const dy = Math.sin(angle1 - angle2);
              v = (dx * nx + dy * ny + 1) / 2;
              v += 0.3 * Math.sin(Math.sqrt(nx * nx + ny * ny) * 12 - t);
              v = Math.max(0, Math.min(1, v));
              break;
            }
            // --- Strata: 等高线/地形等高感 ---
            case "strata": {
              const base = Math.sin(nx * 3 + t * 0.4) * Math.cos(ny * 4 + t * 0.3);
              const detail = 0.3 * Math.sin(nx * 15 + ny * 12 + t * 0.8);
              v = base + detail;
              v = (v + 1.3) / 2.6;
              // 量化为等高线
              v = Math.floor(v * 8) / 8 + 0.02 * Math.sin(t * 2);
              break;
            }
            // --- Ripple: 鼠标涟漪（保留） ---
            case "ripple": {
              const dx = nx - mx;
              const dy = ny - my;
              const dist = Math.sqrt(dx * dx + dy * dy);
              v = (Math.sin(dist * 40 - t * 4) + 1) / 2;
              v *= 0.6 + 0.4 * Math.sin(t + nx * 5);
              break;
            }
          }

          const gray = Math.round(v * 255);
          const i = (y * w + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = gray;
          data[i + 3] = 255;
        }
      }

      if (dm === "fs") {
        const [dithered, newPrev] = floydSteinbergDitherStable(imageData, th, fsPrev, fs);
        fsPrev = newPrev;
        ctx.putImageData(dithered, 0, 0);
      } else {
        const dithered = bayerDither(imageData, th, bs);
        ctx.putImageData(dithered, 0, 0);
      }

      if (runningRef.current) {
        rafId = requestAnimationFrame(render);
      }
    };

    // 暴露 render 给 toggleRunning
    startRef.start = () => {
      if (!runningRef.current) return;
      rafId = requestAnimationFrame(render);
    };
    startRef.stop = () => {
      cancelAnimationFrame(rafId);
    };

    rafId = requestAnimationFrame(render);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    });
  });

  // 用一个 ref 对象来保存 start/stop 函数（解决 pause 后无法恢复的 bug）
  const startRef: { start?: () => void; stop?: () => void } = {};

  const toggleRunning = () => {
    const next = !running();
    setRunning(next);
    runningRef.current = next;
    if (next) {
      startTime = performance.now() - (performance.now() - startTime);
      startRef.start?.();
    } else {
      startRef.stop?.();
    }
  };

  // 切换图案时重置 F-S 时域缓冲（避免上一图案的残留导致闪烁）
  createEffect(() => {
    pattern();
    fsPrev = undefined;
  });

  return (
    <div class="bg-panel">
      <div class="bg-canvas-wrap">
        <canvas ref={canvasRef} class="bg-canvas" />
      </div>
      <div class="lab-controls">
        <div class="control-group">
          <label class="control-label">图案</label>
          <div class="btn-group">
            {patterns.map((p) => (
              <button class="mini-btn" classList={{ active: pattern() === p.id }} onClick={() => setPattern(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">抖动算法</label>
          <div class="btn-group">
            <button class="mini-btn" classList={{ active: ditherMode() === "bayer" }} onClick={() => setDitherMode("bayer")}>
              Bayer
            </button>
            <button class="mini-btn" classList={{ active: ditherMode() === "fs" }} onClick={() => setDitherMode("fs")}>
              Floyd-Steinberg
            </button>
          </div>
        </div>
        <Show when={ditherMode() === "bayer"}>
          <div class="control-group">
            <label class="control-label">Bayer 尺寸</label>
            <div class="btn-group">
              {bayerSizes.map((b) => (
                <button class="mini-btn" classList={{ active: bayerSize() === b.id }} onClick={() => setBayerSize(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </Show>
        <Show when={ditherMode() === "bayer"}>
          <div class="control-group">
            <label class="control-label">
              阈值 <span class="val">{threshold()}</span>
            </label>
            <input type="range" min="0" max="255" value={threshold()} onInput={(e) => setThreshold(+e.currentTarget.value)} />
          </div>
        </Show>
        <Show when={ditherMode() === "fs"}>
          <div class="control-group">
            <label class="control-label">
              稳定度 <span class="val">{Math.round(fsStability() * 100)}%</span>
            </label>
            <input type="range" min="0.3" max="0.95" step="0.05" value={fsStability()} onInput={(e) => setFsStability(+e.currentTarget.value)} />
          </div>
        </Show>
        <div class="control-group">
          <label class="control-label">
            速度 <span class="val">{speed().toFixed(1)}x</span>
          </label>
          <input type="range" min="0" max="3" step="0.1" value={speed()} onInput={(e) => setSpeed(+e.currentTarget.value)} />
        </div>
        <div class="control-group">
          <button class="mini-btn" onClick={toggleRunning}>
            {running() ? "⏸ 暂停" : "▶ 播放"}
          </button>
        </div>
      </div>
      <p class="lab-hint">移动鼠标可与图案交互（涟漪效果跟随光标）</p>
    </div>
  );
}

// ============================================================
// Tab 2: 图像抖动
// ============================================================

function ImageDitherPanel() {
  let fileInput: HTMLInputElement | undefined;
  let originalCanvas: HTMLCanvasElement | undefined;
  let resultCanvas: HTMLCanvasElement | undefined;

  const [method, setMethod] = createSignal<DitherMethod>("bayer");
  const [threshold, setThreshold] = createSignal(128);
  const [bayerSize, setBayerSize] = createSignal<BayerSize>(8);
  const [hasImage, setHasImage] = createSignal(false);
  const [processing, setProcessing] = createSignal(false);
  const [invert, setInvert] = createSignal(false);

  const methods: { id: DitherMethod; label: string; desc: string }[] = [
    { id: "bayer", label: "Bayer", desc: "Rule-based, retro game style" },
    { id: "floyd-steinberg", label: "F-S", desc: "Error diffusion, newspaper" },
    { id: "threshold", label: "Threshold", desc: "Hard cut, woodcut" },
    { id: "random", label: "Random", desc: "Coarse grain" },
  ];

  const bayerSizes: { id: BayerSize; label: string }[] = [
    { id: 4, label: "4x4" },
    { id: 8, label: "8x8" },
    { id: 16, label: "16x16" },
  ];

  const loadImage = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = 500;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      originalCanvas!.width = w;
      originalCanvas!.height = h;
      const octx = originalCanvas!.getContext("2d")!;
      octx.drawImage(img, 0, 0, w, h);
      setHasImage(true);
    };
    img.onerror = () => alert("Image load failed (maybe CORS). Try uploading a local file.");
    img.src = src;
  };

  const processImage = async () => {
    if (!originalCanvas || !resultCanvas || !hasImage()) return;
    setProcessing(true);
    await new Promise((r) => requestAnimationFrame(r));
    const w = originalCanvas.width;
    const h = originalCanvas.height;
    resultCanvas.width = w;
    resultCanvas.height = h;
    const octx = originalCanvas.getContext("2d")!;
    const rctx = resultCanvas.getContext("2d")!;
    const imageData = octx.getImageData(0, 0, w, h);
    if (invert()) {
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255 - imageData.data[i];
        imageData.data[i + 1] = 255 - imageData.data[i + 1];
        imageData.data[i + 2] = 255 - imageData.data[i + 2];
      }
    }
    const dithered = applyDither(imageData, method(), threshold(), bayerSize());
    rctx.putImageData(dithered, 0, 0);
    if (invert()) {
      const finalData = rctx.getImageData(0, 0, w, h);
      for (let i = 0; i < finalData.data.length; i += 4) {
        finalData.data[i] = 255 - finalData.data[i];
        finalData.data[i + 1] = 255 - finalData.data[i + 1];
        finalData.data[i + 2] = 255 - finalData.data[i + 2];
      }
      rctx.putImageData(finalData, 0, 0);
    }
    setProcessing(false);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const loadSample = (seed: string) => {
    loadImage("https://picsum.photos/seed/" + seed + "/500/350");
  };

  let ready = false;
  onMount(() => { ready = true; });

  createEffect(() => {
    method();
    threshold();
    invert();
    bayerSize();
    if (ready && hasImage()) {
      processImage();
    }
  });

  return (
    <div class="img-panel">
      <Show when={!hasImage()}>
        <div class="upload-area">
          <div class="upload-placeholder">
            <p class="upload-title">上传一张图片来体验 1-bit 抖动</p>
            <p class="upload-sub">JPG / PNG / WebP supported</p>
            <div class="upload-btns">
              <button class="lab-primary-btn" onClick={() => fileInput?.click()}>
                选择文件
              </button>
              <button class="lab-sample-btn" onClick={() => loadSample("64")}>
                示例 A
              </button>
              <button class="lab-sample-btn" onClick={() => loadSample("237")}>
                示例 B
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              class="hidden"
              onChange={(e) => {
                if (e.currentTarget.files?.[0]) handleFile(e.currentTarget.files[0]);
              }}
            />
          </div>
        </div>
      </Show>

      <Show when={hasImage()}>
        <div class="img-compare">
          <div class="img-slot">
            <div class="img-label">原图</div>
            <canvas ref={originalCanvas} class="dither-canvas" />
          </div>
          <div class="img-slot">
            <div class="img-label">1-bit Dithered</div>
            <canvas ref={resultCanvas} class="dither-canvas" />
            <Show when={processing()}>
              <div class="processing-overlay">处理中…</div>
            </Show>
          </div>
        </div>

        <div class="lab-controls">
          <div class="control-group">
            <label class="control-label">算法</label>
            <div class="btn-group">
              {methods.map((m) => (
                <button class="mini-btn" classList={{ active: method() === m.id }} onClick={() => setMethod(m.id)} title={m.desc}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <Show when={method() === "bayer"}>
            <div class="control-group">
              <label class="control-label">Bayer 尺寸</label>
              <div class="btn-group">
                {bayerSizes.map((b) => (
                  <button class="mini-btn" classList={{ active: bayerSize() === b.id }} onClick={() => setBayerSize(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </Show>
          <div class="control-group">
            <label class="control-label">
              阈值 <span class="val">{threshold()}</span>
            </label>
            <input type="range" min="0" max="255" value={threshold()} onInput={(e) => setThreshold(+e.currentTarget.value)} />
          </div>
          <div class="control-group">
            <button class="mini-btn" classList={{ active: invert() }} onClick={() => setInvert(!invert())}>
              {invert() ? "反转：开" : "反转：关"}
            </button>
            <button class="mini-btn" onClick={() => fileInput?.click()}>
              换一张
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
  const [fsStability, setFsStability] = createSignal(0.65);
