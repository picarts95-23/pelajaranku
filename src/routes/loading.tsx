import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/loading")({
  head: () => ({ meta: [{ title: "Loading… · EduQuest RPG" }] }),
  component: LoadingPortal,
});

function LoadingPortal() {
  const { role, loading, session } = useAuth();
  const navigate = useNavigate();
  const { t } = useLang();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (role) {
      const timer = setTimeout(() => {
        navigate({ to: role === "guru" ? "/dashboard/guru" : "/dashboard/siswa" });
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [role, loading, session, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-sunset px-6">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="mx-auto grid size-24 place-items-center rounded-full border-4 border-white/40 bg-gradient-magic shadow-glow"
        >
          <Wand2 className="size-10 text-primary-foreground" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 font-display text-2xl font-bold text-foreground"
        >
          {t("loadingPortal")}
        </motion.h2>
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
      </div>
    </div>
  );
}
