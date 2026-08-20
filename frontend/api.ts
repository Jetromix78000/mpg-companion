/**
 * Client HTTP de l'application : un seul endroit qui sait parler à l'API Express.
 * Tous les reducers passent par ici, aucun `fetch` nu dans les vues.
 */

/** Appelle l'API en ajoutant le token courant, et remonte le message d'erreur du serveur. */
export async function callApi<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error("Connexion au serveur impossible");
  }

  // 204 : réponse sans corps, il n'y a rien à analyser.
  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Opération impossible");
  }

  return data as T;
}

/** Message lisible à afficher pour une erreur remontée par un thunk. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Opération impossible";
}
