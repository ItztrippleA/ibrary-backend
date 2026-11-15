/** App labels vs content-API class_name values. */
export const CONTENT_CLASSES = [
  { label: 'SS1', api: 'SSS 1' },
  { label: 'SS2', api: 'SSS 2' },
  { label: 'SS3', api: 'SSS 3' },
] as const;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function toApiClassName(input?: string): string {
  const raw = (input ?? 'SS1').trim();
  const key = normalize(raw);
  const match = CONTENT_CLASSES.find(
    (item) => normalize(item.label) === key || normalize(item.api) === key,
  );
  return match?.api ?? 'SSS 1';
}

export function toDisplayClassName(input?: string): string {
  const api = toApiClassName(input);
  return CONTENT_CLASSES.find((item) => item.api === api)?.label ?? 'SS1';
}
