import React, { useCallback, useEffect, useState } from "react";
import type { TransferMovement } from "../../shared/types";
import { lastNameToken } from "../../shared/search";
import { PlayerAvatar } from "./PlayerAvatar";
import { ClubLogo } from "./ClubLogo";
import { ViewError, ViewLoader } from "./ViewState";
import { ArrowRight, RefreshCw, CheckCircle, TrendingUp, XCircle } from "lucide-react";

interface MarketViewProps {
  /** Ouvre la fiche du joueur en repassant par la recherche serveur. */
  onOpenPlayerByName: (name: string) => void;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

const PAGE_SIZE = 20;

export default function MarketView({ onOpenPlayerByName, onShowToast }: MarketViewProps) {
  const [transfers, setTransfers] = useState<TransferMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadTransferItems = useCallback(() => {
    fetch("/api/transfers")
      .then((res) => {
        if (!res.ok) throw new Error("Chargement impossible");
        return res.json();
      })
      .then((data: { transfers: TransferMovement[] }) => {
        setTransfers(data.transfers);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Chargement impossible"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTransferItems();
  }, [loadTransferItems]);

  const retryTransferItems = useCallback(() => {
    setLoading(true);
    loadTransferItems();
  }, [loadTransferItems]);

  // Le back ne suit que 3 joueurs : une carte par joueur. La liste arrive triée
  // du plus récent au plus ancien, et on privilégie le transfert dont le montant
  // est connu — sinon la carte n'afficherait qu'un tiret. On compare le nom de
  // famille : l'API abrège le prénom ("O. Dembélé").
  const byPlayer = new Map<string, TransferMovement>();
  for (const transfer of transfers) {
    const surname = lastNameToken(transfer.playerName);
    const kept = byPlayer.get(surname);
    const hasAmount = transfer.amount !== "—";

    if (!kept || (hasAmount && kept.amount === "—")) byPlayer.set(surname, transfer);
  }

  const dedupedTransfers = [...byPlayer.values()].sort((a, b) => b.date.localeCompare(a.date));

  const filteredTransfers = dedupedTransfers;

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageTransfers = filteredTransfers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Separate confirmed vs rumors for rendering layout headers
  const confirmedMovements = pageTransfers.filter(
    (t) => t.type === "Official" || t.type === "Prolongation",
  );
  const rumorsMovements = pageTransfers.filter((t) => t.type === "Rumor");

  // La résolution du joueur se fait côté serveur : on ne connaît ici qu'un nom.
  const handleCardClick = (transfer: TransferMovement) => {
    onShowToast(
      `${transfer.playerName} : ${transfer.fromTeam} ➔ ${transfer.toTeam} — ${transfer.description}`,
      "success",
    );
    onOpenPlayerByName(transfer.playerName);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="market-view-panel">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold font-title-lg tracking-tight text-white">
            Marché des Transferts
          </h1>
          <p className="text-on-surface-variant text-sm font-medium">
            Direct &amp; Rumeurs de l'été 2026
          </p>
        </div>
      </div>

      {loading && <ViewLoader label="Chargement du marché des transferts..." />}
      {error && <ViewError message={error} onRetry={retryTransferItems} />}

      {/* Section: Mouvements Confirmés */}
      {confirmedMovements.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <span className="w-2 h-7 bg-stat-increase rounded-full"></span>
            <h2 className="text-xl font-bold font-title-lg text-white">Mouvements Confirmés</h2>
            <span className="ml-auto text-[11px] text-stat-increase font-bold bg-stat-increase/10 px-3 py-1 rounded-full uppercase tracking-wider">
              Officiel
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {confirmedMovements.map((t) => (
              <div
                key={t.id}
                className="glass-card rounded-2xl p-5 hover:border-primary-container/20 hover:-translate-y-1 transition-all duration-350 group flex flex-col h-full cursor-pointer relative border border-white/5 shadow-md"
                onClick={() => handleCardClick(t)}
              >
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="w-16 h-16 shrink-0 rounded-xl bg-surface-container-highest overflow-hidden border border-white/5 shadow-inner">
                    <PlayerAvatar
                      src={t.avatarUrl}
                      name={t.playerName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-1 rounded uppercase tracking-wider shrink-0 ${
                      t.type === "Prolongation"
                        ? "bg-primary/20 text-primary border border-primary/20"
                        : "bg-emerald-700 text-white"
                    }`}
                  >
                    {t.type === "Prolongation" ? "Prolongation" : "Officiel"}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1 truncate leading-tight group-hover:text-primary-container transition-colors">
                  {t.playerName}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-muted-text mb-4 font-semibold">
                  <ClubLogo src={t.fromTeamLogo} name={t.fromTeam} />
                  <span className="text-white truncate max-w-[60px]">{t.fromTeam}</span>
                  {t.type === "Prolongation" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-muted-text shrink-0 animate-spin-slow" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-text shrink-0" />
                  )}
                  <ClubLogo src={t.toTeamLogo} name={t.toTeam} />
                  <span className="text-secondary truncate max-w-[60px]">{t.toTeam}</span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-4 flex-grow font-medium">
                  {t.description}
                </p>

                <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-auto">
                  <span className="text-xs font-bold text-white">{t.amount}</span>
                  <span className="text-[11px] text-muted-text font-semibold">{t.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Rumeurs & Négociations */}
      {rumorsMovements.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2 pb-2">
            <span className="w-2 h-7 bg-tertiary-container rounded-full"></span>
            <h2 className="text-xl font-bold font-title-lg text-white">
              Rumeurs &amp; Négociations
            </h2>
            <span className="ml-auto text-[11px] text-on-surface-variant font-bold bg-surface-container-high px-3 py-1 rounded-full uppercase tracking-wider">
              En cours
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rumorsMovements.map((t) => (
              <div
                key={t.id}
                className="glass-card rounded-2xl p-5 hover:border-primary-container/20 hover:-translate-y-1 transition-all duration-350 flex flex-col h-full cursor-pointer border border-white/5 shadow-md"
                onClick={() => handleCardClick(t)}
              >
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="w-16 h-16 shrink-0 rounded-xl bg-surface-container-highest overflow-hidden border border-white/5 shadow-inner">
                    <PlayerAvatar
                      src={t.avatarUrl}
                      name={t.playerName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-[9px] font-extrabold text-muted-text mb-1 uppercase tracking-wider">
                      Confiance
                    </span>
                    <div className="w-20 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (t.confidence || 0) > 75
                            ? "bg-primary-container"
                            : (t.confidence || 0) > 40
                              ? "bg-secondary"
                              : "bg-error"
                        }`}
                        style={{ width: `${t.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-bold mt-0.5 block font-mono">
                      {t.confidence}%
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-1 truncate leading-tight">
                  {t.playerName}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-muted-text mb-4 font-semibold">
                  <ClubLogo src={t.fromTeamLogo} name={t.fromTeam} />
                  <span className="text-white truncate max-w-[60px]">{t.fromTeam}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-text shrink-0" />
                  <ClubLogo src={t.toTeamLogo} name={t.toTeam} />
                  <span
                    className={`truncate max-w-[60px] ${
                      (t.confidence || 0) > 70
                        ? "text-primary-container"
                        : (t.confidence || 0) > 40
                          ? "text-secondary"
                          : "text-error"
                    }`}
                  >
                    {t.toTeam}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-4 flex-grow font-medium">
                  {t.description}
                </p>

                <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-auto">
                  <span
                    className={`text-xs font-bold flex items-center gap-1 ${
                      t.statusLabel === "Refusé" || t.statusLabel === "Piste éteinte"
                        ? "text-error"
                        : t.statusLabel === "Quasi-bouclé" || t.statusLabel === "Dossier très chaud"
                          ? "text-primary-container"
                          : "text-secondary"
                    }`}
                  >
                    {t.statusLabel === "Refusé" || t.statusLabel === "Piste éteinte" ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : t.statusLabel === "Quasi-bouclé" ||
                      t.statusLabel === "Dossier très chaud" ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5" />
                    )}
                    {t.statusLabel}
                  </span>
                  <span className="text-[11px] text-muted-text font-semibold">{t.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            className="px-4 py-2 text-xs font-bold rounded-xl bg-surface-container-low border border-white/5 text-on-surface-variant hover:text-white hover:bg-white/5 transition-all duration-350 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Précédent
          </button>
          <span className="text-xs font-bold text-on-surface-variant">
            Page {safePage} / {totalPages}
          </span>
          <button
            className="px-4 py-2 text-xs font-bold rounded-xl bg-surface-container-low border border-white/5 text-on-surface-variant hover:text-white hover:bg-white/5 transition-all duration-350 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
