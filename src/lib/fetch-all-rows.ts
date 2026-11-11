type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** PostgREST caps a response page; keep fetching until the source is exhausted. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  label: string,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`Gagal membaca ${label}: ${error.message}`);
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
