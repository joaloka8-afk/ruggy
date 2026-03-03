interface CleanBotTextOptions {
  maxLength?: number;
}

const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function cleanBotText(input: string, options: CleanBotTextOptions = {}): string {
  const maxLength = options.maxLength ?? 3900;

  const normalizedNewLines = input.replace(/\r\n?/g, "\n");
  const noControlChars = normalizedNewLines.replace(CONTROL_CHARS_PATTERN, "");
  const normalizedLines = noControlChars
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
  const compactBlankLines = normalizedLines.replace(/\n{3,}/g, "\n\n").trim();

  const output = compactBlankLines.length > 0 ? compactBlankLines : "Message unavailable.";
  return output.length > maxLength ? `${output.slice(0, maxLength - 3)}...` : output;
}

