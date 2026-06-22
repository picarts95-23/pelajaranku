// Generic client-side data export helpers.
// Produces files that open in Google Spreadsheet / Excel (CSV & XLS),
// Microsoft Word (.doc) and PDF (via the browser print dialog).

export type ExportColumn = { key: string; header: string };
export type ExportRow = Record<string, unknown>;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** CSV — opens cleanly in Google Sheets and Excel. */
export function exportToCSV(filename: string, columns: ExportColumn[], rows: ExportRow[]) {
  const csvCell = (v: unknown) => {
    const s = cell(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + head + "\n" + body], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

function buildHtmlTable(title: string, columns: ExportColumn[], rows: ExportRow[]): string {
  const thead = `<tr>${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(cell(r[c.key]))}</td>`).join("")}</tr>`)
    .join("");
  return `<h2>${escapeHtml(title)}</h2>
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
      <thead style="background:#e8f0fe;font-weight:bold;">${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;
}

/** Excel (.xls) via an HTML table — opens directly in Excel & Google Sheets. */
export function exportToExcel(filename: string, title: string, columns: ExportColumn[], rows: ExportRow[]) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /></head><body>${buildHtmlTable(title, columns, rows)}</body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  triggerDownload(blob, `${filename}.xls`);
}

/** Word (.doc) via an HTML document — opens in Microsoft Word & Google Docs. */
export function exportToWord(filename: string, title: string, columns: ExportColumn[], rows: ExportRow[]) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
    <body style="font-family:Arial,sans-serif;">${buildHtmlTable(title, columns, rows)}
      <p style="font-size:11px;color:#666;margin-top:16px;">Diekspor dari EduQuest Academy · ${new Date().toLocaleString()}</p>
    </body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8;" });
  triggerDownload(blob, `${filename}.doc`);
}

/** PDF via the browser print dialog (user chooses "Save as PDF"). */
export function exportToPDF(title: string, columns: ExportColumn[], rows: ExportRow[]) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;}
      h2{margin:0 0 16px;}
      table{border-collapse:collapse;width:100%;font-size:12px;}
      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;}
      thead th{background:#e8f0fe;}
      .meta{font-size:11px;color:#666;margin-top:16px;}
    </style></head>
    <body>${buildHtmlTable(title, columns, rows)}
      <p class="meta">Diekspor dari EduQuest Academy · ${new Date().toLocaleString()}</p>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}
