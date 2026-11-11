import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType, Table2, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { exportToGoogleSheet, syncDatabaseToSheet } from "@/lib/google-sheets.functions";
import {
  exportToCSV,
  exportToExcel,
  exportToWord,
  exportToPDF,
  type ExportColumn,
  type ExportRow,
} from "@/lib/export-data";

type Props = {
  /** Base file name (without extension) and document title. */
  filename: string;
  title: string;
  columns: ExportColumn[];
  /** Lazy row builder so we only serialize on demand. */
  rows: ExportRow[] | (() => ExportRow[]);
  variant?: "guru" | "siswa" | "outline";
  size?: "sm" | "default";
  /** Show the "sync to Google Sheets" option (teachers only). */
  allowGoogleSheets?: boolean;
  backupGrades?: boolean;
};

export function ExportMenu({ filename, title, columns, rows, variant = "outline", size = "sm", allowGoogleSheets = true, backupGrades = false }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const sheetFn = useServerFn(exportToGoogleSheet);
  const backupFn = useServerFn(syncDatabaseToSheet);
  const getRows = () => (typeof rows === "function" ? rows() : rows);

  function cellText(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toLocaleString();
    return String(v);
  }

  async function syncGoogleSheet() {
    setSyncing(true);
    const tid = toast.loading(lang === "id" ? "Mengirim data ke Google Spreadsheet…" : "Sending data to Google Sheets…");
    try {
      const dataRows = getRows();
      const values = [
        columns.map((c) => c.header),
        ...dataRows.map((r) => columns.map((c) => cellText(r[c.key]))),
      ];
      const res = backupGrades ? await backupFn() : await sheetFn({ data: { title, values } });
      toast.success(lang === "id" ? (backupGrades ? `Backup ${res.tables} tab diperbarui!` : "Backup diperbarui di spreadsheet guru!") : "Teacher spreadsheet updated!", {
        id: tid,
        action: { label: lang === "id" ? "Buka" : "Open", onClick: () => window.open(res.url, "_blank") },
      });
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? (lang === "id" ? "Gagal mengekspor ke Google Spreadsheet." : "Failed to export to Google Sheets."), { id: tid });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Download className="size-4" /> {lang === "id" ? "Ekspor" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{lang === "id" ? "Unduh sebagai" : "Download as"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allowGoogleSheets && (
          <>
            <DropdownMenuItem disabled={syncing} onClick={(e) => { e.preventDefault(); syncGoogleSheet(); }}>
              {syncing ? <Loader2 className="size-4 animate-spin text-emerald-600" /> : <Cloud className="size-4 text-emerald-600" />}
              {lang === "id" ? "Google Spreadsheet (file guru)" : "Google Sheets (teacher file)"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => exportToCSV(filename, columns, getRows())}>
          <FileSpreadsheet className="size-4 text-emerald-600" /> {lang === "id" ? "CSV (impor manual)" : "CSV file"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(filename, title, columns, getRows())}>
          <Table2 className="size-4 text-emerald-700" /> Microsoft Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToWord(filename, title, columns, getRows())}>
          <FileType className="size-4 text-blue-600" /> Microsoft Word (.doc)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF(title, columns, getRows())}>
          <FileText className="size-4 text-rose-600" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
