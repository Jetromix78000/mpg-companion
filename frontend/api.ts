/**
 * Client HTTP de l'application : un seul endroit qui sait parler à l'API Express.
 * Tous les reducers passent par ici, aucun `fetch` nu dans les vues.
 *
 * Ce fichier ne connaît AUCUN mock : c'est un client HTTP générique, il ne sait pas
 * ce qu'il y a derrière la route. Les données mock (joueurs, favoris, etc.) vivent
 * uniquement côté backend, en tête de chaque router (`MOCK_PLAYERS`, `MOCK_DASHBOARD`...).
 */

/** Appelle le serveur Express en ajoutant le token courant, et remonte le message d'erreur du serveur. */
export function callApi<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  return fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
    .catch(() => {
      throw new Error("Connexion au serveur impossible");
    })
    .then((response) => {
      // 204 : réponse sans corps, il n'y a rien à analyser.
      if (response.status === 204) return undefined as T;

      return response
        .json()
        .catch(() => ({}))
        .then((data: Record<string, unknown>) => {
          if (!response.ok) {
            throw new Error(typeof data.error === "string" ? data.error : "Opération impossible");
          }
          return data as T;
        });
    });
}

/** Message lisible à afficher pour une erreur remontée par un thunk. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Opération impossible";
}
