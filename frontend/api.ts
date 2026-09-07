/**
 * L'utilisateur se connecte ou cherche un joueur.
 * La requête part vers l'API Express avec son token, si présent.
 */
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

/**
 * L'utilisateur déclenche une action qui échoue (connexion, recherche...).
 * Un message lisible est renvoyé pour l'afficher dans un toast.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Opération impossible";
}
