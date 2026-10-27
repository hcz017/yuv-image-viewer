import type { ColorStandard } from "./types";

export interface ColorCoefficients {
  rv: number;
  gu: number;
  gv: number;
  bu: number;
}

export function coefficients(standard: ColorStandard): ColorCoefficients {
  if (standard === "bt709") {
    return { rv: 1.5748, gu: 0.1873, gv: 0.4681, bu: 1.8556 };
  }
  return { rv: 1.402, gu: 0.344136, gv: 0.714136, bu: 1.772 };
}
