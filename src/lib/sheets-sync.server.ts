// Server-only helper that mirrors each teacher's data into their OWN persistent
// Google Spreadsheet. Every teacher (guru) gets a distinct spreadsheet keyed by
// their user id and titled with their name + registration email. Invoked by the
// public cron route (all teachers) and by a teacher-triggered server function
// (single teacher). Never import from client code — it uses the service-role
// admin client and connector gateway secrets.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

type AttStatus = "hadir" | "izin" | "sakit" | "alpa";
const DEFAULT_WEIGHTS: Record<AttStatus, number> = { hadir: 100, izin: 50, sakit: 50, alpa: 0 };

/** Tab titles created in every teacher spreadsheet (order matters). */
const TAB_TITLES = [
  "Kelas",
  "Siswa",
  "Presensi",
  "Nilai Kehadiran",
  "Tugas",
  "Pengumpulan",
  "Tidak Mengerjakan",
  "Nilai Adab",
  "Mutaba'ah",
  "Materi",
  "Jurnal",
  "RPP Pekanan",
  "Pengumuman",
  "Event Kelas",
  "Bank Soal",
  "Badge Siswa",
] as const;

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Spreadsheet belum terhubung. Hubungkan akun Google terlebih dahulu.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// Spreadsheet plumbing
// ---------------------------------------------------------------------------

async function createSpreadsheet(title: string, headers: Record<string, string>) {
  const res = await fetch(`${GATEWAY_URL}/spreadsheets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: { title },
      sheets: TAB_TITLES.map((t) => ({ properties: { title: t } })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal membuat spreadsheet (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as { spreadsheetId: string; spreadsheetUrl: string };
}

/** Return existing tab titles, or null if the spreadsheet is gone (404). */
async function getExistingTabs(spreadsheetId: string, headers: Record<string, string>): Promise<string[] | null> {
  const res = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal membaca spreadsheet (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (json.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

async function addMissingTabs(spreadsheetId: string, existing: string[], headers: Record<string, string>) {
  const missing = TAB_TITLES.filter((t) => !existing.includes(t));
  if (missing.length === 0) return;
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ requests: missing.map((t) => ({ addSheet: { properties: { title: t } } })) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal menambah tab (${res.status}): ${body.slice(0, 200)}`);
  }
}

async function writeTab(spreadsheetId: string, tab: string, values: string[][], headers: Record<string, string>) {
  const clearRes = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${tab}!A:ZZ:clear`,
    { method: "POST", headers, body: "{}" },
  );
  if (!clearRes.ok) {
    const body = await clearRes.text();
    throw new Error(`Gagal mengosongkan tab ${tab} (${clearRes.status}): ${body.slice(0, 200)}`);
  }
  const writeRes = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${tab}!A1?valueInputOption=RAW`,
    { method: "PUT", headers, body: JSON.stringify({ values }) },
  );
  if (!writeRes.ok) {
    const body = await writeRes.text();
    throw new Error(`Gagal menulis tab ${tab} (${writeRes.status}): ${body.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Per-teacher data assembly
// ---------------------------------------------------------------------------

async function getTeacherEmail(teacherId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(teacherId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

type Tabs = Record<string, string[][]>;

/** Build every tab (name → rows incl. header) for one teacher. */
async function buildTeacherTabs(teacherId: string): Promise<Tabs> {
  // Classes owned by this teacher.
  const { data: classesRaw } = await supabaseAdmin
    .from("classes")
    .select("id, name, code, subject, subjects, academic_year, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });
  const classes = (classesRaw ?? []) as Record<string, unknown>[];
  const classIds = classes.map((c) => c.id as string);
  const classNameById = new Map<string, string>(classes.map((c) => [c.id as string, (c.name as string) ?? ""]));

  // Enrolled students across those classes.
  const enrollments = classIds.length
    ? (((await supabaseAdmin.from("class_enrollments").select("class_id, student_id, joined_at").in("class_id", classIds)).data) ?? [])
    : [];
  const studentIds = Array.from(new Set(enrollments.map((e: any) => e.student_id as string)));

  // Student profiles + private data (NIS, gender, birthdate, hobby).
  const profiles = studentIds.length
    ? (((await supabaseAdmin.from("profiles").select("id, full_name, username, class_name, xp, level, coins, character_key, created_at").in("id", studentIds)).data) ?? [])
    : [];
  const privates = studentIds.length
    ? (((await supabaseAdmin.from("profile_private").select("id, school_id_number, gender, birthdate, hobby").in("id", studentIds)).data) ?? [])
    : [];
  const privateById = new Map<string, any>(privates.map((p: any) => [p.id, p]));
  const studentNameById = new Map<string, string>(profiles.map((p: any) => [p.id as string, (p.full_name as string) ?? ""]));
  const studentNisById = new Map<string, string>(privates.map((p: any) => [p.id as string, (p.school_id_number as string) ?? ""]));

  // Class-of-enrollment lookup: primary class per student = first enrollment.
  const primaryClassByStudent = new Map<string, string>();
  for (const e of enrollments as any[]) {
    if (!primaryClassByStudent.has(e.student_id)) primaryClassByStudent.set(e.student_id, e.class_id);
  }

  // Teacher attendance weights.
  const { data: settings } = await supabaseAdmin
    .from("attendance_settings")
    .select("hadir, izin, sakit, alpa")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  const weights: Record<AttStatus, number> = {
    hadir: clamp(settings?.hadir, DEFAULT_WEIGHTS.hadir),
    izin: clamp(settings?.izin, DEFAULT_WEIGHTS.izin),
    sakit: clamp(settings?.sakit, DEFAULT_WEIGHTS.sakit),
    alpa: clamp(settings?.alpa, DEFAULT_WEIGHTS.alpa),
  };

  // Attendance records for those classes.
  const attendance = classIds.length
    ? (((await supabaseAdmin.from("attendance").select("class_id, student_id, date, status, note").in("class_id", classIds).order("date", { ascending: true })).data) ?? [])
    : [];

  // Assignments owned by this teacher.
  const { data: assignmentsRaw } = await supabaseAdmin
    .from("assignments")
    .select("id, class_id, title, subject, exam_type, halaqoh_kind, max_score, due_at, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });
  const assignments = (assignmentsRaw ?? []) as Record<string, unknown>[];
  const assignmentIds = assignments.map((a) => a.id as string);
  const assignmentTitleById = new Map<string, string>(assignments.map((a) => [a.id as string, (a.title as string) ?? ""]));

  // Submissions to those assignments.
  const submissions = assignmentIds.length
    ? (((await supabaseAdmin.from("submissions").select("assignment_id, student_id, status, score, feedback, submitted_at, graded_at").in("assignment_id", assignmentIds).order("submitted_at", { ascending: true })).data) ?? [])
    : [];

  // Adab, materials, mutaba'ah owned by teacher.
  const { data: adab } = await supabaseAdmin
    .from("adab_scores").select("student_id, class_id, subject, score, updated_at").eq("teacher_id", teacherId);
  const { data: materials } = await supabaseAdmin
    .from("materials").select("class_id, subject, title, description, created_at").eq("teacher_id", teacherId).order("created_at", { ascending: true });
  const { data: mutabaah } = await supabaseAdmin
    .from("tahfidz_mutabaah")
    .select("student_id, class_id, session_date, session_type, setoran_kind, surah, juz, pages_count, tajwid_score, kelancaran_score, fashohah_score, total_score, predikat")
    .eq("teacher_id", teacherId).order("session_date", { ascending: true });

  // Teaching journals & weekly lesson plans (RPP).
  const { data: journals } = await supabaseAdmin
    .from("journals")
    .select("date, class_id, subject, topic, notes, created_at")
    .eq("teacher_id", teacherId).order("date", { ascending: true });
  const { data: lessonPlans } = await supabaseAdmin
    .from("lesson_plans")
    .select("week_label, class_id, subject, start_date, end_date, objectives, materials, methods, media, assessment, notes, created_at")
    .eq("teacher_id", teacherId).order("start_date", { ascending: true });

  // Announcements, events, question bank, badges earned by enrolled students.
  const { data: announcements } = await supabaseAdmin
    .from("announcements")
    .select("class_id, title, body, pinned, created_at")
    .eq("teacher_id", teacherId).order("created_at", { ascending: false });
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("class_id, title, description, location, start_at, end_at, quiz_link, game_link, created_at")
    .eq("teacher_id", teacherId).order("start_at", { ascending: true });
  const { data: bank } = await supabaseAdmin
    .from("question_bank")
    .select("subject, topic, question, type, answer, difficulty, grade_level, created_at")
    .eq("teacher_id", teacherId).order("created_at", { ascending: false });
  const { data: userBadges } = studentIds.length
    ? await supabaseAdmin
        .from("user_badges")
        .select("user_id, earned_at, badges(name, description, icon, xp_requirement)")
        .in("user_id", studentIds)
        .order("earned_at", { ascending: false })
    : { data: [] as any[] };


  const cName = (id: unknown) => classNameById.get(id as string) || cell(id);

  const tabs: Tabs = {};

  tabs["Kelas"] = [
    ["Nama Kelas", "Kode", "Mata Pelajaran", "Tahun Ajaran", "Dibuat"],
    ...classes.map((c) => [
      cell(c.name),
      cell(c.code),
      Array.isArray(c.subjects) ? (c.subjects as string[]).join(", ") : cell(c.subject),
      cell(c.academic_year),
      cell(c.created_at),
    ]),
  ];

  tabs["Siswa"] = [
    ["NIS", "Nama Lengkap", "Username", "Kelas Terdaftar", "Kelas (Profil)", "Jenis Kelamin", "Tanggal Lahir", "Hobi", "Karakter", "XP", "Level", "Koin", "Bergabung"],
    ...profiles.map((p: any) => {
      const priv = privateById.get(p.id) ?? {};
      const primary = primaryClassByStudent.get(p.id);
      return [
        cell(priv.school_id_number),
        cell(p.full_name),
        cell(p.username),
        primary ? cName(primary) : "",
        cell(p.class_name),
        cell(priv.gender),
        cell(priv.birthdate),
        cell(priv.hobby),
        cell(p.character_key),
        cell(p.xp),
        cell(p.level),
        cell(p.coins),
        cell(p.created_at),
      ];
    }),
  ];

  const sMeta = (id: string) => {
    const nis = studentNisById.get(id) ?? "";
    const name = studentNameById.get(id) ?? id;
    return { nis, name };
  };

  tabs["Presensi"] = [
    ["Tanggal", "Kelas", "NIS", "Nama Siswa", "Status", "Catatan"],
    ...attendance.map((a: any) => {
      const m = sMeta(a.student_id);
      return [cell(a.date), cName(a.class_id), m.nis, m.name, cell(a.status), cell(a.note)];
    }),
  ];

  // Accumulated attendance score per (class, student).
  const attAgg = new Map<string, { classId: string; studentId: string; counts: Record<AttStatus, number>; total: number; weighted: number }>();
  for (const a of attendance as any[]) {
    const key = `${a.class_id}::${a.student_id}`;
    let rec = attAgg.get(key);
    if (!rec) {
      rec = { classId: a.class_id, studentId: a.student_id, counts: { hadir: 0, izin: 0, sakit: 0, alpa: 0 }, total: 0, weighted: 0 };
      attAgg.set(key, rec);
    }
    const st = (a.status as AttStatus) in weights ? (a.status as AttStatus) : "alpa";
    rec.counts[st] += 1;
    rec.total += 1;
    rec.weighted += weights[st] ?? 0;
  }
  tabs["Nilai Kehadiran"] = [
    ["Kelas", "NIS", "Nama Siswa", "Hadir", "Izin", "Sakit", "Alpa", "Total Pertemuan", "Nilai Kehadiran (0-100)"],
    ...Array.from(attAgg.values())
      .map((r) => ({ ...r, score: r.total > 0 ? Math.round(r.weighted / r.total) : 0 }))
      .sort((a, b) => cName(a.classId).localeCompare(cName(b.classId)) || (studentNameById.get(a.studentId) ?? "").localeCompare(studentNameById.get(b.studentId) ?? ""))
      .map((r) => {
        const m = sMeta(r.studentId);
        return [cName(r.classId), m.nis, m.name, String(r.counts.hadir), String(r.counts.izin), String(r.counts.sakit), String(r.counts.alpa), String(r.total), String(r.score)];
      }),
  ];

  tabs["Tugas"] = [
    ["Judul", "Kelas", "Mata Pelajaran", "Jenis", "Halaqoh", "Nilai Maks", "Batas Waktu", "Dibuat"],
    ...assignments.map((a) => [cell(a.title), cName(a.class_id), cell(a.subject), cell(a.exam_type), cell(a.halaqoh_kind), cell(a.max_score), cell(a.due_at), cell(a.created_at)]),
  ];

  tabs["Pengumpulan"] = [
    ["Tugas", "Kelas", "NIS", "Nama Siswa", "Status", "Nilai", "Umpan Balik", "Dikumpulkan", "Dinilai"],
    ...submissions.map((s: any) => {
      const m = sMeta(s.student_id);
      const a = assignments.find((x) => x.id === s.assignment_id) as any;
      return [
        assignmentTitleById.get(s.assignment_id as string) || cell(s.assignment_id),
        a ? cName(a.class_id) : "",
        m.nis, m.name,
        cell(s.status), cell(s.score), cell(s.feedback), cell(s.submitted_at), cell(s.graded_at),
      ];
    }),
  ];

  // Missed assignments: past-deadline, no submission by an enrolled student.
  const submittedKeys = new Set(
    (submissions as any[]).map((s) => `${s.assignment_id}::${s.student_id}`),
  );
  const now = Date.now();
  const enrollmentsByClass = new Map<string, string[]>();
  for (const e of enrollments as any[]) {
    if (!enrollmentsByClass.has(e.class_id)) enrollmentsByClass.set(e.class_id, []);
    enrollmentsByClass.get(e.class_id)!.push(e.student_id);
  }
  const missedRows: string[][] = [];
  for (const a of assignments as any[]) {
    if (!a.due_at || new Date(a.due_at).getTime() > now) continue;
    const rosters = a.class_id ? enrollmentsByClass.get(a.class_id) ?? [] : [];
    for (const sid of rosters) {
      if (submittedKeys.has(`${a.id}::${sid}`)) continue;
      const m = sMeta(sid);
      missedRows.push([
        cell(a.title), cName(a.class_id), cell(a.subject),
        m.nis, m.name, cell(a.due_at),
      ]);
    }
  }
  tabs["Tidak Mengerjakan"] = [
    ["Tugas", "Kelas", "Mata Pelajaran", "NIS", "Nama Siswa", "Batas Waktu (Sudah Lewat)"],
    ...missedRows,
  ];

  tabs["Nilai Adab"] = [
    ["NIS", "Nama Siswa", "Kelas", "Mata Pelajaran", "Nilai", "Diperbarui"],
    ...((adab ?? []) as any[]).map((r) => {
      const m = sMeta(r.student_id);
      return [m.nis, m.name, cName(r.class_id), cell(r.subject), cell(r.score), cell(r.updated_at)];
    }),
  ];

  tabs["Mutaba'ah"] = [
    ["Tanggal", "NIS", "Nama Siswa", "Kelas", "Sesi", "Jenis Setoran", "Surah", "Juz", "Halaman", "Tajwid", "Kelancaran", "Fashohah", "Total", "Predikat"],
    ...((mutabaah ?? []) as any[]).map((m) => {
      const s = sMeta(m.student_id);
      return [
        cell(m.session_date), s.nis, s.name, cName(m.class_id), cell(m.session_type), cell(m.setoran_kind),
        cell(m.surah), cell(m.juz), cell(m.pages_count), cell(m.tajwid_score), cell(m.kelancaran_score), cell(m.fashohah_score), cell(m.total_score), cell(m.predikat),
      ];
    }),
  ];

  tabs["Materi"] = [
    ["Judul", "Kelas", "Mata Pelajaran", "Deskripsi", "Dibuat"],
    ...((materials ?? []) as any[]).map((m) => [cell(m.title), cName(m.class_id), cell(m.subject), cell(m.description), cell(m.created_at)]),
  ];

  tabs["Jurnal"] = [
    ["Tanggal", "Kelas", "Mata Pelajaran", "Topik/Kegiatan", "Catatan", "Dibuat"],
    ...((journals ?? []) as any[]).map((j) => [cell(j.date), cName(j.class_id), cell(j.subject), cell(j.topic), cell(j.notes), cell(j.created_at)]),
  ];

  tabs["RPP Pekanan"] = [
    ["Pekan", "Kelas", "Mata Pelajaran", "Mulai", "Selesai", "Tujuan", "Materi Pokok", "Metode", "Media & Sumber", "Penilaian", "Catatan"],
    ...((lessonPlans ?? []) as any[]).map((r) => [
      cell(r.week_label), cName(r.class_id), cell(r.subject), cell(r.start_date), cell(r.end_date),
      cell(r.objectives), cell(r.materials), cell(r.methods), cell(r.media), cell(r.assessment), cell(r.notes),
    ]),
  ];

  tabs["Pengumuman"] = [
    ["Tanggal", "Kelas", "Judul", "Isi", "Disematkan"],
    ...((announcements ?? []) as any[]).map((a) => [cell(a.created_at), cName(a.class_id), cell(a.title), cell(a.body), a.pinned ? "Ya" : "Tidak"]),
  ];

  tabs["Event Kelas"] = [
    ["Mulai", "Selesai", "Kelas", "Judul", "Deskripsi", "Lokasi", "Link Kuis", "Link Game", "Dibuat"],
    ...((events ?? []) as any[]).map((e) => [
      cell(e.start_at), cell(e.end_at), cName(e.class_id), cell(e.title), cell(e.description),
      cell(e.location), cell(e.quiz_link), cell(e.game_link), cell(e.created_at),
    ]),
  ];

  tabs["Bank Soal"] = [
    ["Mata Pelajaran", "Topik", "Jenjang", "Tingkat", "Tipe", "Pertanyaan", "Jawaban", "Dibuat"],
    ...((bank ?? []) as any[]).map((b) => [
      cell(b.subject), cell(b.topic), cell(b.grade_level), cell(b.difficulty), cell(b.type),
      cell(b.question), cell(b.answer), cell(b.created_at),
    ]),
  ];

  tabs["Badge Siswa"] = [
    ["Diperoleh", "NIS", "Nama Siswa", "Nama Badge", "Deskripsi", "Ikon", "Syarat XP"],
    ...((userBadges ?? []) as any[]).map((ub) => {
      const s = sMeta(ub.user_id);
      const b = ub.badges ?? {};
      return [cell(ub.earned_at), s.nis, s.name, cell(b.name), cell(b.description), cell(b.icon), cell(b.xp_requirement)];
    }),
  ];

  return tabs;
}

function clamp(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export type SyncResult = { url: string; spreadsheetId: string; tables: number; syncedAt: string };

/**
 * Mirror a single teacher's data into their own persistent spreadsheet,
 * creating it (titled with their name + email) on first run.
 */
export async function runSheetSyncForTeacher(teacherId: string): Promise<SyncResult> {
  const headers = gatewayHeaders();

  const [{ data: profile }, email] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", teacherId).maybeSingle(),
    getTeacherEmail(teacherId),
  ]);
  const teacherName = (profile as { full_name?: string } | null)?.full_name || "Guru";
  const title = `Data EduQuest · ${teacherName}${email ? ` (${email})` : ""}`;

  // Resolve (or create) this teacher's persistent spreadsheet.
  const { data: state } = await supabaseAdmin
    .from("teacher_sheet_sync").select("spreadsheet_id, spreadsheet_url").eq("teacher_id", teacherId).maybeSingle();
  let spreadsheetId = (state as { spreadsheet_id?: string } | null)?.spreadsheet_id ?? null;
  let spreadsheetUrl = (state as { spreadsheet_url?: string } | null)?.spreadsheet_url ?? null;

  if (spreadsheetId) {
    const tabs = await getExistingTabs(spreadsheetId, headers);
    if (tabs === null) {
      spreadsheetId = null; // deleted — recreate
      spreadsheetUrl = null;
    } else {
      await addMissingTabs(spreadsheetId, tabs, headers);
    }
  }

  if (!spreadsheetId) {
    const created = await createSpreadsheet(title, headers);
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
  }

  try {
    const tabs = await buildTeacherTabs(teacherId);
    for (const tab of TAB_TITLES) {
      await writeTab(spreadsheetId, tab, tabs[tab] ?? [[""]], headers);
    }

    const syncedAt = new Date().toISOString();
    await supabaseAdmin.from("teacher_sheet_sync").upsert({
      teacher_id: teacherId,
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      last_synced_at: syncedAt,
      last_status: "ok",
    });
    return { url: spreadsheetUrl ?? "", spreadsheetId, tables: TAB_TITLES.length, syncedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync gagal";
    await supabaseAdmin.from("teacher_sheet_sync").upsert({
      teacher_id: teacherId,
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      last_synced_at: new Date().toISOString(),
      last_status: `error: ${message.slice(0, 200)}`,
    });
    throw e;
  }
}

/** Cron entry point: sync every teacher into their own spreadsheet. */
export async function runAllTeacherSheetSync(): Promise<{ teachers: number; ok: number; failed: number }> {
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "guru");
  const teacherIds = Array.from(new Set(((roles ?? []) as any[]).map((r) => r.user_id as string)));
  let ok = 0;
  let failed = 0;
  for (const id of teacherIds) {
    try {
      await runSheetSyncForTeacher(id);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.error(`[sheets-sync] teacher ${id} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return { teachers: teacherIds.length, ok, failed };
}
