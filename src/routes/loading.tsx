import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

const searchSchema = z.object({
  role: z.enum(["guru", "siswa"]).optional(),
});

export const Route = createFileRoute("/loading")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Menyiapkan Portal · Pelajaranku" },
      { name: "description", content: "Menyiapkan ruang belajarmu di Pelajaranku. Mohon tunggu sebentar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoadingPortal,
});

function LoadingPortal() {
  const { role, loading, session, user } = useAuth();
  const { role: preferredRole } = Route.useSearch();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    // If the user arrived via a teacher-invite link before signing in, the
    // invite code was parked in localStorage. Redeem it once we have a session
    // so the invitee lands on the teacher dashboard automatically.
    try {
      const pending = typeof window !== "undefined"
        ? window.localStorage.getItem("pending_teacher_invite")
        : null;
      if (pending) {
        window.localStorage.removeItem("pending_teacher_invite");
        navigate({ to: "/undangan", search: { code: pending } });
        return;
      }
    } catch { /* ignore storage errors */ }
    // The database role (user_roles) is the ONLY source of truth for routing.
    // The role chosen on the login form must never decide the destination,
    // otherwise a teacher could land on the student dashboard and vice-versa.
    if (role) {
      const dest = role === "admin" ? "/admin" : role === "guru" ? "/dashboard/guru" : "/dashboard/siswa";
      const timer = setTimeout(() => {
        navigate({ to: dest });
      }, 1000);
      return () => clearTimeout(timer);
    }
    // Role not loaded yet — wait briefly, then send to verify-role to resolve it
    // authoritatively (it reads user_roles directly and reports mismatches).
    const hint = setTimeout(() => setWaitedTooLong(true), 3000);
    const fallback = setTimeout(() => {
      navigate({ to: "/verify-role", search: { role: preferredRole, auto: true } });
    }, 6000);
    return () => { clearTimeout(hint); clearTimeout(fallback); };
  }, [role, loading, session, user, preferredRole, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="mx-auto grid size-24 place-items-center rounded-full border-4 border-white/40 bg-gradient-magic shadow-glow"
        >
          <Compass className="size-10 text-primary-foreground" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 font-display text-2xl font-bold text-foreground"
        >
          {t("loadingPortal")}
        </motion.h1>
        {preferredRole && (
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "id" ? "Membuka gerbang " : "Opening the "}
            <span className="font-semibold text-foreground">
              {preferredRole === "guru" ? (lang === "id" ? "Guru" : "Teacher") : (lang === "id" ? "Siswi" : "Student")}
            </span>
            {lang === "id" ? "…" : " gate…"}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              className="size-2 rounded-full bg-primary"
            />
          ))}
        </div>
        {waitedTooLong && (
          <p className="mt-6 max-w-sm text-xs text-muted-foreground">
            {lang === "id"
              ? "Memuat lebih lama dari biasanya. Pastikan akunmu sudah memiliki peran."
              : "Taking longer than usual. Make sure your account has a role assigned."}
          </p>
        )}
      </div>
    </div>
  );
}
