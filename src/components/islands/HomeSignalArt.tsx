import { onCleanup, onMount } from 'solid-js';

const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

export default function HomeSignalArt() {
  let canvasRef: HTMLCanvasElement | undefined;

  onMount(() => {
    const canvas = canvasRef!;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let imageData: ImageData | undefined;
    let avatarLuminance: Float32Array | undefined;
    let xNorm: Float32Array | undefined;
    let yNorm: Float32Array | undefined;
    let thresholdMap: Float32Array | undefined;
    let portraitMixMap: Float32Array | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let isVisible = true;
    let themeIsRiso = document.documentElement.classList.contains('riso');
    let springPosition = 0;
    let springVelocity = 0;
    let springTarget = 0;
    let noiseEnergy = 0;
    let noiseTarget = 0;
    let lastScrollY = window.scrollY;
    let lastTouchY: number | undefined;
    let lastTickAt = performance.now();
    let averageRenderMs = 0;
    const startedAt = performance.now();
    const avatar = new Image();

    const sampleAvatar = () => {
      if (!avatar.complete || avatar.naturalWidth === 0 || width === 0 || height === 0) return;

      const sampleCanvas = document.createElement('canvas');
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sampleContext) return;

      sampleCanvas.width = width;
      sampleCanvas.height = height;

      const sourceRatio = width / height;
      const sourceWidth = avatar.naturalWidth;
      const sourceHeight = sourceWidth / sourceRatio;
      const sourceY = Math.max(0, Math.min(avatar.naturalHeight - sourceHeight, avatar.naturalHeight * 0.12));

      sampleContext.drawImage(
        avatar,
        0,
        sourceY,
        sourceWidth,
        Math.min(sourceHeight, avatar.naturalHeight),
        0,
        0,
        width,
        height,
      );
      const sourceData = sampleContext.getImageData(0, 0, width, height).data;
      avatarLuminance = new Float32Array(width * height);
      for (let pixel = 0; pixel < avatarLuminance.length; pixel++) {
        const sourceIndex = pixel * 4;
        avatarLuminance[pixel] = (
          sourceData[sourceIndex] * 0.2126
          + sourceData[sourceIndex + 1] * 0.7152
          + sourceData[sourceIndex + 2] * 0.0722
        ) / 255;
      }
    };

    const prepareStaticMaps = () => {
      xNorm = new Float32Array(width);
      yNorm = new Float32Array(height);
      thresholdMap = new Float32Array(width * height);
      portraitMixMap = new Float32Array(width * height);

      for (let x = 0; x < width; x++) xNorm[x] = x / width;
      for (let y = 0; y < height; y++) yNorm[y] = y / height;

      for (let y = 0; y < height; y++) {
        const ny = yNorm[y];
        for (let x = 0; x < width; x++) {
          const nx = xNorm[x];
          const pixel = y * width + x;
          const horizontalReveal = Math.max(0, Math.min(1, (nx - 0.04) / 0.28));
          const edgeFade = Math.min(1, nx / 0.12, (1 - nx) / 0.1, ny / 0.12, (1 - ny) / 0.12);
          thresholdMap[pixel] = (BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          portraitMixMap[pixel] = horizontalReveal * Math.max(0, edgeFade) * 0.86;
        }
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(96, Math.round(bounds.width / 2.4));
      height = Math.max(64, Math.round(bounds.height / 2.4));
      canvas.width = width;
      canvas.height = height;
      imageData = context.createImageData(width, height);
      prepareStaticMaps();
      sampleAvatar();
      render(reducedMotion ? 0 : (performance.now() - startedAt) / 1000);
    };

    const render = (time: number) => {
      if (!imageData || !xNorm || !yNorm || !thresholdMap || !portraitMixMap || width === 0 || height === 0) return;

      const data = imageData.data;
      const red = themeIsRiso ? 23 : 28;
      const green = themeIsRiso ? 113 : 28;
      const blue = themeIsRiso ? 77 : 28;
      const frameSeed = Math.floor(time * 12);
      const thresholdDrift = Math.sin(time * 0.72) * 0.018;
      const springAmount = Math.min(1, Math.abs(springPosition));

      for (let y = 0; y < height; y++) {
        const ny = yNorm[y];
        const rowShift = Math.sin(y * 0.71 + time * 2.58) * springPosition * 2.1;
        for (let x = 0; x < width; x++) {
          const nx = xNorm[x];
          const pixel = y * width + x;
          const warpX = nx + Math.sin(ny * 7.2 - time * 0.17) * 0.16 + rowShift / width;
          const warpY = ny + Math.cos(nx * 6.4 + time * 0.13) * 0.14;
          const broad = Math.sin(warpX * 5.1 + time * 0.22) * Math.cos(warpY * 4.4 - time * 0.16);
          const cross = Math.sin((warpX + warpY) * 8.3 - time * 0.11) * 0.42;
          const pocket = Math.cos((warpX * 1.7 - warpY) * 10.2 + time * 0.09) * 0.2;
          const noise = (broad + cross + pocket + 1.62) / 3.24;
          const avatarX = Math.max(0, Math.min(width - 1, x + rowShift));
          const avatarLeft = Math.floor(avatarX);
          const avatarRight = Math.min(width - 1, avatarLeft + 1);
          const avatarBlend = avatarX - avatarLeft;
          const luminance = avatarLuminance
            ? avatarLuminance[y * width + avatarLeft] * (1 - avatarBlend)
              + avatarLuminance[y * width + avatarRight] * avatarBlend
            : noise;
          const portrait = Math.max(0, Math.min(1, (1 - luminance - 0.08) * 1.55));
          const portraitMix = portraitMixMap[pixel];
          const shimmer = Math.sin(nx * 9.4 + ny * 5.7 + time * 0.13) * 0.035;
          const value = noise * (1 - portraitMix) + (portrait + shimmer) * portraitMix;
          const threshold = thresholdMap[pixel] + thresholdDrift;
          let ink = value > threshold;

          let hash = (x * 374761393 + y * 668265263 + frameSeed * 1442695041) | 0;
          hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
          const random = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
          const midtone = Math.max(0, 1 - Math.abs(portrait - 0.5) * 2);
          const noiseChance = (0.004 + noiseEnergy * 0.085 + springAmount * 0.018) * midtone * portraitMix;
          if (random < noiseChance) ink = !ink;

          const index = pixel * 4;

          data[index] = red;
          data[index + 1] = green;
          data[index + 2] = blue;
          data[index + 3] = ink ? (themeIsRiso ? 132 : 102) : 0;
        }
      }

      context.putImageData(imageData, 0, 0);
    };

    const stopAnimation = () => {
      if (timerId) window.clearTimeout(timerId);
      timerId = undefined;
    };

    const tick = () => {
      timerId = undefined;
      if (!isVisible || document.hidden) return;

      const now = performance.now();
      const frameSeconds = Math.min(0.1, Math.max(0.001, (now - lastTickAt) / 1000));
      lastTickAt = now;
      const springForce = (springTarget - springPosition) * 52;
      springVelocity += springForce * frameSeconds;
      springVelocity *= Math.exp(-7.4 * frameSeconds);
      springPosition += springVelocity * frameSeconds;
      springTarget *= Math.exp(-5.2 * frameSeconds);

      const noiseEase = noiseTarget > noiseEnergy ? 0.4 : 0.2;
      noiseEnergy += (noiseTarget - noiseEnergy) * noiseEase;
      noiseTarget *= 0.58;

      if (Math.abs(springPosition) < 0.001 && Math.abs(springVelocity) < 0.001 && Math.abs(springTarget) < 0.001) {
        springPosition = 0;
        springVelocity = 0;
        springTarget = 0;
      }
      if (noiseEnergy < 0.001 && noiseTarget < 0.001) {
        noiseEnergy = 0;
        noiseTarget = 0;
      }

      const renderStartedAt = performance.now();
      render((renderStartedAt - startedAt) / 1000);
      const renderMs = performance.now() - renderStartedAt;
      averageRenderMs = averageRenderMs === 0 ? renderMs : averageRenderMs * 0.85 + renderMs * 0.15;

      const frameInterval = averageRenderMs > 12 ? 1000 / 12 : 1000 / 18;
      timerId = window.setTimeout(tick, Math.max(0, frameInterval - renderMs));
    };

    const startAnimation = () => {
      if (reducedMotion || timerId || !isVisible || document.hidden) return;
      lastTickAt = performance.now() - 1000 / 18;
      timerId = window.setTimeout(tick, 0);
    };

    const syncAnimationState = () => {
      if (isVisible && !document.hidden) startAnimation();
      else stopAnimation();
    };

    const injectScrollEnergy = (delta: number, sensitivity = 72) => {
      if (delta !== 0) {
        const direction = Math.sign(delta);
        const strength = Math.min(1, Math.abs(delta) / sensitivity);
        springTarget = Math.max(-1, Math.min(1, springTarget + direction * strength));
        noiseTarget = Math.min(1, noiseTarget + strength);
      }
    };

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      injectScrollEnergy(nextScrollY - lastScrollY);
      lastScrollY = nextScrollY;
    };

    const isOutwardBoundaryInput = (delta: number) => {
      const root = document.documentElement;
      const atTop = window.scrollY <= 0;
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 1;
      return (atTop && delta < 0) || (atBottom && delta > 0);
    };

    const handleWheel = (event: WheelEvent) => {
      if (isOutwardBoundaryInput(event.deltaY)) {
        injectScrollEnergy(event.deltaY, 110);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchY = event.touches[0]?.clientY;
      if (touchY === undefined || lastTouchY === undefined) return;
      const delta = lastTouchY - touchY;
      if (isOutwardBoundaryInput(delta)) {
        injectScrollEnergy(delta, 54);
      }
      lastTouchY = touchY;
    };

    const handleTouchEnd = () => {
      lastTouchY = undefined;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      syncAnimationState();
    });
    visibilityObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      themeIsRiso = document.documentElement.classList.contains('riso');
      render(reducedMotion ? 0 : (performance.now() - startedAt) / 1000);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', syncAnimationState);

    avatar.addEventListener('load', () => {
      sampleAvatar();
      render(reducedMotion ? 0 : (performance.now() - startedAt) / 1000);
    }, { once: true });
    avatar.src = '/avatar.jpg';

    resize();
    if (!reducedMotion) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('wheel', handleWheel, { passive: true });
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
      startAnimation();
    }

    onCleanup(() => {
      stopAnimation();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      document.removeEventListener('visibilitychange', syncAnimationState);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      themeObserver.disconnect();
    });
  });

  return <canvas ref={canvasRef} class="home-signal-canvas" aria-hidden="true" />;
}
