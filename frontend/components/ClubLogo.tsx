import React, { useState } from "react";
import { Shield } from "lucide-react";

interface ClubLogoProps {
  src?: string;
  name: string;
  className?: string;
}

/**
 * L'utilisateur voit un club sans écusson ou dont l'image casse.
 * Un blason générique s'affiche à la place.
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
