import { createSignal, Show } from "solid-js";
import { useStore } from "@nanostores/solid";
import {
  opacityStore,
  thresholdStore,
  speedStore,
  resolutionStore,
  resetOneBitSettings,
} from "./onebit-settings";

export default function OneBitControls() {
  const opacity = useStore(opacityStore);
  const threshold = useStore(thresholdStore);
  const speed = useStore(speedStore);
  const resolution = useStore(resolutionStore);
  const [panelOpen, setPanelOpen] = createSignal(false);

  return (
    <div class="onebit-panel">
      <Show when={panelOpen()}>
        <div id="onebit-panel-body" class="onebit-panel-body">
          <label class="onebit-row">
            <span>不透明度</span>
            <input type="range" min="0" max="0.3" step="0.01" value={opacity()} onInput={(e) => opacityStore.set(+e.currentTarget.value)} />
            <span class="onebit-val">{Math.round(opacity() * 100)}%</span>
          </label>
          <label class="onebit-row">
            <span>阈值</span>
            <input type="range" min="0" max="255" step="1" value={threshold()} onInput={(e) => thresholdStore.set(+e.currentTarget.value)} />
            <span class="onebit-val">{threshold()}</span>
          </label>
          <label class="onebit-row">
            <span>速度</span>
            <input type="range" min="0" max="1" step="0.05" value={speed()} onInput={(e) => speedStore.set(+e.currentTarget.value)} />
            <span class="onebit-val">{speed().toFixed(2)}x</span>
          </label>
          <label class="onebit-row">
            <span>分辨率</span>
            <input type="range" min="200" max="1200" step="100" value={resolution()} onInput={(e) => resolutionStore.set(+e.currentTarget.value)} />
            <span class="onebit-val">{resolution()}px</span>
          </label>
          <button class="onebit-reset" onClick={resetOneBitSettings}>重置默认</button>
        </div>
      </Show>
      <button class="onebit-toggle" onClick={() => setPanelOpen(!panelOpen())} aria-label="背景设置" aria-expanded={panelOpen()} aria-controls="onebit-panel-body">
        <span>▦</span>
      </button>
    </div>
  );
}
