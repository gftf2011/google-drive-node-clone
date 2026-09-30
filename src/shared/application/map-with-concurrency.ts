/**
 * Mapeia `items` com no máximo `limit` execuções simultâneas, preservando a
 * ordem do resultado. Evita disparar N chamadas caras (ex.: LLM) de uma vez —
 * um controle de vazão simples para operações de I/O em lote.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        return;
      }
      results[index] = await fn(items[index]!, index);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
