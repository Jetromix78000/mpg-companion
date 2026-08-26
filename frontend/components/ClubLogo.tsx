import React, { useState } from "react";
import { Shield } from "lucide-react";

interface ClubLogoProps {
  src?: string;
  name: string;
  className?: string;
}

/**
 * Écusson de club, avec repli sur un blason générique.
 *
 * Deux cas de repli, tous deux fréquents : API Football renvoie parfois un club
 * sans écusson (`logo: null`), et une URL existante peut casser. Sans ce repli,
 * la ligne de transfert afficherait un carré vide au milieu de « X ➔ Y ».
 */
export const ClubLogo: React.FC<ClubLogoProps> = ({ src, name, className = "w-4 h-4" }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <Shield
        className={`${className} shrink-0 text-muted-text/60`}
        aria-label={`Écusson indisponible (${name})`}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={`Écusson ${name}`}
      title={name}
      className={`${className} shrink-0 object-contain`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};
