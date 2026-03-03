export function clampNumber(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }

  return undefined;
}

