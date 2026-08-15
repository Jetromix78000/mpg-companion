import { useContext } from "react";
import { FavoritesContext } from "./favorites-context";

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites doit être utilisé dans un <FavoritesProvider>");
  return context;
}
