import React, { useState, useRef, useEffect, useMemo } from "react";
import { Player } from "../types";
import { MOCK_PLAYERS } from "../data";
import { POPULAR_PLAYERS, SuggestionPlayer } from "../popularPlayers";
import { PlayerAvatar } from "./PlayerAvatar";
import { Search, ArrowUpRight, ChevronLeft, ChevronRight, AlertCircle, Sparkles, Trophy } from "lucide-react";
import { matchPlayer, normalizeText } from "../utils/search";

interface DashboardViewProps {
  onSelectPlayer: (player: Player) => void;
  onSearchQuery: (query: string) => void;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

export default function DashboardView({
  onSelectPlayer,
  onSearchQuery,
  onShowToast,
}: DashboardViewProps) {
  const [heroSearch, setHeroSearch] = useState("");
  const [showHeroSuggestions, setShowHeroSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const heroSearchRef = useRef<HTMLDivElement>(null);

  // De-duplicate suggestions to keep searches optimal and clean
  const ALL_SUGGESTION_SEEDS = useMemo(() => {
    const seeds: SuggestionPlayer[] = [];
    const seenIds = new Set<string>();

    MOCK_PLAYERS.forEach(p => {
      seenIds.add(p.id);
      seeds.push({
        id: p.id,
        name: p.name,
        fullName: p.fullName,
        team: p.team,
        positionLong: p.positionLong,
        position: p.position,
        form: p.form,
        avatarUrl: p.avatarUrl
      });
    });

    POPULAR_PLAYERS.forEach(p => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        seeds.push(p);
      }
    });

    return seeds;
  }, []);

  // Filter players based on optimized diacritics-insensitive matching helper
  const filteredSuggestions = useMemo(() => {
    if (!heroSearch.trim()) return [];
    return ALL_SUGGESTION_SEEDS.filter((p) => matchPlayer(p, heroSearch));
  }, [heroSearch, ALL_SUGGESTION_SEEDS]);

  // Reset selected active suggestion when suggestions search results change
  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [heroSearch]);

  // Find candidate for inline completion hint
  const bestMatch = filteredSuggestions[0];
  const inlineCompletion = useMemo(() => {
    if (!bestMatch || !heroSearch) return { text: "", show: false };

    const normQuery = normalizeText(heroSearch);
    const normFull = normalizeText(bestMatch.fullName);
    const normLast = normalizeText(bestMatch.name);

    // If query matches the start of the full name
    if (normFull.startsWith(normQuery)) {
      return {
        text: bestMatch.fullName.slice(heroSearch.length),
        show: true
      };
    }
    // If query matches the start of the last name (e.g., "mbappe" matches "Kylian Mbappé")
    else if (normLast && normLast.startsWith(normQuery)) {
      const lastIndex = bestMatch.fullName.toLowerCase().lastIndexOf(bestMatch.name.toLowerCase());
      if (lastIndex !== -1) {
        return {
          text: bestMatch.fullName.slice(lastIndex + heroSearch.length),
          show: true
        };
      }
    }
    return { text: "", show: false };
  }, [bestMatch, heroSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (heroSearchRef.current && !heroSearchRef.current.contains(event.target as Node)) {
        setShowHeroSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (player: SuggestionPlayer) => {
    setHeroSearch("");
    setShowHeroSuggestions(false);
    
    const isFullPlayer = MOCK_PLAYERS.some(p => p.id === player.id);
    if (isFullPlayer) {
      const fullPlayer = MOCK_PLAYERS.find(p => p.id === player.id)!;
      onSelectPlayer(fullPlayer);
    } else {
      onSearchQuery(player.fullName);
    }
  };

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredSuggestions.length > 0) {
      handleSuggestionClick(filteredSuggestions[activeSuggestionIndex]);
    } else if (heroSearch.trim()) {
      onSearchQuery(heroSearch);
      setHeroSearch("");
      setShowHeroSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowHeroSuggestions(true);
        setActiveSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowHeroSuggestions(true);
        setActiveSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      }
    } else if (e.key === "Escape") {
      setShowHeroSuggestions(false);
    } else if (e.key === "Tab" || e.key === "ArrowRight") {
      if (inlineCompletion.show && inlineCompletion.text) {
        e.preventDefault();
        // Complete the search value with the full name of the best match
        setHeroSearch(bestMatch.fullName);
        onShowToast(`Complété : ${bestMatch.fullName}`, "success");
      }
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="dashboard-view-panel">
      {/* Hero & Universal Search */}
      <section
        className="relative h-[280px] md:h-[340px] rounded-2xl flex flex-col justify-center items-center px-4 md:px-8 border border-white/5 shadow-2xl"
        style={{
          background: "linear-gradient(rgba(10, 10, 10, 0.75), rgba(10, 10, 10, 0.95))"
        }}
      >
        {/* Background Image with stadium brightness overlay — clipped independently */}
        <div className="absolute inset-0 z-0 rounded-2xl overflow-hidden opacity-45 mix-blend-overlay">
          <img
            alt="Stadium de football futuriste"
            className="w-full h-full object-cover brightness-[0.4] saturate-[1.2]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB92JsKehkm6Gkc9LxdZYTrGIUc2dS7C8sWC84jYCysK1MYfEOsZQGeOm5TxL1nDIdz0HX0RZy9DZgn18wnWJHAg83JnPGKAeAM49odu8YpHc21IlgjSvDfBMNZE_xZzSmpcWySvwJ4EYOjpgvc9R-cZDO8qtxhitCu_ILLsNUagYq8b96BYqXPxNmpaXJDWdL6eatF7mfimjs0yc8x6heQFUjzHW7EGs8KEntNGcY4Fay8QDpvujRDHFjNyOpb-J1gARj9azJICW_I"
            referrerPolicy="no-referrer"
          />
        </div>


        <div className="relative z-10 w-full max-w-2xl text-center space-y-4 px-2">
          <h1 className="font-display-lg text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none drop-shadow-sm">
            Analysez en temps réel
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base font-medium max-w-md mx-auto">
            Surveillez les pépites, anticipez les blessures, optimisez votre équipe.
          </p>

          <div className="relative w-full" ref={heroSearchRef}>
            <form onSubmit={handleHeroSearchSubmit}>
              <div className="w-full h-14 md:h-16 bg-surface-glass border border-white/10 rounded-full flex items-center relative group backdrop-blur-xl focus-within:ring-2 focus-within:ring-primary-container/40 focus-within:border-primary-container/30 transition-all shadow-inner">
                <Search className="absolute left-5 text-on-surface-variant group-focus-within:text-primary-container transition-colors w-5 h-5 cursor-pointer z-20" />
                
                {/* Autocomplete Ghost Text */}
                {inlineCompletion.show && inlineCompletion.text && (
                  <div className="absolute left-14 text-sm md:text-base text-white/25 pointer-events-none select-none font-sans font-medium whitespace-pre z-10 flex items-center">
                    <span className="opacity-0">{heroSearch}</span>
                    <span>{inlineCompletion.text}</span>
                  </div>
                )}

                <input
                  className="w-full h-full pl-14 pr-24 bg-transparent text-white text-sm md:text-base placeholder-muted-text focus:outline-none outline-none relative z-10"
                  value={heroSearch}
                  onChange={(e) => {
                    setHeroSearch(e.target.value);
                    setShowHeroSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowHeroSuggestions(true)}
                  placeholder="Rechercher un joueur (Mbappé, Vinícius, Haaland...)"
                  type="text"
                  autoComplete="off"
                />

                {/* Tab complete badge */}
                {inlineCompletion.show && inlineCompletion.text && (
                  <span className="absolute right-5 text-[9px] bg-white/10 text-primary-container px-2 py-1 rounded-md font-mono font-bold animate-pulse z-20 pointer-events-none uppercase tracking-wider">
                    Tab ➔
                  </span>
                )}
              </div>
            </form>

            {/* Instant suggestions dropdown */}
            {showHeroSuggestions && heroSearch.trim() && (
              <div className="absolute top-full left-0 w-full mt-3 bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60] backdrop-blur-xl animate-fadeIn">
                <div className="py-2 text-left">
                  <p className="px-5 py-2 text-[11px] font-bold text-muted-text uppercase tracking-widest border-b border-white/5 flex justify-between items-center">
                    <span>Résultats Instantanés ({filteredSuggestions.length})</span>
                    <span className="text-[9px] font-medium text-white/40 font-mono normal-case">↑↓ pour naviguer • Entrée pour sélectionner</span>
                  </p>
                  {filteredSuggestions.length > 0 ? (
                    <div className="max-h-[320px] overflow-y-auto">
                      {filteredSuggestions.map((player, index) => {
                        const isActive = index === activeSuggestionIndex;
                        return (
                          <div
                            key={player.id}
                            className={`px-5 py-3 cursor-pointer flex items-center gap-4 transition-colors group ${
                              isActive ? "bg-white/10" : "hover:bg-white/5"
                            }`}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            onClick={() => handleSuggestionClick(player)}
                          >
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-surface-container-low">
                              <PlayerAvatar
                                src={player.avatarUrl}
                                name={player.fullName}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold leading-tight transition-colors truncate ${
                                isActive ? "text-primary-container" : "text-on-surface group-hover:text-primary-container"
                              }`}>
                                {player.fullName}
                              </p>
                              <p className="text-xs text-muted-text uppercase tracking-wider mt-0.5 font-medium">
                                {player.team} • {player.positionLong}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold transition-all ${
                                isActive ? "bg-primary-container text-pitch-dark" : "bg-primary-container/10 text-primary-container"
                              }`}>
                                {player.form} Forme
                              </span>
                              <ArrowUpRight className={`w-4 h-4 transition-colors shrink-0 ${
                                isActive ? "text-primary-container translate-x-0.5 -translate-y-0.5" : "text-muted-text group-hover:text-primary-container"
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-center">
                      <p className="text-xs text-muted-text font-medium">
                        Aucun joueur correspondant trouvé parmi nos pépites disponibles.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid Layout for Main Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Latest Searches & Hot Players */}
        <section className="lg:col-span-8 space-y-6">
          {/* Latest Searches */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-title-lg tracking-tight text-white flex items-center gap-2">
                <span className="w-1.5 h-5 bg-secondary rounded-full"></span>
                Dernières Recherches
              </h2>
              <span className="text-xs text-muted-text">Mise à jour en continu</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mbappé Card */}
              {MOCK_PLAYERS.slice(0, 2).map((player) => (
                <div
                  key={player.id}
                  className="glass-card rounded-2xl p-4 flex gap-4 hover:bg-surface-container-high transition-all cursor-pointer group hover:-translate-y-1 duration-300 border border-white/5 shadow-lg"
                  onClick={() => onSelectPlayer(player)}
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-container-highest border border-white/5 shrink-0 relative">
                    <PlayerAvatar
                      src={player.avatarUrl}
                      name={player.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm text-primary-container text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {player.position}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <h3 className="font-bold text-white text-base group-hover:text-primary-container transition-colors truncate">
                          {player.name}
                        </h3>
                        <p className="text-xs text-muted-text mt-0.5 font-medium uppercase truncate">
                          {player.team}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-extrabold text-primary-container leading-none">
                          {player.form}
                        </p>
                        <p className="text-[9px] text-muted-text uppercase font-bold tracking-wider mt-0.5">
                          FORME
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-muted-text uppercase font-semibold">
                        <span>Intensité de Forme</span>
                        <span className="text-primary-container">{player.form}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-secondary to-primary-container rounded-full"
                          style={{ width: `${player.form}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hot Players Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold font-title-lg tracking-tight text-white flex items-center gap-2">
                <span className="w-1.5 h-5 bg-primary-container rounded-full animate-pulse"></span>
                Joueurs en Forme (FORME &gt; 80)
              </h2>
              <div className="flex gap-1.5">
                <button
                  className="p-1.5 rounded-full bg-surface-container-high hover:bg-surface-variant hover:text-white transition-colors"
                  onClick={() => onShowToast("Navigation de la liste simulée", "success")}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-full bg-surface-container-high hover:bg-surface-variant hover:text-white transition-colors"
                  onClick={() => onShowToast("Fin de la liste des joueurs", "warning")}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {MOCK_PLAYERS.slice(0, 4).map((player) => (
                <div
                  key={player.id}
                  className="glass-card rounded-2xl p-4 text-center space-y-3 hover:translate-y-[-4px] transition-all duration-300 cursor-pointer group border border-white/5 hover:border-primary-container/20 shadow-md hover:shadow-primary-container/5"
                  onClick={() => onSelectPlayer(player)}
                >
                  <div className="w-16 h-16 mx-auto rounded-full ring-2 ring-primary-container/20 overflow-hidden relative shadow-inner bg-surface-container-low">
                    <PlayerAvatar
                      src={player.avatarUrl}
                      name={player.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-white truncate text-sm group-hover:text-primary-container transition-colors">
                      {player.fullName}
                    </p>
                    <p className="text-muted-text text-[11px] font-semibold mt-0.5">
                      {player.team} • <span className="text-primary-container font-bold">{player.form}</span> FORME
                    </p>
                  </div>

                  <div className="flex justify-center gap-4 text-[11px] font-mono border-t border-white/5 pt-2">
                    <div>
                      <span className="text-white font-bold">{player.note}</span>{" "}
                      <span className="text-muted-text text-[9px] block">NOTE</span>
                    </div>
                    <div className="w-px bg-white/10 h-6 my-auto"></div>
                    <div>
                      <span className="text-primary-container font-bold">{player.goals}</span>{" "}
                      <span className="text-muted-text text-[9px] block">BUTS</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column - Critical Alerts & Market Sentiment */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Critical Alerts */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold font-title-lg tracking-tight text-white flex items-center gap-2">
              <span className="w-1.5 h-5 bg-stat-decrease rounded-full"></span>
              Alertes Critiques
            </h2>

            <div className="glass-card rounded-2xl border-l-4 border-stat-decrease overflow-hidden shadow-lg border border-white/5">
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-stat-decrease font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-stat-decrease fill-stat-decrease/10 animate-bounce" />
                  Alerte Blessure Majeure
                </div>
                <h3 className="font-bold text-white text-lg tracking-tight leading-snug">
                  Mbappé incertain pour le prochain match
                </h3>
                <p className="text-on-surface-variant text-xs leading-relaxed font-medium">
                  Les rapports du staff médical suggèrent une légère fatigue musculaire après l'enchaînement de matchs. Probabilité de titularisation estimée à seulement <span className="text-stat-decrease font-bold text-sm">35%</span>.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 px-4 py-2.5 bg-stat-decrease/20 text-stat-decrease hover:bg-stat-decrease/30 active:scale-95 text-xs font-bold rounded-xl transition-all border border-stat-decrease/30"
                    onClick={() => onShowToast("Simulation de transfert out: Mbappé placé sur la liste des ventes", "warning")}
                  >
                    Vendre d'urgence
                  </button>
                  <button
                    className="flex-1 px-4 py-2.5 bg-surface-container-high text-white hover:bg-surface-variant hover:text-white active:scale-95 text-xs font-bold rounded-xl transition-all border border-white/5"
                    onClick={() => {
                      const mbappe = MOCK_PLAYERS.find(p => p.id === "mbappe");
                      if (mbappe) onSelectPlayer(mbappe);
                    }}
                  >
                    Comparer remplaçants
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Market Sentiment */}
          <div className="space-y-3">
            <div className="glass-card rounded-2xl p-5 space-y-4 border border-white/5 shadow-md">
              <h3 className="font-bold text-sm text-muted-text uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center justify-between">
                Tendance du Marché
                <Trophy className="w-4 h-4 text-secondary" />
              </h3>

              <div className="space-y-4 font-medium">
                <div className="flex gap-3 items-start group cursor-pointer" onClick={() => onShowToast("Analyse détaillée de Kane bientôt disponible", "success")}>
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary-container shadow-[0_0_8px_#00FF87] shrink-0"></div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-white group-hover:text-primary-container transition-colors">
                      La valeur de Harry Kane devrait augmenter de 15%
                    </p>
                    <p className="text-[10px] text-muted-text font-semibold uppercase">
                      il y a 2 heures • Transfert rumeur
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start group cursor-pointer" onClick={() => onShowToast("Fin du mercato rumeur simulée dans 48h", "warning")}>
                  <div className="w-2 h-2 mt-2 rounded-full bg-muted-text shrink-0"></div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-white group-hover:text-white transition-colors">
                      Fermeture du mercato d'été dans 48 heures
                    </p>
                    <p className="text-[10px] text-muted-text font-semibold uppercase">
                      il y a 5 heures • Officiel
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start group cursor-pointer" onClick={() => onShowToast("Moyenne de buts de la ligue : 2.1 par match", "warning")}>
                  <div className="w-2 h-2 mt-2 rounded-full bg-stat-decrease shadow-[0_0_8px_#F06292] shrink-0"></div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-white group-hover:text-stat-decrease transition-colors">
                      Moyenne de buts de la ligue en baisse cette semaine
                    </p>
                    <p className="text-[10px] text-muted-text font-semibold uppercase">
                      Hier • Statistique MPG
                    </p>
                  </div>
                </div>
              </div>

              <button
                className="w-full py-2.5 bg-surface-container-high hover:bg-surface-variant text-white text-xs font-bold rounded-xl transition-all border border-white/5"
                onClick={() => onShowToast("Aucune autre news disponible pour le moment", "success")}
              >
                Voir toutes les news
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
