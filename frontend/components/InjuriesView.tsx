import React, { useState, useMemo } from "react";
import { InjuryItem, InjuryStatus, Player } from "../types";
import { MOCK_INJURIES, MOCK_CLUBS_BY_LEAGUE, MOCK_PLAYERS } from "../data";
import { PlayerAvatar } from "./PlayerAvatar";
import { HeartCrack, Calendar, Search, Globe } from "lucide-react";

interface InjuriesViewProps {
  onSelectPlayer: (player: Player) => void;
  onShowToast: (message: string, type?: "success" | "warning") => void;
  globalTeamFilter?: string | null;
}

export default function InjuriesView({
  onSelectPlayer,
  onShowToast,
  globalTeamFilter,
}: InjuriesViewProps) {
  const [selectedLeague, setSelectedLeague] = useState("Tous les championnats");
  const [selectedClub, setSelectedClub] = useState("Tous les clubs");
  const [activeStatusFilter, setActiveStatusFilter] = useState<
    "Tous" | "Absent" | "Reprise" | "Tous"
  >("Tous");
  const [searchQuery, setSearchQuery] = useState("");

  // Count of injuries per league for display in the league filter cards
  const leagueCounts = useMemo(() => {
    const counts: Record<string, number> = {
      "Tous les championnats": MOCK_INJURIES.length,
      "Premier League": MOCK_INJURIES.filter((i) => i.league === "Premier League").length,
      "Ligue 1 McDonald's": MOCK_INJURIES.filter(
        (i) =>
          i.league.toLowerCase().includes("ligue 1") ||
          i.league.toLowerCase().includes("macdonald") ||
          i.league.toLowerCase().includes("mcdonald"),
      ).length,
      "La Liga": MOCK_INJURIES.filter((i) => i.league === "La Liga").length,
      "Serie A": MOCK_INJURIES.filter((i) => i.league === "Serie A").length,
    };
    return counts;
  }, []);

  // Cascading club selections based on selected league
  const availableClubs = useMemo(() => {
    let key = selectedLeague;
    if (
      key.toLowerCase().includes("ligue 1") ||
      key.toLowerCase().includes("macdonald") ||
      key.toLowerCase().includes("mcdonald")
    ) {
      key = "Ligue 1 McDonald's";
    }
    return MOCK_CLUBS_BY_LEAGUE[key] ||
      MOCK_CLUBS_BY_LEAGUE["Ligue 1"] || ["Tous les clubs"];
  }, [selectedLeague]);

  // Reset le club sélectionné s'il n'est plus disponible (ajustement pendant le render,
  // pas dans un effect, pour éviter un cycle de rendu supplémentaire).
  const [prevAvailableClubs, setPrevAvailableClubs] = useState(availableClubs);
  if (availableClubs !== prevAvailableClubs) {
    setPrevAvailableClubs(availableClubs);
    if (!availableClubs.includes(selectedClub)) {
      setSelectedClub("Tous les clubs");
    }
  }

  // Filters the mock injuries database
  const filteredInjuries = useMemo(() => {
    return MOCK_INJURIES.filter((injury) => {
      // 1. Global Team Filter (highest priority)
      if (globalTeamFilter) {
        const lowerFilter = globalTeamFilter.toLowerCase();
        const matchesClub = injury.clubName.toLowerCase().includes(lowerFilter);
        const matchesPlayerName = injury.playerName.toLowerCase().includes(lowerFilter);
        if (!matchesClub && !matchesPlayerName) return false;
      } else {
        // 1. League Filter
        if (selectedLeague !== "Tous les championnats") {
          const normalizedSelected = selectedLeague.toLowerCase();
          const normalizedInjuryLeague = injury.league.toLowerCase();

          const isLigue1Selected =
            normalizedSelected.includes("ligue 1") ||
            normalizedSelected.includes("macdonald") ||
            normalizedSelected.includes("mcdonald");
          const isLigue1Injury =
            normalizedInjuryLeague.includes("ligue 1") ||
            normalizedInjuryLeague.includes("macdonald") ||
            normalizedInjuryLeague.includes("mcdonald");

          if (isLigue1Selected) {
            if (!isLigue1Injury) return false;
          } else if (injury.league !== selectedLeague) {
            return false;
          }
        }
        // 2. Club Filter
        if (selectedClub !== "Tous les clubs" && injury.clubName !== selectedClub) {
          return false;
        }
      }
      // 3. Status Filter
      if (activeStatusFilter !== "Tous") {
        if (activeStatusFilter === "Absent" && injury.status !== InjuryStatus.Absent) {
          return false;
        }
        if (activeStatusFilter === "Reprise" && injury.status !== InjuryStatus.Reprise) {
          return false;
        }
      }
      // 4. Quick Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesPlayer = injury.playerName.toLowerCase().includes(query);
        const matchesType = injury.type.toLowerCase().includes(query);
        const matchesDetail = injury.detail.toLowerCase().includes(query);
        if (!matchesPlayer && !matchesType && !matchesDetail) {
          return false;
        }
      }
      return true;
    });
  }, [selectedLeague, selectedClub, activeStatusFilter, searchQuery, globalTeamFilter]);

  const handleInjuryRowClick = (injury: InjuryItem) => {
    const playerMatch = MOCK_PLAYERS.find(
      (p) =>
        p.fullName.toLowerCase().includes(injury.playerName.toLowerCase()) ||
        injury.playerName.toLowerCase().includes(p.name.toLowerCase()),
    );

    if (playerMatch) {
      onSelectPlayer(playerMatch);
      onShowToast(`Chargement du profil de ${playerMatch.fullName}`, "success");
    } else {
      onShowToast(
        `Profil complet de ${injury.playerName} indisponible dans le prototype`,
        "warning",
      );
    }
  };

  const handleLoadMore = () => {
    onShowToast("Chargement de 10 joueurs supplémentaires (simulé)", "success");
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="injuries-view-panel">
      {/* Header & Summary Cards */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold font-title-lg tracking-tight text-white flex items-center gap-2">
            <HeartCrack className="w-8 h-8 text-stat-decrease" />
            Centre des Blessures
          </h1>
          <p className="text-on-surface-variant text-sm font-medium max-w-xl mt-1">
            Intelligence médicale en temps réel, délais de récupération et pronostics de
            disponibilité pour composer votre équipe MPG.
          </p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-surface-container p-4 rounded-xl border border-white/5 flex flex-col min-w-[130px] shadow-sm">
            <span className="text-[10px] text-muted-text uppercase font-bold tracking-wider">
              Total Absents
            </span>
            <span className="text-2xl font-black text-stat-decrease mt-1">124</span>
          </div>
          <div className="bg-surface-container p-4 rounded-xl border border-white/5 flex flex-col min-w-[130px] shadow-sm">
            <span className="text-[10px] text-muted-text uppercase font-bold tracking-wider">
              Incertains
            </span>
            <span className="text-2xl font-black text-secondary mt-1">42</span>
          </div>
          <div className="bg-surface-container p-4 rounded-xl border border-white/5 flex flex-col min-w-[130px] shadow-sm">
            <span className="text-[10px] text-muted-text uppercase font-bold tracking-wider">
              Nouveaux (Auj)
            </span>
            <span className="text-2xl font-black text-white mt-1">8</span>
          </div>
        </div>
      </header>

      {/* League Quick-Filter Grid */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-muted-text uppercase tracking-widest ml-1">
          Filtre rapide par Ligue
        </label>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          id="league-quick-filters"
        >
          {[
            {
              id: "Tous les championnats",
              name: "Tous les championnats",
              label: "Tous",
              isGlobe: true,
            },
            {
              id: "Ligue 1 McDonald's",
              name: "Ligue 1 plus macdonald",
              label: "Ligue 1 McDonald's",
              logoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
            },
            {
              id: "Premier League",
              name: "Premier League",
              label: "Premier League",
              logoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
            },
            {
              id: "La Liga",
              name: "La Liga",
              label: "La Liga",
              logoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
            },
            {
              id: "Serie A",
              name: "Serie A",
              label: "Serie A",
              logoUrl: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
            },
          ].map((item) => {
            const isLigue1 = item.id.includes("Ligue 1");
            const isSelected =
              selectedLeague === item.id ||
              (isLigue1 &&
                (selectedLeague.toLowerCase().includes("ligue 1") ||
                  selectedLeague.toLowerCase().includes("macdonald") ||
                  selectedLeague.toLowerCase().includes("mcdonald")));
            const count = leagueCounts[isLigue1 ? "Ligue 1 McDonald's" : item.id] || 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedLeague(item.id);
                  onShowToast(`Championnat filtré : ${item.label}`, "success");
                }}
                className={`text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden group active:scale-[0.97] ${
                  isSelected
                    ? "bg-surface-container-high border-primary-container/40 ring-1 ring-primary-container/20"
                    : "bg-surface-elevated hover:bg-surface-container border-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  {item.isGlobe ? (
                    <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-primary-container" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-sm border border-white/5">
                      <img
                        src={item.logoUrl}
                        className="w-full h-full object-contain"
                        alt={item.label}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black font-mono shrink-0 ${isSelected ? "bg-primary-container/20 text-primary-container" : "bg-white/5 text-muted-text"}`}
                  >
                    {count} {count > 1 ? "blessés" : "blessé"}
                  </span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-black text-white group-hover:text-primary-container transition-colors truncate">
                    {item.label}
                  </h4>
                  <p className="text-[9px] text-on-surface-variant font-medium truncate mt-0.5">
                    {item.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <section className="bg-surface-elevated p-5 rounded-2xl border border-white/5 shadow-xl sticky top-[72px] z-30 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* League Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-text uppercase tracking-wider ml-1">
              Championnat
            </label>
            <div className="relative">
              <select
                className="w-full bg-surface-container-high border-none text-xs font-semibold text-white rounded-xl focus:ring-2 focus:ring-primary-container h-12 px-4 transition-all appearance-none cursor-pointer"
                value={selectedLeague}
                onChange={(e) => {
                  setSelectedLeague(e.target.value);
                  onShowToast(`Championnat sélectionné : ${e.target.value}`, "success");
                }}
              >
                <option value="Tous les championnats">Tous les championnats</option>
                <option value="Premier League">Premier League</option>
                <option value="Ligue 1 McDonald's">Ligue 1 McDonald's</option>
                <option value="La Liga">La Liga</option>
                <option value="Serie A">Serie A</option>
              </select>
            </div>
          </div>

          {/* Club Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-text uppercase tracking-wider ml-1">
              Club
            </label>
            <div className="relative">
              <select
                className="w-full bg-surface-container-high border-none text-xs font-semibold text-white rounded-xl focus:ring-2 focus:ring-primary-container h-12 px-4 transition-all appearance-none cursor-pointer"
                value={selectedClub}
                onChange={(e) => {
                  setSelectedClub(e.target.value);
                  onShowToast(`Club sélectionné : ${e.target.value}`, "success");
                }}
              >
                {availableClubs.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-text uppercase tracking-wider ml-1">
              Statut Médical
            </label>
            <div className="flex gap-1.5 bg-surface-container-high p-1 rounded-xl h-12 items-center">
              {(["Tous", "Absent", "Reprise"] as const).map((status) => (
                <button
                  key={status}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                    activeStatusFilter === status
                      ? "bg-primary-container text-on-primary-container shadow"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                  onClick={() => {
                    setActiveStatusFilter(status);
                    onShowToast(`Filtre statut : ${status}`, "success");
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="sm:col-span-2 space-y-1.5 relative">
            <label className="text-xs font-bold text-muted-text uppercase tracking-wider ml-1">
              Recherche rapide
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-text w-4 h-4" />
              <input
                className="w-full bg-surface-container-high border-none text-xs font-semibold text-white placeholder-muted-text rounded-full focus:ring-2 focus:ring-primary-container h-12 pl-11 pr-4 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher joueur, blessure, lésion..."
                type="text"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Players List Table */}
      <section className="bg-surface-elevated rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-white/5 text-[10px] font-bold text-muted-text uppercase tracking-wider">
                <th className="py-4 px-6">Joueur / Club</th>
                <th className="py-4 px-6">Type de blessure</th>
                <th className="py-4 px-6">Retour estimé</th>
                <th className="py-4 px-6 text-center">Statut</th>
                <th className="py-4 px-6 w-48">Probabilité de jouer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium text-sm">
              {filteredInjuries.length > 0 ? (
                filteredInjuries.map((injury) => (
                  <tr
                    key={injury.id}
                    className="hover:bg-white/5 cursor-pointer transition-all duration-200 group"
                    onClick={() => handleInjuryRowClick(injury)}
                  >
                    {/* Player / Club column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-full overflow-hidden border border-white/10 shrink-0 bg-surface-container">
                          <PlayerAvatar
                            src={injury.avatarUrl}
                            name={injury.playerName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white group-hover:text-primary-container transition-colors truncate">
                            {injury.playerName}
                          </div>
                          <div className="text-[11px] text-muted-text mt-0.5 truncate uppercase">
                            {injury.clubName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Injury Type column */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col min-w-[150px]">
                        <span className="text-sm font-bold text-white">{injury.type}</span>
                        <span className="text-xs text-muted-text mt-0.5">{injury.detail}</span>
                      </div>
                    </td>

                    {/* Estimated Return column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-white min-w-[140px]">
                        <Calendar className="text-muted-text w-4 h-4 shrink-0" />
                        <span className="font-mono text-xs font-bold">
                          {injury.estimatedReturn}
                        </span>
                      </div>
                    </td>

                    {/* Status badge column */}
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                          injury.status === "Absent"
                            ? "bg-stat-decrease/10 text-stat-decrease border-stat-decrease/20"
                            : injury.status === "Incertain"
                              ? "bg-secondary/15 text-secondary border-secondary/20"
                              : injury.status === "Reprise"
                                ? "bg-primary-container/15 text-primary-container border-primary-container/20"
                                : "bg-white/5 text-muted-text border-white/10"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-2 ${
                            injury.status === "Absent"
                              ? "bg-stat-decrease animate-pulse"
                              : injury.status === "Incertain"
                                ? "bg-secondary"
                                : injury.status === "Reprise"
                                  ? "bg-primary-container"
                                  : "bg-muted-text"
                          }`}
                        ></span>
                        {injury.status}
                      </span>
                    </td>

                    {/* Confidence Slider column */}
                    <td className="py-4 px-6">
                      <div className="space-y-1 min-w-[120px]">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-muted-text">Fiabilité</span>
                          <span className="text-white font-mono font-bold">
                            {injury.confidence}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              injury.confidence > 75
                                ? "bg-primary-container"
                                : injury.confidence > 40
                                  ? "bg-secondary"
                                  : "bg-stat-decrease"
                            }`}
                            style={{ width: `${injury.confidence}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-text text-sm italic">
                    Aucun joueur ne correspond à vos filtres de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load More section */}
        <div className="p-6 flex flex-col items-center justify-center border-t border-white/5 bg-surface-container-low">
          <button
            className="bg-surface-container-high hover:bg-surface-variant text-white font-bold px-8 py-3 rounded-xl transition-all active:scale-95 border border-white/5 text-xs uppercase tracking-wider"
            onClick={handleLoadMore}
          >
            Charger plus de joueurs blessés
          </button>
          <p className="mt-3 text-xs text-muted-text italic font-medium">
            Affichage de {filteredInjuries.length} de {MOCK_INJURIES.length} blessures recensées
          </p>
        </div>
      </section>
    </div>
  );
}
