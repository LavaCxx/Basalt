import { createSignal, onCleanup, onMount } from "solid-js";

type AnimalId = "cat" | "frog" | "hamster" | "seal";
type SeedState = { seed: number; animal: AnimalId };

const animals: { id: AnimalId; label: string }[] = [
  { id: "cat", label: "猫" },
  { id: "frog", label: "蛙" },
  { id: "hamster", label: "鼠" },
  { id: "seal", label: "豹" },
];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SeedState,
  misregistration: number,
  halftone: number,
  grain: number,
  asciiDensity: number,
  time: number,
) {
  const random = mulberry32(state.seed);
  const cx = width / 2;
  const cy = height * 0.55;
  const scale = width / 640;
  const drift = misregistration * 9 * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#eff7e6";
  ctx.fillRect(0, 0, width, height);

  const drawLayer = (color: string, dx: number, dy: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(dx, dy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const headWidth = 310 * scale;
    const headHeight = 268 * scale;
    const headX = cx - headWidth / 2;
    const headY = cy - headHeight / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, headWidth / 2, headHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 9 * scale;
    if (state.animal === "cat" || state.animal === "hamster") {
      const earOffset = 86 * scale;
      const earHeight = (state.animal === "cat" ? 135 : 68) * scale;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(cx + side * earOffset - 46 * scale, headY + 74 * scale);
        ctx.quadraticCurveTo(
          cx + side * (earOffset + 18 * scale),
          headY - earHeight,
          cx + side * (earOffset + 78 * scale),
          headY + 66 * scale,
        );
        ctx.closePath();
        ctx.fill();
      });
    }

    if (state.animal === "seal") {
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.ellipse(cx + side * 150 * scale, headY + 10 * scale, 55 * scale, 24 * scale, side * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const eyeY = cy - 14 * scale;
    const eyeDistance = 78 * scale;
    const eyeSize = state.animal === "frog" ? 48 : 28;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(cx + side * eyeDistance, eyeY, eyeSize * scale, (eyeSize + 8) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    if (state.animal === "cat") {
      ctx.beginPath();
      ctx.moveTo(cx - 19 * scale, cy + 38 * scale);
      ctx.lineTo(cx + 19 * scale, cy + 38 * scale);
      ctx.lineTo(cx, cy + 58 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = 10 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 62 * scale, cy + 73 * scale);
      ctx.quadraticCurveTo(cx - 31 * scale, cy + 95 * scale, cx, cy + 70 * scale);
      ctx.quadraticCurveTo(cx + 31 * scale, cy + 95 * scale, cx + 62 * scale, cy + 73 * scale);
      ctx.stroke();
    } else {
      ctx.lineWidth = 12 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy + 24 * scale, 57 * scale, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    if (state.animal === "frog") {
      ctx.lineWidth = 10 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy + 61 * scale, 65 * scale, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();
    }

    if (state.animal === "cat") {
      ctx.lineWidth = 9 * scale;
      [-2, -1, 1, 2].forEach((index) => {
        ctx.beginPath();
        ctx.moveTo(cx + index * 19 * scale, cy + 60 * scale);
        ctx.lineTo(cx + index * 34 * scale, cy + 74 * scale);
        ctx.stroke();
      });
    }

    if (state.animal === "seal") {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 100 * scale, 20 * scale, 34 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  drawLayer("#3f9a67", -drift, -drift * 0.35, 0.69);
  drawLayer("#178f4d", drift * 0.45, drift, 0.62);
  drawLayer("#183c2c", -drift * 0.15, drift * 0.25, 0.86);

  ctx.save();
  ctx.globalAlpha = 0.2 + halftone * 0.22;
  ctx.fillStyle = "#123a29";
  const dotSize = (2.5 + halftone * 3.5) * scale;
  for (let y = dotSize; y < height; y += dotSize * 3.4) {
    for (let x = dotSize; x < width; x += dotSize * 3.4) {
      const wave = 0.55 + 0.45 * Math.sin((x + y) * 0.025 + time * 0.3 + state.seed);
      ctx.beginPath();
      ctx.arc(x, y, dotSize * wave, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.48 + grain * 0.4;
  const grainCount = 2400 + grain * 7200;
  for (let index = 0; index < grainCount; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = random() * 2 * scale * (0.7 + grain);
    ctx.fillStyle = random() > 0.55 ? "rgba(255,255,255,0.48)" : "rgba(15,53,35,0.3)";
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  const gradient = ctx.createRadialGradient(cx, cy - 30 * scale, 40 * scale, cx, cy, width * 0.72);
  gradient.addColorStop(0, "rgba(255,255,255,0.42)");
  gradient.addColorStop(1, "rgba(9,37,25,0.36)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if (asciiDensity > 0) {
    const characterSize = Math.max(9, 18 - asciiDensity * 6) * scale;
    ctx.save();
    ctx.globalAlpha = 0.14 + asciiDensity * 0.24;
    ctx.fillStyle = "#0f3523";
    ctx.font = `${Math.round(characterSize)}px ui-monospace, monospace`;
    const characters = "01GREEN*+°∴≈";
    for (let y = 0; y < height; y += characterSize * 1.3) {
      for (let x = 0; x < width; x += characterSize * 0.82) {
        if (random() < asciiDensity * 0.55) {
          ctx.fillText(characters[Math.floor(random() * characters.length)], x + Math.sin((x + y + time * 40) * 0.03) * 3, y);
        }
      }
    }
    ctx.restore();
  }
}

export default function RisoPortraitLab() {
  let canvasRef: HTMLCanvasElement | undefined;
  let frameId = 0;
  const [seed, setSeed] = createSignal(20260818);
  const [animal, setAnimal] = createSignal<AnimalId>("cat");
  const [misregistration, setMisregistration] = createSignal(0.55);
  const [halftone, setHalftone] = createSignal(0.5);
  const [grain, setGrain] = createSignal(0.45);
  const [asciiDensity, setAsciiDensity] = createSignal(0.4);
  const [animate, setAnimate] = createSignal(true);

  onMount(() => {
    const canvas = canvasRef!;
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const started = performance.now();

    const frame = () => {
      drawPortrait(
        ctx,
        canvas.width,
        canvas.height,
        { seed: seed(), animal: animal() },
        misregistration(),
        halftone(),
        grain(),
        asciiDensity(),
        animate() ? (performance.now() - started) / 1000 : 1,
      );
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    onCleanup(() => cancelAnimationFrame(frameId));
  });

  const download = () => {
    const link = document.createElement("a");
    link.download = `riso-portrait-${seed()}.png`;
    link.href = canvasRef!.toDataURL("image/png");
    link.click();
  };

  return (
    <section class="riso-lab" aria-label="RISO 治愈系小动物插画实验">
      <div class="riso-stage">
        <canvas ref={canvasRef} width={640} height={640} aria-label="生成的绿色调 RISO 风格小动物头像" />
      </div>
      <div class="riso-panel">
        <div class="riso-field">
          <span>角色</span>
          <div class="riso-buttons">
            {animals.map((item) => (
              <button classList={{ active: animal() === item.id }} onClick={() => setAnimal(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <RangeControl label="错版" value={misregistration()} min={0} max={1} step={0.01} onChange={setMisregistration} />
        <RangeControl label="半色调" value={halftone()} min={0} max={1} step={0.01} onChange={setHalftone} />
        <RangeControl label="颗粒" value={grain()} min={0} max={1} step={0.01} onChange={setGrain} />
        <RangeControl label="ASCII" value={asciiDensity()} min={0} max={1} step={0.01} onChange={setAsciiDensity} />
        <div class="riso-actions">
          <button class="primary" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>
            重新生成
          </button>
          <button classList={{ active: animate() }} onClick={() => setAnimate(!animate())}>
            {animate() ? "暂停动效" : "播放动效"}
          </button>
          <button onClick={download}>下载 PNG</button>
        </div>
        <p class="riso-note">
          浏览器可复现的是这套风格语言：丝网叠印、错版、半色调、颗粒与 ASCII 动态层；无法替代扩散模型的叙事想象力。
        </p>
      </div>
    </section>
  );
}

function RangeControl(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label class="riso-field">
      <span>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onInput={(event) => props.onChange(Number(event.currentTarget.value))} />
    </label>
  );
}
