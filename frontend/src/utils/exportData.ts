/**
 * Generic data export utility for downloading CSV and JSON files in the browser.
 */

export function exportToJson(filename: string, data: unknown): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  triggerDownload(filename.endsWith('.json') ? filename : `${filename}.json`, blob);
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columnHeaders?: Partial<Record<keyof T, string>>
): void {
  if (!rows || rows.length === 0) return;

  const keys = Object.keys(rows[0]) as (keyof T)[];
  const headerLabels = keys.map((k) => (columnHeaders && columnHeaders[k] ? columnHeaders[k] : String(k)));

  const csvRows: string[] = [headerLabels.map(escapeCsvValue).join(',')];

  for (const row of rows) {
    const values = keys.map((k) => escapeCsvValue(row[k]));
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(filename.endsWith('.csv') ? filename : `${filename}.csv`, blob);
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
