/**
 * 1-bit Dithering Library
 *
 * 实现多种经典抖动算法，将灰度图像转换为纯黑白（1-bit）输出。
 * 参考思路来自 Lucas Pope《Return of the Obra Dinn》帖子：
 * https://forums.tigsource.com/index.php?topic=40832.0
 */

export type DitherMethod = 'bayer' | 'floyd-steinberg' | 'threshold' | 'random';
export type BayerSize = 4 | 8 | 16;

// ===== Bayer 多尺寸矩阵 =====

const BAYER_4x4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

const BAYER_8x8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const BAYER_16x16 = (() => {
  const m: number[][] = [];
  for (let y = 0; y < 16; y++) {
    const row: number[] = [];
    for (let x = 0; x < 16; x++) {
      const sub = BAYER_8x8[y % 8][x % 8];
      const quadrant = (Math.floor(y / 8) * 2 + Math.floor(x / 8)) * 64;
      row.push(sub + quadrant);
    }
    m.push(row);
  }
  return m;
})();

const BAYER_MAPS: Record<BayerSize, { matrix: number[][]; size: number; max: number }> = {
  4:  { matrix: BAYER_4x4,   size: 4,  max: 16  },
  8:  { matrix: BAYER_8x8,   size: 8,  max: 64  },
  16: { matrix: BAYER_16x16, size: 16, max: 256 },
};

/** Bayer 有序抖动（支持 4x4 / 8x8 / 16x16 矩阵） */
export function bayerDither(src: ImageData, threshold = 128, size: BayerSize = 8): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(width, height);
  const dst = out.data;
  const { matrix, size: s, max } = BAYER_MAPS[size];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const bayerValue = (matrix[y % s][x % s] / max) * 255 - 128;
      const result = gray + bayerValue > threshold ? 255 : 0;
      dst[i] = dst[i + 1] = dst[i + 2] = result;
      dst[i + 3] = 255;
    }
  }
  return out;
}

/** Floyd-Steinberg 误差扩散 */
export function floydSteinbergDither(src: ImageData, threshold = 128): ImageData {
  const { width, height } = src;
  const buf = new Float32Array(width * height);
  for (let i = 0, j = 0; i < src.data.length; i += 4, j++) {
    buf[j] = src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114;
  }
  const out = new ImageData(width, height);
  const dst = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buf[idx];
      const newVal = oldVal > threshold ? 255 : 0;
      const err = oldVal - newVal;
      const i = idx * 4;
      dst[i] = dst[i + 1] = dst[i + 2] = newVal;
      dst[i + 3] = 255;
      if (x + 1 < width)        buf[idx + 1]         += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0)              buf[idx + width - 1] += err * 3 / 16;
                                 buf[idx + width]     += err * 5 / 16;
        if (x + 1 < width)      buf[idx + width + 1] += err * 1 / 16;
      }
    }
  }
  return out;
}

/**
 * Floyd-Steinberg 误差扩散（带时域平滑，用于动画）
 * 将上一帧的二值结果按 (1-blend) 比例混入当前帧输入，
 * 大幅减少帧间像素翻转频率，抑制闪烁。
 * @returns [dithered ImageData, 当前帧亮度缓冲（传给下一帧的 prev）]
 */
export function floydSteinbergDitherStable(
  src: ImageData,
  threshold = 128,
  prev?: Float32Array,
  blend = 0.65,
): [ImageData, Float32Array] {
  const { width, height } = src;
  const buf = new Float32Array(width * height);
  for (let i = 0, j = 0; i < src.data.length; i += 4, j++) {
    buf[j] = src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114;
  }
  if (prev) {
    for (let j = 0; j < buf.length; j++) {
      buf[j] = buf[j] * blend + prev[j] * (1 - blend);
    }
  }
  const out = new ImageData(width, height);
  const dst = out.data;
  const resultBuf = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buf[idx];
      const newVal = oldVal > threshold ? 255 : 0;
      const err = oldVal - newVal;
      const i = idx * 4;
      dst[i] = dst[i + 1] = dst[i + 2] = newVal;
      dst[i + 3] = 255;
      resultBuf[idx] = newVal;
      if (x + 1 < width)        buf[idx + 1]         += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0)              buf[idx + width - 1] += err * 3 / 16;
                                 buf[idx + width]     += err * 5 / 16;
        if (x + 1 < width)      buf[idx + width + 1] += err * 1 / 16;
      }
    }
  }
  return [out, resultBuf];
}

/** 纯阈值二值化 */
export function thresholdDither(src: ImageData, threshold = 128): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const result = gray > threshold ? 255 : 0;
    dst[i] = dst[i + 1] = dst[i + 2] = result;
    dst[i + 3] = 255;
  }
  return out;
}

/** 随机抖动 */
export function randomDither(src: ImageData, threshold = 128): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const noise = (Math.random() - 0.5) * 64;
    const result = gray + noise > threshold ? 255 : 0;
    dst[i] = dst[i + 1] = dst[i + 2] = result;
    dst[i + 3] = 255;
  }
  return out;
}

/** 统一入口 */
export function applyDither(src: ImageData, method: DitherMethod, threshold = 128, bayerSize: BayerSize = 8): ImageData {
  switch (method) {
    case 'bayer':           return bayerDither(src, threshold, bayerSize);
    case 'floyd-steinberg': return floydSteinbergDither(src, threshold);
    case 'threshold':       return thresholdDither(src, threshold);
    case 'random':          return randomDither(src, threshold);
  }
}
