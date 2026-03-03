export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 0 : 4,
  }).format(value);
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatAgeHours(createdAtMs: number | null | undefined): string {
  if (!createdAtMs || !Number.isFinite(createdAtMs)) {
    return "n/a";
  }

  const ageHours = (Date.now() - createdAtMs) / (1000 * 60 * 60);
  if (ageHours < 1) {
    return "< 1h";
  }

  if (ageHours < 24) {
    return `${ageHours.toFixed(1)}h`;
  }

  return `${(ageHours / 24).toFixed(1)}d`;
}

