import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cache-hemat defaults: kurangi jumlah panggilan API/Supabase
  // - staleTime 5 menit: data dianggap segar 5 menit → tidak refetch saat
  //   remount komponen, ganti tab, atau navigasi bolak-balik.
  // - gcTime 30 menit: data lama tetap di memori supaya navigasi kembali
  //   ke halaman yang sama instan (tanpa network).
  // - refetchOnWindowFocus/Reconnect off: hindari refetch masal setiap kali
  //   HP siswa keluar-masuk aplikasi atau jaringan naik-turun.
  // - retry 1: gagal jaringan tidak menggandakan biaya panggilan.
  // Invalidation eksplisit di mutation onSuccess tetap bekerja seperti biasa.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
