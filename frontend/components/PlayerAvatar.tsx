import React, { useState } from "react";

interface PlayerAvatarProps {
  src?: string;
  name: string;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  src,
  name,
  className = "w-12 h-12 rounded-full",
}) => {
  const [hasError, setHasError] = useState(false);

  // Get initials (e.g., "Kylian Mbappé" -> "KM", "Saka" -> "S")
  const getInitials = (fullName: string) => {
    const cleanName = fullName.trim();
    if (!cleanName) return "?";
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.slice(0, Math.min(2, cleanName.length)).toUpperCase();
  };

  const getProxiedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover&a=top`;
    }
    return url;
  };

  const proxiedSrc = src ? getProxiedUrl(src) : "";

  if (hasError || !proxiedSrc) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-container/20 to-secondary/30 border border-white/10 text-primary-container font-mono font-black select-none text-sm`}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={proxiedSrc}
      alt={`Portrait de ${name}`}
      className={`${className} object-cover`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};
