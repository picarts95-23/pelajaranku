import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, BookOpen, Trophy, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import { demoClass, demoTopStudents, demoAssignments, demoAnnouncements, demoTahfidz } from "@/lib/demo-data";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  head: () => ({
    meta: [
      { title: "Demo Pelajaranku — Coba Tanpa Daftar" },
      { name: "description", content: "Lihat langsung tampilan Pelajaranku: dashboard guru, tugas siswa, tahfidz, dan pengumuman. Tanpa login, tanpa database." },
      { property: "og:title", content: "Demo Pelajaranku" },
      { property: "og:description", content: "Coba tur interaktif Pelajaranku tanpa daftar akun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center">
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="mr-1 size-3" /> Mode Demo — Data Contoh
          </Badge>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-5xl">
            Lihat <span className="text-primary">Pelajaranku</span> Beraksi
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tur singkat semua fitur utama. Semua data di halaman ini adalah contoh — tidak menyimpan apa-apa dan
            tidak butuh login. Jelajahi bebas.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Mulai Pakai Aplikasi <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/setup">Setup di Server Sendiri</Link>
            </Button>
          </div>
        </div>

        {/* Fitur 1: Dashboard guru */}
        <section className="mt-12">
          <SectionTitle icon={<GraduationCap className="size-5" />} n={1} title="Dashboard Guru — Kelola Kelas & Siswa Terbaik" />
          <Card className="mt-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">{demoClass.name}</h3>
                <p className="text-xs text-muted-foreground">Kode: {demoClass.code} · {demoClass.students} siswa · {demoClass.subjects.join(", ")}</p>
              </div>
              <Badge>Kelas Aktif</Badge>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-amber-500" /> Siswa Terbaik Kelas</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {demoTopStudents.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
                    <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-lg">{s.avatar}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">#{i + 1} {s.name}</p>
                      <p className="text-xs text-muted-foreground">Level {s.level} · {s.xp} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* Fitur 2: Tugas */}
        <section className="mt-10">
          <SectionTitle icon={<BookOpen className="size-5" />} n={2} title="Tugas Beragam — Kuis, Foto, Rekaman, Link" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {demoAssignments.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold">{a.title}</h4>
                  <Badge variant="outline">{typeLabel(a.type)}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deadline: {a.dueDays} hari lagi</span>
                  <span className="font-medium text-foreground">{a.submitted}/{a.total} mengumpulkan</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(a.submitted / a.total) * 100}%` }} />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Fitur 3: Tahfidz */}
        <section className="mt-10">
          <SectionTitle icon={<BookOpen className="size-5" />} n={3} title="Mutaba'ah Tahfidz — Penilaian Halaqoh" />
          <Card className="mt-3 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Nama Siswa</th>
                    <th className="p-3">Ziyadah</th>
                    <th className="p-3">Murojaah</th>
                    <th className="p-3">Tilawah</th>
                    <th className="p-3">Harian</th>
                  </tr>
                </thead>
                <tbody>
                  {demoTahfidz.map((t) => (
                    <tr key={t.name} className="border-t">
                      <td className="p-3 font-medium">{t.name}</td>
                      <td className="p-3 text-center">{t.ziyadah}</td>
                      <td className="p-3 text-center">{t.murojaah}</td>
                      <td className="p-3 text-center">{t.tilawah}</td>
                      <td className="p-3 text-center font-bold text-primary">{t.daily}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Fitur 4: Pengumuman */}
        <section className="mt-10">
          <SectionTitle icon={<MessageSquare className="size-5" />} n={4} title="Papan Pengumuman — Guru ↔ Siswa" />
          <div className="mt-3 space-y-3">
            {demoAnnouncements.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3" /> {a.author}
                </div>
                <h4 className="mt-1 font-display text-lg font-bold">{a.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {Object.entries(a.reactions).map(([emoji, count]) => (
                    <span key={emoji} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                      {emoji} <span className="font-semibold">{count}</span>
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">💬 {a.comments} komentar</span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA akhir */}
        <div className="mt-14 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center sm:p-10">
          <h2 className="font-display text-2xl font-black sm:text-3xl">Suka yang Anda lihat?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Pelajaranku dirancang untuk dimiliki penuh oleh sekolah atau ustadz Anda — semua data di server milik
            Anda sendiri (Supabase gratis), tidak dititip di pihak ketiga.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/setup">Setup Server Saya <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:pelajaranku.support@gmail.com?subject=Beli%20Pelajaranku">Hubungi untuk Beli</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sudah punya kode aktivasi? <Link to="/aktivasi" className="font-medium text-primary underline">Aktifkan di sini</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ n, title, icon }: { n: number; title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h2 className="font-display text-xl font-bold sm:text-2xl">
        <span className="text-primary/60">{n}.</span> {title}
      </h2>
    </div>
  );
}

function typeLabel(t: string) {
  return { quiz: "Kuis", voice: "Rekam Suara", image: "Foto", link: "Link" }[t] ?? t;
}
