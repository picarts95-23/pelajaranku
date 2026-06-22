import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/lib/i18n";
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
};

export function ExportMenu({ filename, title, columns, rows, variant = "outline", size = "sm" }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const getRows = () => (typeof rows === "function" ? rows() : rows);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Download className="size-4" /> {lang === "id" ? "Ekspor" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{lang === "id" ? "Unduh sebagai" : "Download as"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportToCSV(filename, columns, getRows())}>
          <FileSpreadsheet className="size-4 text-emerald-600" /> Google Spreadsheet / CSV
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
