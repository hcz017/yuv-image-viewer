export type P010Alignment = "high" | "low" | "unknown";

export function detectP010Alignment(data: Uint8Array): P010Alignment {
  const words = Math.min(4096, Math.floor(data.length / 2));
  if (words < 16) {
    return "unknown";
  }

  let high = 0;
  let low = 0;
  let maxWord = 0;
  for (let index = 0; index < words; index++) {
    const offset = index * 2;
    const value = data[offset] | (data[offset + 1] << 8);
    if (value > maxWord) {
      maxWord = value;
    }
    if ((value & 0x3f) === 0) {
      high++;
    }
    if ((value & 0xfc00) === 0) {
      low++;
    }
  }

  if (maxWord === 0) {
    return "unknown";
  }
  if (maxWord <= 0x3ff) {
    return "low";
  }

  const highRatio = high / words;
  const lowRatio = low / words;
  if (highRatio > 0.95 && highRatio >= lowRatio) {
    return "high";
  }
  if (lowRatio > 0.95 && lowRatio > highRatio) {
    return "low";
  }
  return "unknown";
}
