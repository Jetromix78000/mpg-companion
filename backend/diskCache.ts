import fs from "fs/promises";
import path from "path";

/**
 * Cache disque générique : plan Free API Football = 100 req/jour, et tsx
 * redémarre à chaque save, donc un cache mémoire seul viderait le quota en
 * quelques restarts. Sert le cache tel quel (même périmé) pendant qu'un
 * rafraîchissement tourne en arrière-plan — une seule fois à la fois.
 *
 * @param filename Nom du fichier écrit dans `.cache/` (ex: "transfers.json").
 * @param ttlMs Durée de vie du cache en millisecondes avant de le considérer périmé.
 * @param fetcher Fonction qui va chercher les données fraîches (l'appel API réel).
 *   Appelée uniquement quand le cache est vide ou périmé.
 * @returns `{ get, refresh }` — `get()` lit le cache disque, `refresh()` relance `fetcher`
 *   et réécrit le fichier.
 */
export function createDiskCache<T>(filename: string, ttlMs: number, fetcher: () => Promise<T>) {
  const file = path.join(process.cwd(), ".cache", filename);
  let refreshInFlight: Promise<T> | null = null;

  async function readCache(): Promise<{ fetchedAt: number; data: T } | null> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as { fetchedAt: number; data: T };
    } catch {
      return null;
    }
  }

  async function writeCache(data: T): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ fetchedAt: Date.now(), data }));
  }

  function refresh(): Promise<T> {
    refreshInFlight ??= fetcher()
      .then(async (data) => {
        await writeCache(data);
        return data;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  }

  /** null si jamais rempli. `stale: true` si le TTL est dépassé (sert quand même la donnée). */
  async function get(): Promise<{ data: T; stale: boolean } | null> {
    const cached = await readCache();
    if (!cached) return null;

    return { data: cached.data, stale: Date.now() - cached.fetchedAt >= ttlMs };
  }

  return { get, refresh };
}
