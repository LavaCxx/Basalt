import { createSignal, onMount, onCleanup } from "solid-js";
// dither 逻辑已内联到渲染循环中以减少遍历次数
import { useStore } from "@nanostores/solid";
import { opacityStore, thresholdStore, speedStore, resolutionStore } from "./onebit-settings";

// ===== 持久化设置 =====
// persistentAtom 默认以字符串存储，需要显式指定 number 编解码器
export default function OneBitBackground() {
  let canvasRef: HTMLCanvasElement | undefined;
  let timerId: ReturnType<typeof setTimeout> | 0 = 0;
  let lastFrame = 0;
  const FRAME_INTERVAL = 125; // 8fps，保留低负载的动态节奏

  const opacity = useStore(opacityStore);
  const threshold = useStore(thresholdStore);
  const speed = useStore(speedStore);
  const resolution = useStore(resolutionStore);

  const [, setFps] = createSignal(0);

  onMount(() => {
    const canvas = canvasRef!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    let w = 0;
    let h = 0;

    let fpsFrames = 0;
    let fpsLastUpdate = performance.now();

    const resize = () => {
      // 双重限制：不超过用户设置、屏幕宽度、以及 1200 硬上限
        w = Math.min(resolution(), window.screen.width, 1200);
      h = Math.round((w * window.innerHeight) / window.innerWidth);
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    const startTime = performance.now();
    let paused = false;

    // ===== 优化：sin/cos 查找表 =====
    // 预计算 1024 级 sin 表，运行时用整数索引直接查表，避免每像素 5 次 Math.sin 调用
    const SIN_SIZE = 1024;
    const SIN_MASK = SIN_SIZE - 1;
    const sinTable = new Float32Array(SIN_SIZE);
    const cosTable = new Float32Array(SIN_SIZE);
    for (let i = 0; i < SIN_SIZE; i++) {
      const a = (i / SIN_SIZE) * Math.PI * 2;
      sinTable[i] = Math.sin(a);
      cosTable[i] = Math.cos(a);
    }
    const fastSin = (x: number) => sinTable[((x / (Math.PI * 2)) * SIN_SIZE) & SIN_MASK & 0x7fffffff];
    const fastCos = (x: number) => cosTable[((x / (Math.PI * 2)) * SIN_SIZE) & SIN_MASK & 0x7fffffff];

    // ===== 优化：ImageData 复用 =====
    let imageData: ImageData | null = null;

    // ===== 优化：Bayer 4x4 内联常量（避免每帧函数调用开销）=====
    const B4 = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    const B4_MAX = 16;

    const render = () => {
      timerId = setTimeout(render, FRAME_INTERVAL);
      if (paused) return;
      const now = performance.now();

      // 如果分辨率设置变了，重新设置 canvas 尺寸
      const targetW = Math.min(resolution(), window.screen.width, 1200);
      if (targetW !== w) {
        w = targetW;
        h = Math.round((w * window.innerHeight) / window.innerWidth);
        canvas.width = w;
        canvas.height = h;
        imageData = null; // 尺寸变了，重新分配
      }

      // 复用 ImageData（不每帧重新分配）
      if (!imageData || imageData.width !== w || imageData.height !== h) {
        imageData = ctx.createImageData(w, h);
      }
      const data = imageData.data;

      const sp = speed();
      const th = threshold();
      const t = (now - startTime) * 0.001 * sp;

      // ===== 优化：合并为单次遍历（灰度 + Bayer 抖动同时完成）=====
      const invW = 1 / w;
      const invH = 1 / h;

      for (let y = 0; y < h; y++) {
        const ny = y * invH;
        // 按行预计算
        const sinNy6 = fastSin(ny * 6 + t * 0.8);
        const cosNy = fastCos(ny * 6 + t * 0.7);
        const by4 = y % 4;

        for (let x = 0; x < w; x++) {
          const nx = x * invW;
          const warpX = nx + 0.3 * fastSin(ny * 6 + t * 0.8);
          const warpY = ny + 0.3 * fastCos(nx * 6 + t * 0.6);
          let v = fastSin(warpX * 5 + t) * fastCos(warpY * 5 - t * 0.7);
          v += 0.5 * fastSin((warpX + warpY) * 8 + t * 1.2);
          v = (v / 1.5 + 1) / 2;

          // Bayer 4x4 抖动内联
          const bayer = (B4[by4 * 4 + (x % 4)] / B4_MAX) * 255 - 128;
          const result = v * 255 + bayer > th ? 255 : 0;

          const i = (y * w + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = result;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // FPS 计算（每秒更新一次）
      fpsFrames++;
      if (now - fpsLastUpdate >= 1000) {
        setFps(Math.round((fpsFrames * 1000) / (now - fpsLastUpdate)));
        fpsFrames = 0;
        fpsLastUpdate = now;
      }
    };

    timerId = setTimeout(render, FRAME_INTERVAL);

    const handleVisibility = () => { paused = document.hidden; };
    document.addEventListener("visibilitychange", handleVisibility);

    onCleanup(() => {
      clearTimeout(timerId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    });
  });

  return (
    <>
      <canvas ref={canvasRef} class="onebit-bg-canvas" style={{ opacity: opacity() }} aria-hidden="true" />
    </>
  );
}
