import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth-context";
import { LangContext, translations, type Key, type Lang } from "../lib/i18n";
import { useState, useMemo } from "react";
import { Toaster } from "../components/ui/sonner";
import { registerServiceWorker } from "../lib/register-sw";
import { OfflineOnboarding } from "../components/offline-onboarding";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#b83a6b" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Pelajaranku" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Pelajaranku — Pertualangan Mencari Ilmu" },
      { name: "description", content: "Aplikasi pembelajaran interaktif bernuansa islami untuk guru dan siswi. Naik tingkat ilmu, tunaikan misi, dan kuasai pelajaran." },
      { name: "author", content: "Pelajaranku" },
      { property: "og:title", content: "Pelajaranku — Pertualangan Mencari Ilmu" },
      { property: "og:description", content: "Aplikasi pembelajaran interaktif bernuansa islami untuk guru dan siswi. Naik tingkat ilmu, tunaikan misi, dan kuasai pelajaran." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Pelajaranku — Pertualangan Mencari Ilmu" },
      { name: "twitter:description", content: "Aplikasi pembelajaran interaktif bernuansa islami untuk guru dan siswi. Naik tingkat ilmu, tunaikan misi, dan kuasai pelajaran." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4ce8fa9d-e9e8-4101-9d3d-f9a83216e4f1" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4ce8fa9d-e9e8-4101-9d3d-f9a83216e4f1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "id";
    const stored = window.localStorage.getItem("eduquest:lang") as Lang | null;
    return stored === "id" || stored === "en" || stored === "ar" ? stored : "id";
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("eduquest:lang", l);
  };
  const t = useMemo(() => (k: Key) => translations[k][lang], [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LangContext.Provider value={{ lang, setLang, t }}>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </LangContext.Provider>
    </QueryClientProvider>
  );
}

