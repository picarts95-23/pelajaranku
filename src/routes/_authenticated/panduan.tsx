import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Smartphone, Tablet, Laptop, HelpCircle, Camera, Mic, Upload, Send, Image as ImageIcon, LinkIcon, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/panduan")({
  head: () => ({
    meta: [
      { title: "Panduan Pengguna — Pelajaranku" },
      { name: "description", content: "Panduan lengkap cara mengirim tugas dan menggunakan fitur Pelajaranku di HP, tablet, maupun laptop." },
      { property: "og:title", content: "Panduan Pengguna — Pelajaranku" },
      { property: "og:description", content: "Cara mengirim tugas foto, rekaman suara, kuis, dan link — dijelaskan per perangkat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanduanPage,
});

type Device = "hp" | "tablet" | "laptop";

function detectDevice(): Device {
  if (typeof window === "undefined") return "laptop";
  const w = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua) || (w >= 768 && w < 1180 && /mobi|android/.test(ua))) return "tablet";
  if (w < 768 || /mobi|android|iphone/.test(ua)) return "hp";
  return "laptop";
}

function PanduanPage() {
  const { role } = useAuth();
  const [device, setDevice] = useState<Device>("laptop");
  useEffect(() => { setDevice(detectDevice()); }, []);

  const isGuru = role === "guru" || role === "admin";

  return (
    <DashboardShell accent={isGuru ? "guru" : "siswa"}>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <HelpCircle className="h-6 w-6" />
            <h1 className="text-2xl font-black sm:text-3xl">Panduan Pengguna</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Petunjuk singkat cara mengirim tugas & memakai fitur Pelajaranku. Pilih perangkat yang sedang kamu pakai.
          </p>
        </header>

        <DevicePicker value={device} onChange={setDevice} />

        <DeviceTips device={device} />

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Cara Mengirim Tugas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <GuideCard
              icon={<Camera className="h-5 w-5" />}
              title="Tugas Foto / Gambar"
              steps={
                device === "hp"
                  ? [
                      "Buka menu Tugas, pilih tugas yang bertipe foto.",
                      "Ketuk tombol Ambil Foto untuk memakai kamera, atau Pilih dari Galeri.",
                      "Pastikan gambar jelas & tidak lebih dari 15MB.",
                      "Tekan Kirim. Tunggu sampai muncul notifikasi berhasil.",
                    ]
                  : device === "tablet"
                  ? [
                      "Buka menu Tugas dari sidebar.",
                      "Ketuk Ambil Foto (kamera tablet) atau Pilih dari Galeri.",
                      "Periksa pratinjau, lalu tekan Kirim.",
                    ]
                  : [
                      "Buka menu Tugas dari sidebar.",
                      "Klik Pilih File dan cari gambar di komputer.",
                      "Pastikan ukuran ≤ 15MB (JPG/PNG).",
                      "Klik Kirim.",
                    ]
              }
            />
            <GuideCard
              icon={<Mic className="h-5 w-5" />}
              title="Tugas Rekaman Suara"
              steps={
                device === "hp"
                  ? [
                      "Buka tugas, ketuk tombol 🎙️ Rekam.",
                      "Izinkan akses mikrofon saat browser bertanya.",
                      "Rekam suaramu, tekan Stop bila selesai.",
                      "Dengar ulang, lalu tekan Kirim.",
                      "Tips iPhone/Safari: pakai Safari terbaru agar rekaman lancar.",
                    ]
                  : [
                      "Buka tugas, klik Rekam.",
                      "Izinkan akses mikrofon di pop-up browser.",
                      "Setelah selesai, klik Stop lalu dengarkan ulang.",
                      "Klik Kirim.",
                    ]
              }
            />
            <GuideCard
              icon={<LinkIcon className="h-5 w-5" />}
              title="Tugas Link (Google Form / Quiz)"
              steps={[
                "Buka tugas, klik tombol link yang diberikan guru.",
                "Kerjakan di tab/aplikasi yang terbuka.",
                "Kembali ke Pelajaranku, tandai selesai bila diminta.",
              ]}
            />
            <GuideCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Kuis Pilihan Ganda"
              steps={[
                "Buka tugas bertipe Kuis.",
                "Jawab setiap soal — jawaban tersimpan otomatis.",
                "Setelah semua terjawab, tekan Kirim Jawaban.",
                "Nilai muncul langsung setelah dikirim.",
              ]}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Sebelum Kirim, Periksa</h2>
          <Card className="p-4 space-y-2 text-sm">
            <p>• <b>Tenggat waktu</b>: jika sudah lewat, tombol Kirim otomatis dinonaktifkan.</p>
            <p>• <b>Koneksi internet</b>: pastikan sinyal stabil, terutama untuk upload rekaman/foto.</p>
            <p>• <b>Ukuran file</b>: foto & audio maks 15MB.</p>
            <p>• <b>Browser</b>: gunakan Chrome / Safari / Edge / Samsung Internet versi terbaru.</p>
            <p>• Jika error muncul, baca pesannya — biasanya menjelaskan penyebabnya (tenggat lewat, file terlalu besar, dsb).</p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Fitur Utama</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(isGuru ? GURU_FEATURES : SISWA_FEATURES).map((f) => (
              <Card key={f.title} className="p-4">
                <div className="font-semibold">{f.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Pasang di Layar Utama</h2>
          <Card className="p-4 space-y-2 text-sm">
            {device === "hp" && (
              <>
                <p><b>Android (Chrome):</b> Ketuk menu ⋮ → <i>Tambahkan ke layar utama</i>.</p>
                <p><b>iPhone (Safari):</b> Ketuk ikon Share ⬆️ → <i>Add to Home Screen</i>.</p>
              </>
            )}
            {device === "tablet" && (
              <p>Buka menu browser lalu pilih <i>Add to Home Screen</i> / <i>Install app</i> untuk akses cepat.</p>
            )}
            {device === "laptop" && (
              <p>Di Chrome / Edge, klik ikon ⊕ di address bar untuk <i>Install Pelajaranku</i> sebagai aplikasi desktop.</p>
            )}
          </Card>
        </section>

        <div className="pt-2">
          <Button asChild variant="outline">
            <a href={isGuru ? "/dashboard/guru" : "/dashboard/siswa"}>Kembali ke Dashboard</a>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}

function DevicePicker({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  const items: { key: Device; label: string; icon: React.ReactNode }[] = [
    { key: "hp", label: "HP", icon: <Smartphone className="h-4 w-4" /> },
    { key: "tablet", label: "Tablet", icon: <Tablet className="h-4 w-4" /> },
    { key: "laptop", label: "Laptop", icon: <Laptop className="h-4 w-4" /> },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Button
          key={it.key}
          size="sm"
          variant={value === it.key ? "default" : "outline"}
          onClick={() => onChange(it.key)}
          className="gap-2"
        >
          {it.icon} {it.label}
        </Button>
      ))}
    </div>
  );
}

function DeviceTips({ device }: { device: Device }) {
  const map: Record<Device, { title: string; tips: string[] }> = {
    hp: {
      title: "Tips untuk HP",
      tips: [
        "Putar HP ke mode potret untuk tampilan optimal.",
        "Beri izin Kamera & Mikrofon saat browser meminta.",
        "Gunakan Chrome (Android) atau Safari (iPhone) versi terbaru.",
        "Jika halaman terasa lambat, tutup tab lain & refresh.",
      ],
    },
    tablet: {
      title: "Tips untuk Tablet",
      tips: [
        "Mode landscape mempermudah membaca daftar tugas panjang.",
        "Gunakan stylus/jari untuk mengetik jawaban di kolom teks.",
        "Aktifkan pemblokir iklan? Nonaktifkan untuk domain ini agar upload lancar.",
      ],
    },
    laptop: {
      title: "Tips untuk Laptop / PC",
      tips: [
        "Gunakan Chrome / Edge / Firefox versi terbaru.",
        "Untuk kuis panjang, jangan tutup tab sebelum menekan Kirim.",
        "Shortcut: gunakan Tab & Enter untuk berpindah antar kolom lebih cepat.",
      ],
    },
  };
  const d = map[device];
  return (
    <Card className="p-4">
      <div className="mb-2 font-semibold">{d.title}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {d.tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </Card>
  );
}

function GuideCard({ icon, title, steps }: { icon: React.ReactNode; title: string; steps: string[] }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className="text-primary">{icon}</span>{title}
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </Card>
  );
}

const SISWA_FEATURES = [
  { title: "Tugas / Misi", desc: "Lihat semua tugas aktif, kirim jawaban (foto/rekaman/link/kuis), lacak tenggat waktu." },
  { title: "Permintaan Tugas", desc: "Ajukan tugas personal ke guru bila kamu ingin tantangan tambahan." },
  { title: "Kegiatan", desc: "Kalender bulanan berisi event, hari raya, & libur nasional." },
  { title: "Papan Pengumuman", desc: "Lihat pengumuman dari guru & beri reaksi/komentar." },
  { title: "Nilai & Badge", desc: "Pantau XP, coin, lencana, dan riwayat pengumpulan." },
  { title: "Mutaba'ah", desc: "Rekap hafalan Tahfidz mingguan." },
];

const GURU_FEATURES = [
  { title: "Kelas & Mapel", desc: "Kelola daftar kelas, mapel yang diampu, dan siswa di dalamnya." },
  { title: "Tugas & Bank Soal", desc: "Buat tugas (foto/audio/link/kuis), edit metadata, dan pantau pengumpul." },
  { title: "Permintaan Tugas", desc: "Balas & konversi permintaan personal siswa menjadi tugas resmi." },
  { title: "Jurnal & RPP", desc: "Catat jurnal harian dan RPP pekanan; ikut tercadangkan ke Spreadsheet." },
  { title: "Kegiatan", desc: "Rencanakan event; siswa bisa memantau via kalender. Ekspor ke Google Calendar via URL langganan." },
  { title: "Papan Pengumuman", desc: "Sebar pengumuman ke kelas, lihat reaksi & feedback siswa." },
];
