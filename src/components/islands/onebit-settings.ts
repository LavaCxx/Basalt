import { persistentAtom } from "@nanostores/persistent";

const numStore = (key: string, def: number) =>
  persistentAtom<number>(key, def, {
    encode: String,
    decode: Number,
  });

export const opacityStore = numStore("bg-opacity", 0.03);
export const thresholdStore = numStore("bg-threshold", 140);
export const speedStore = numStore("bg-speed", 0.15);
export const resolutionStore = numStore("bg-resolution", 1200);

export const resetOneBitSettings = () => {
  opacityStore.set(0.03);
  thresholdStore.set(140);
  speedStore.set(0.15);
  resolutionStore.set(1200);
};
