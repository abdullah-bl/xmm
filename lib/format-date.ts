const captureDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Short localized label for photo detail headers, e.g. "May 16, 11:42 AM". */
export function formatCaptureDate(timestampMs: number): string {
  return captureDateFormatter.format(new Date(timestampMs));
}
