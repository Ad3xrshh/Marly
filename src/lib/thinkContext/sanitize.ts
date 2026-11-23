const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_OVERRIDE_REGEX = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const RESERVED_DELIMITER_TAGS_REGEX =
  /<\/?\s*(?:workspace_context_json|workspace_context|system_instruction|assistant_rules)\b[^>]*>/gi;

export interface SanitizedTextResult {
  text: string | null;
  truncated: boolean;
}

/**
 * Strips control characters, bidi override characters, and reserved prompt-boundary
 * tags from user-authored strings before bounding length.
 */
export function sanitizeContextText(
  value: string | null | undefined,
  maxLength: number
): SanitizedTextResult {
  if (typeof value !== 'string') {
    return { text: null, truncated: false };
  }

  const cleaned = value
    .replace(CONTROL_CHARS_REGEX, ' ')
    .replace(BIDI_OVERRIDE_REGEX, '')
    .replace(RESERVED_DELIMITER_TAGS_REGEX, '[tag-removed]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) {
    return { text: null, truncated: false };
  }

  if (cleaned.length <= maxLength) {
    return { text: cleaned, truncated: false };
  }

  const sliceLen = Math.max(1, maxLength - 3);
  return {
    text: `${cleaned.slice(0, sliceLen).trimEnd()}...`,
    truncated: true,
  };
}

export function sanitizeRequiredContextLabel(
  value: string | null | undefined,
  maxLength: number,
  fallback = 'Untitled'
): string {
  const sanitized = sanitizeContextText(value, maxLength);
  return sanitized.text ?? fallback;
}

/**
 * Conservative deterministic JSON token estimator.
 *
 * Uses both UTF-8 byte density (`bytes / 3.3`) and lexical token density
 * (`words + punctuation symbols * 0.92`) rather than naive `chars / 4`, because
 * compact structured JSON contains punctuation, ISO dates, and snake/camel keys
 * that tokenize more densely than plain English prose.
 */
export function estimateJsonTokens(value: unknown): number {
  const json = JSON.stringify(value);
  if (!json) return 0;

  const utf8Bytes = Buffer.byteLength(json, 'utf8');
  const lexicalUnits = json.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+/g)?.length ?? 0;

  const byteEstimate = Math.ceil(utf8Bytes / 3.2);
  const lexicalEstimate = Math.ceil(lexicalUnits * 0.95);
  return Math.max(byteEstimate, lexicalEstimate);
}
