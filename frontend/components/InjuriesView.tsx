import React, { useEffect, useState, useMemo } from "react";
import { InjuryItem, InjuryStatus } from "../../shared/types";
import { PlayerAvatar } from "./PlayerAvatar";
import { ViewError, ViewLoader } from "./ViewState";
import { useAppDispatch, useAppSelector } from "../store";
import { loadInjuries } from "../reducers/injuries";
import { HeartCrack, Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

interface InjuriesViewProps {
  /** Ouvre la fiche du joueur en repassant par la recherche serveur. */
  onOpenPlayerByName: (name: string) => void;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

export default function InjuriesView({ onOpenPlayerByName, onShowToast }: InjuriesViewProps) {
  const dispatch = useAppDispatch();
  const { injuries, clubs, loading, error } = useAppSelector((state) => state.injuries);

  useEffect(() => {
    dispatch(loadInjuries());
  }, [dispatch]);

  const [selectedClub, setSelectedClub] = useState("Tous les clubs");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"Tous" | "Absent" | "Reprise">(
    "Tous",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Un seul championnat désormais (Ligue 1) : plus de filtre par ligue, ni de
  // recherche globale d'équipe — le club et le statut suffisent.
  const filteredInjuries = useMemo(() => {
    return injuries.filter((injury) => {
      if (selectedClub !== "Tous les clubs" && injury.clubName !== selectedClub) {
        return false;
      }
      if (activeStatusFilter !== "Tous") {
        if (activeStatusFilter === "Absent" && injury.status !== InjuryStatus.Absent) {
          return false;
        }
        if (activeStatusFilter === "Reprise" && injury.status !== InjuryStatus.Reprise) {
          return false;
        }
      }
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
  }, [injuries, selectedClub, activeStatusFilter, searchQuery]);

  // Changer de filtre invalide la page courante : repartir en page 1 évite un
  // tableau vide si la page active dépasse le nouveau total filtré.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClub, activeStatusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredInjuries.length / PAGE_SIZE));
  const paginatedInjuries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInjuries.slice(start, start + PAGE_SIZE);
  }, [filteredInjuries, currentPage]);

  // La résolution du joueur se fait côté serveur : on ne connaît ici qu'un nom.
  const handleInjuryRowClick = (injury: InjuryItem) => {
    onShowToast(`${injury.playerName} — ${injury.type} : ${injury.detail}`, "success");
    onOpenPlayerByName(injury.playerName);
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

      {loading && <ViewLoader label="Chargement du centre des blessures..." />}
      {error && <ViewError message={error} onRetry={() => dispatch(loadInjuries())} />}

      {/* Filter Bar */}
      <section className="bg-surface-elevated p-5 rounded-2xl border border-white/5 shadow-xl sticky top-[72px] z-30 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
                {clubs.map((club) => (
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
              {paginatedInjuries.length > 0 ? (
                paginatedInjuries.map((injury) => (
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

        {/* Pagination */}
        <div className="p-6 flex flex-col items-center justify-center gap-3 border-t border-white/5 bg-surface-container-low">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-variant text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white px-3">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-variant text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-text italic font-medium">
            Affichage de {paginatedInjuries.length} sur {filteredInjuries.length} blessures
            {filteredInjuries.length !== injuries.length ? ` (${injuries.length} au total)` : ""}
          </p>
        </div>
      </section>
    </div>
  );
}
