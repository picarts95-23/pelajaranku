import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, TrendingDown, TrendingUp, Minus, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ExportMenu } from "@/components/export-menu";
import { HALAQOH_WEIGHTS, predikatOf, setoranLabel } from "@/lib/mutabaah";

type Kind = "ziyadah" | "murojaah" | "tilawah" | "iqro";

function normKind(raw: string | null | undefined): Kind {
  const v = (raw ?? "").toLowerCase();
  if (v.startsWith("muroj") || v.startsWith("muraj")) return "murojaah";
  if (v.startsWith("tilawah")) return "tilawah";
  if (v.startsWith("iqro") || v.startsWith("iqra")) return "iqro";
  return "ziyadah";
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((n, v) => n + v, 0) / xs.length : null);
const r0 = (v: number | null) => (v == null ? null : Math.round(v));

/**
 * Rekap rata-rata kelas Halaqoh + progres tiap siswa, murni dari data
 * Mutaba'ah yang diinput guru (bukan dari tugas bertanda).
 */
export function RekapHalaqoh({ classId, students }: { classId: string; students: { id: string; full_name: string }[] }) {
  const { lang } = useLang();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rekap-halaqoh-records", classId],
    enabled: !!classId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () =>
      (await (supabase as any)
        .from("tahfidz_mutabaah")
        .select("student_id, session_date, session_type, setoran_kind, total_score, tajwid_score, kelancaran_score, fashohah_score, pages_count, juz, surah, iqro_jilid, iqro_page")
        .eq("class_id", classId)
        .order("session_date", { ascending: true })).data ?? [],
  });

  const list = records as any[];

  const perStudent = useMemo(() => {
    return students
      .map((stu) => {
        const rows = list.filter((r) => r.student_id === stu.id);
        const byKind: Record<Kind, number[]> = { ziyadah: [], murojaah: [], tilawah: [], iqro: [] };
        rows.forEach((r) => byKind[normKind(r.setoran_kind ?? r.session_type)].push(Number(r.total_score ?? 0)));

        const parts = (["ziyadah", "murojaah", "tilawah"] as const)
          .map((k) => ({ value: avg(byKind[k]), weight: HALAQOH_WEIGHTS[k] }))
          .filter((p) => p.value != null);
        const totalWeight = parts.reduce((n, p) => n + p.weight, 0);
        const akumulasi = totalWeight
          ? parts.reduce((n, p) => n + (p.value as number) * p.weight, 0) / totalWeight
          : avg(byKind.iqro) ?? 0;

        // Tren: rata-rata 3 setoran terakhir dibanding 3 sebelumnya.
        const scores = rows.map((r) => Number(r.total_score ?? 0));
        const last3 = avg(scores.slice(-3));
        const prev3 = avg(scores.slice(-6, -3));
        const delta = last3 != null && prev3 != null ? last3 - prev3 : null;

        const pages = rows.reduce((n, r) => n + Number(r.pages_count ?? 0), 0);
        const juzSet = new Set(rows.map((r) => r.juz).filter((j: any) => j != null));
        const lastRow = rows[rows.length - 1];

        return {
          id: stu.id,
          name: stu.full_name,
          sessions: rows.length,
          ziyadah: r0(avg(byKind.ziyadah)),
          murojaah: r0(avg(byKind.murojaah)),
          tilawah: r0(avg(byKind.tilawah)),
          iqro: r0(avg(byKind.iqro)),
          tajwid: r0(avg(rows.map((r) => Number(r.tajwid_score ?? 0)))),
          kelancaran: r0(avg(rows.map((r) => Number(r.kelancaran_score ?? 0)))),
          fashohah: r0(avg(rows.map((r) => Number(r.fashohah_score ?? 0)))),
          akumulasi: Math.round(akumulasi),
          delta: delta == null ? null : Math.round(delta),
          pages: Math.round(pages * 10) / 10,
          juzCount: juzSet.size,
          lastDate: lastRow?.session_date ?? null,
          lastKind: lastRow ? setoranLabel(lastRow.setoran_kind ?? lastRow.session_type, lang) : null,
        };
      })
      .sort((a, b) => b.akumulasi - a.akumulasi);
  }, [students, list, lang]);

  const withData = perStudent.filter((s) => s.sessions > 0);

  const classAvg = useMemo(() => {
    const scores = list.map((r) => Number(r.total_score ?? 0));
    const byKind: Record<Kind, number[]> = { ziyadah: [], murojaah: [], tilawah: [], iqro: [] };
    list.forEach((r) => byKind[normKind(r.setoran_kind ?? r.session_type)].push(Number(r.total_score ?? 0)));
    return {
      total: r0(avg(scores)),
      akumulasi: withData.length ? Math.round(avg(withData.map((s) => s.akumulasi))!) : null,
      ziyadah: r0(avg(byKind.ziyadah)),
      murojaah: r0(avg(byKind.murojaah)),
      tilawah: r0(avg(byKind.tilawah)),
      iqro: r0(avg(byKind.iqro)),
      sessions: list.length,
      pages: Math.round(list.reduce((n, r) => n + Number(r.pages_count ?? 0), 0) * 10) / 10,
    };
  }, [list, withData]);

  const exportColumns = [
    { key: "name", header: lang === "id" ? "Nama Siswa" : "Student" },
    { key: "sessions", header: lang === "id" ? "Jumlah Setoran" : "Sessions" },
    { key: "ziyadah", header: "Ziyadah" },
    { key: "murojaah", header: "Muroja'ah" },
    { key: "tilawah", header: lang === "id" ? "Tilawah" : "Tilawah" },
    { key: "iqro", header: "Iqro" },
    { key: "tajwid", header: "Tajwid" },
    { key: "kelancaran", header: lang === "id" ? "Kelancaran" : "Fluency" },
    { key: "fashohah", header: "Fashohah & Adab" },
    { key: "pages", header: lang === "id" ? "Total Halaman" : "Pages" },
    { key: "akumulasi", header: lang === "id" ? "Akumulasi" : "Accumulated" },
    { key: "predikat", header: lang === "id" ? "Predikat" : "Grade" },
  ];

  return (
    <div className="rounded-3xl border-2 border-guru/30 bg-card p-4 shadow-card-rpg sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold flex items-center gap-2 sm:text-lg">
          <BookOpenCheck className="size-5 text-guru" />
          {lang === "id" ? "Rekap Kelas Halaqoh (Mutaba'ah)" : "Halaqoh Class Recap (Mutaba'ah)"}
        </h3>
        {withData.length > 0 && (
          <ExportMenu
            filename="rekap-halaqoh"
            title={lang === "id" ? "Rekap Kelas Halaqoh" : "Halaqoh Class Recap"}
            columns={exportColumns}
            rows={() => withData.map((s) => ({ ...s, predikat: predikatOf(s.akumulasi, lang) }))}
          />
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {lang === "id"
          ? "Diambil dari data Mutaba'ah yang Anda input. Akumulasi = Ziyadah 30% · Muroja'ah 40% · Tilawah 30% (komponen yang belum ada tidak dihitung)."
          : "Sourced from your Mutaba'ah records. Accumulated = Ziyadah 30% · Muroja'ah 40% · Tilawah 30% (missing components are skipped)."}
      </p>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">{lang === "id" ? "Memuat…" : "Loading…"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          {lang === "id"
            ? "Belum ada data Mutaba'ah untuk kelas ini. Input dulu di fitur Mutaba'ah Tahfidz."
            : "No Mutaba'ah records for this class yet."}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={lang === "id" ? "Rata-rata Kelas" : "Class Average"} value={classAvg.akumulasi} big />
            <Stat label="Ziyadah" value={classAvg.ziyadah} />
            <Stat label="Muroja'ah" value={classAvg.murojaah} />
            <Stat label="Tilawah" value={classAvg.tilawah} />
            <Stat label="Iqro" value={classAvg.iqro} />
            <Stat label={lang === "id" ? "Total Setoran" : "Sessions"} value={classAvg.sessions} plain />
          </div>

          <div className="overflow-x-auto rounded-2xl border-2 border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{lang === "id" ? "Nama" : "Name"}</th>
                  <th className="px-3 py-2 text-center">{lang === "id" ? "Setoran" : "Sessions"}</th>
                  <th className="px-3 py-2 text-center">Ziyadah</th>
                  <th className="px-3 py-2 text-center">Muroja'ah</th>
                  <th className="px-3 py-2 text-center">Tilawah</th>
                  <th className="px-3 py-2 text-center">Iqro</th>
                  <th className="px-3 py-2 text-center">{lang === "id" ? "Halaman" : "Pages"}</th>
                  <th className="px-3 py-2 text-center">{lang === "id" ? "Akumulasi" : "Accum."}</th>
                  <th className="px-3 py-2 text-center">{lang === "id" ? "Progres" : "Trend"}</th>
                </tr>
              </thead>
              <tbody>
                {perStudent.map((s, i) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-display font-semibold">{s.name}</div>
                      {s.lastDate && (
                        <div className="text-[11px] text-muted-foreground">
                          {lang === "id" ? "Terakhir" : "Last"}: {s.lastDate} · {s.lastKind}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{s.sessions}</td>
                    <td className="px-3 py-2 text-center">{s.ziyadah ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{s.murojaah ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{s.tilawah ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{s.iqro ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{s.pages || "—"}</td>
                    <td className="px-3 py-2 text-center font-display text-base font-bold">
                      {s.sessions ? s.akumulasi : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.delta == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : s.delta > 1 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><TrendingUp className="size-3.5" />+{s.delta}</span>
                      ) : s.delta < -1 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><TrendingDown className="size-3.5" />{s.delta}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-3.5" />{lang === "id" ? "stabil" : "steady"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t-2 border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <Users className="size-3.5" />
              {lang === "id"
                ? `${withData.length}/${students.length} siswa sudah punya catatan Mutaba'ah · total ${classAvg.pages || 0} halaman tilawah. Progres = rata-rata 3 setoran terakhir dibanding 3 sebelumnya.`
                : `${withData.length}/${students.length} students have Mutaba'ah records · ${classAvg.pages || 0} pages total. Trend = last 3 sessions vs the previous 3.`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, big, plain }: { label: string; value: number | null; big?: boolean; plain?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 px-3 py-2 text-center ${big ? "border-guru/40 bg-guru/5" : "border-border bg-muted/30"}`}>
      <div className="text-[10px] font-display font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display font-bold ${big ? "text-2xl text-guru" : "text-lg"}`}>{value ?? "—"}</div>
      {!plain && value != null && big && (
        <div className="text-[10px] text-muted-foreground">{predikatOf(value, "id")}</div>
      )}
    </div>
  );
}
