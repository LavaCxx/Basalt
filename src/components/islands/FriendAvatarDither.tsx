import { createSignal, onCleanup, onMount } from 'solid-js';

const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

interface FriendAvatarDitherProps {
  friendId: string;
  title: string;
}

export default function FriendAvatarDither(props: FriendAvatarDitherProps) {
  const [ready, setReady] = createSignal(false);
  let canvasRef: HTMLCanvasElement | undefined;

  onMount(() => {
    const canvas = canvasRef;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;

    const sampleSize = 48;
    const image = new Image();
    let disposed = false;

    const render = () => {
      if (disposed || !image.complete || image.naturalWidth === 0) return;

      canvas.width = sampleSize;
      canvas.height = sampleSize;
      context.imageSmoothingEnabled = true;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, sampleSize, sampleSize);

      const sourceRatio = image.naturalWidth / image.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;

      if (sourceRatio > 1) {
        sourceWidth = image.naturalHeight;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else if (sourceRatio < 1) {
        sourceHeight = image.naturalWidth;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sampleSize,
        sampleSize,
      );

      let pixels: ImageData;
      try {
        pixels = context.getImageData(0, 0, sampleSize, sampleSize);
      } catch {
        setReady(false);
        return;
      }
      const data = pixels.data;
      const isRiso = document.documentElement.classList.contains('riso');
      const ink = isRiso ? [23, 113, 77] : [28, 28, 28];

      for (let pixel = 0; pixel < sampleSize * sampleSize; pixel += 1) {
        const offset = pixel * 4;
        const x = pixel % sampleSize;
        const y = Math.floor(pixel / sampleSize);
        const luminance = (
          data[offset] * 0.2126
          + data[offset + 1] * 0.7152
          + data[offset + 2] * 0.0722
        ) / 255;
        const darkness = Math.max(0, Math.min(1, (1 - luminance - 0.035) * 1.18));
        const threshold = (BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

        data[offset] = ink[0];
        data[offset + 1] = ink[1];
        data[offset + 2] = ink[2];
        data[offset + 3] = darkness > threshold ? (isRiso ? 205 : 225) : 0;
      }

      context.putImageData(pixels, 0, 0);
      setReady(true);
    };

    const handleError = () => setReady(false);

    const themeObserver = new MutationObserver(render);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    image.addEventListener('load', render);
    image.addEventListener('error', handleError);
    image.src = `/api/friend-icon?id=${encodeURIComponent(props.friendId)}`;

    onCleanup(() => {
      disposed = true;
      themeObserver.disconnect();
      image.removeEventListener('load', render);
      image.removeEventListener('error', handleError);
    });
  });

  return (
    <span class="friend-avatar-dither" classList={{ 'friend-avatar-dither-ready': ready() }} aria-hidden="true">
      <span class="friend-avatar-dither-fallback">{props.title.charAt(0)}</span>
      <canvas ref={canvasRef} />
    </span>
  );
}
