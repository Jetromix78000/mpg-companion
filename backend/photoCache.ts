/** Photos des joueurs suivis, retenues depuis /api/injuries pour les réutiliser dans /api/transfers. */
const photos = new Map<string, string>();

export function rememberPhoto(surname: string, photo: string): void {
  if (photo) photos.set(surname, photo);
}

export function getPhoto(surname: string): string {
  return photos.get(surname) ?? "";
}
