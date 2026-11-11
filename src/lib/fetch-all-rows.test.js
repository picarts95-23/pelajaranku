import { describe, expect, it } from "bun:test";
import { fetchAllRows } from "./fetch-all-rows";

describe("fetchAllRows", () => {
  it("membaca seluruh 1.220 presensi melewati batas 1.000 baris", async () => {
    const source = Array.from({ length: 1220 }, (_, i) => ({ id: i + 1 }));
    const calls = [];
    const result = await fetchAllRows((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({ data: source.slice(from, to + 1), error: null });
    }, "presensi");
    expect(result).toHaveLength(1220);
    expect(result.at(-1)).toEqual({ id: 1220 });
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("menggagalkan backup saat satu halaman gagal dibaca", async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: { message: "izin ditolak" } }), "presensi"))
      .rejects.toThrow("Gagal membaca presensi: izin ditolak");
  });
});
