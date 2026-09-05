// Minimal CSV generation + browser download helpers. Kept dependency-free since
// this is a client-only app with no backend to generate files for us.

/** Escapes a single field per RFC 4180: wraps in quotes if it contains a
 * comma, quote, or newline, doubling any embedded quotes. */
const escapeCsvField = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/** Builds a CSV string from a header row plus data rows. All values are
 * stringified and escaped; no numeric/date formatting is applied here. */
export const toCsv = (header: string[], rows: string[][]): string => {
  const lines = [header, ...rows].map(row => row.map(escapeCsvField).join(','));
  // CRLF per RFC 4180; also plays nicest with Excel.
  return lines.join('\r\n');
};

/** Triggers a browser download of the given CSV content as a file. */
export const downloadCsv = (filename: string, csvContent: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
