type OpenMojiEntry = {
  emoji: string;
  annotation?: string;
  tags?: string;
  openmoji_tags?: string;
  openmoji_images?: {
    color?: {
      svg?: string;
    };
  };
};

type OpenMojiPackage = {
  openmojis: OpenMojiEntry[];
};

export interface MessageVisualPack {
  emoji: string;
  slangLine: string;
  gifUrl: string;
  svgPath: string;
}

type VisualKind = "greeting" | "bullish" | "caution" | "analysis" | "default";

const GIF_LIBRARY: Record<VisualKind, string> = {
  greeting: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  bullish: "https://media.giphy.com/media/3oKIPtjElfqwMOTbH2/giphy.gif",
  caution: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  analysis: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
  default: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
};

const SLANG_LINES: Record<VisualKind, string> = {
  greeting: "GM degen. We scan first, ape later.",
  bullish: "Looks spicy, but no blind ape moves.",
  caution: "Rug vibes detected. Protect the bag.",
  analysis: "On-chain first, vibes second. DYOR always.",
  default: "Stay sharp and risk-manage your plays.",
};

const openMojiData = require("openmoji") as OpenMojiPackage;
const openMojis = openMojiData.openmojis;

function includesKeyword(entry: OpenMojiEntry, keyword: string): boolean {
  const text = `${entry.annotation ?? ""} ${entry.tags ?? ""} ${entry.openmoji_tags ?? ""}`.toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function findEmojiByKeyword(keyword: string, fallbackEmoji: string): { emoji: string; svgPath: string } {
  const entry = openMojis.find((candidate) => includesKeyword(candidate, keyword));
  return {
    emoji: entry?.emoji ?? fallbackEmoji,
    svgPath: entry?.openmoji_images?.color?.svg ?? "",
  };
}

const VISUAL_EMOJIS = {
  greeting: findEmojiByKeyword("wave", "👋"),
  bullish: findEmojiByKeyword("rocket", "🚀"),
  caution: findEmojiByKeyword("warning", "⚠️"),
  analysis: findEmojiByKeyword("magnifying glass", "🔎"),
  default: findEmojiByKeyword("robot", "🤖"),
};

function pickKindFromMessage(text: string): VisualKind {
  const normalized = text.toLowerCase();

  if (/(hello|hi|hey|gm|good morning|yo)/.test(normalized)) {
    return "greeting";
  }
  if (/(rug|scam|warning|risk|bad|dump|red flag)/.test(normalized)) {
    return "caution";
  }
  if (/(moon|pump|gem|ape|bull|send it|green candle)/.test(normalized)) {
    return "bullish";
  }
  if (/(scan|analy|contract|ca|score|report|token)/.test(normalized)) {
    return "analysis";
  }

  return "default";
}

function toVisualPack(kind: VisualKind): MessageVisualPack {
  const icon = VISUAL_EMOJIS[kind];
  return {
    emoji: icon.emoji,
    slangLine: SLANG_LINES[kind],
    gifUrl: GIF_LIBRARY[kind],
    svgPath: icon.svgPath,
  };
}

export function getMessageVisualPack(text: string): MessageVisualPack {
  return toVisualPack(pickKindFromMessage(text));
}

export function getScoreVisualPack(score: number): MessageVisualPack {
  if (score >= 80) {
    return toVisualPack("bullish");
  }
  if (score < 40) {
    return toVisualPack("caution");
  }
  return toVisualPack("analysis");
}

