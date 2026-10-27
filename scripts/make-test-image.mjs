import { writeFileSync } from "node:fs";

const [format, wArg, hArg, sArg, lArg, out] = process.argv.slice(2);
const width = Number(wArg);
const height = Number(hArg);
const stride = Number(sArg ?? wArg);
const scanline = Number(lArg ?? hArg);

if (!format || !out || !Number.isFinite(width)) {
  console.error("用法: node scripts/make-test-image.mjs <nv12|nv21|i420|yv12|p010-high|p010-low|p010-unknown> W H STRIDE SCANLINE OUT");
  process.exit(1);
}

const chromaStride = Math.floor(stride / 2);
const chromaHeight = Math.floor(scanline / 2);
const isP010 = format.startsWith("p010");
const bytesPerSample = isP010 ? 2 : 1;
const total = bytesPerSample * (stride * scanline + chromaStride * chromaHeight * 2);
const buf = Buffer.alloc(total);

let sampleIndex = 0;
const writeSample = (offset, value) => {
  const v = Math.max(0, Math.min(255, Math.round(value)));
  if (isP010) {
    const tenBit = v * 4;
    const useLow =
      format === "p010-low" || (format === "p010-unknown" && sampleIndex % 2 === 1);
    buf.writeUInt16LE(useLow ? tenBit : (tenBit << 6) & 0xffff, offset);
  } else {
    buf.writeUInt8(v, offset);
  }
  sampleIndex += 1;
};

// 有效区：中性灰；padding：强蓝，渲染正确时不应出现在有效区内
for (let y = 0; y < scanline; y++) {
  for (let x = 0; x < stride; x++) {
    const inValid = x < width && y < height;
    writeSample((y * stride + x) * bytesPerSample, inValid ? 128 : 0);
  }
}

const chromaBase = stride * scanline * bytesPerSample;
for (let y = 0; y < chromaHeight; y++) {
  for (let x = 0; x < chromaStride; x++) {
    const inValid = x * 2 < width && y * 2 < height;
    const u = inValid ? 128 : 255;
    const v = inValid ? 128 : 0;
    const off = chromaBase + (y * chromaStride + x) * 2 * bytesPerSample;
    if (format === "nv12" || format === "p010-high" || format === "p010-low" || format === "p010-unknown") {
      writeSample(off, u);
      writeSample(off + bytesPerSample, v);
    } else if (format === "nv21") {
      writeSample(off, v);
      writeSample(off + bytesPerSample, u);
    }
  }
}

if (format === "i420" || format === "yv12") {
  const plane = chromaStride * chromaHeight * bytesPerSample;
  for (let p = 0; p < 2; p++) {
    for (let y = 0; y < chromaHeight; y++) {
      for (let x = 0; x < chromaStride; x++) {
        const inValid = x * 2 < width && y * 2 < height;
        const value = inValid ? 128 : (p === 0 ? 255 : 0);
        const target = p === 0 ? 0 : 1;
        const planeIndex = format === "yv12" ? 1 - target : target;
        writeSample(chromaBase + plane * planeIndex + (y * chromaStride + x) * bytesPerSample, value);
      }
    }
  }
}

writeFileSync(out, buf);
console.log(`${out}: ${width}x${height} stride=${stride} scanline=${scanline} bytes=${buf.length}`);
