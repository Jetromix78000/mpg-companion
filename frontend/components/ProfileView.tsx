import { useEffect, useState } from "react";
import type { Player } from "../../shared/types";
import { PlayerAvatar } from "./PlayerAvatar";
import { useAppSelector } from "../store";
import { useAuth } from "../auth/useAuth";
import {
  Shield,
  Bolt,
  BrainCircuit,
  BarChart3,
  AlertTriangle,
  XCircle,
  Search,
  Star,
} from "lucide-react";

interface ProfileViewProps {
  /** null tant qu'aucune recherche n'a abouti : la fiche n'a plus de joueur par défaut. */
  player: Player | null;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

/**
 * Aucune fiche n'est chargée par défaut : les données joueur viennent désormais de
 * de MOCK DATA, il faut d'abord une recherche ou un clic sur un joueur mis en avant.
 */
function EmptyProfile() {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-10 flex flex-col items-center text-center gap-3 animate-fadeIn">
      <div className="w-12 h-12 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center">
        <Search className="w-5 h-5 text-primary-container" />
      </div>
      <p className="text-sm font-black text-white">Aucune fiche ouverte</p>
      <p className="text-xs text-on-surface-variant font-medium max-w-xs">
        Recherchez un joueur dans la barre du haut, ou ouvrez-en un depuis le tableau de bord, le
        marché ou le centre des blessures.
      </p>
    </div>
  );
}

export default function ProfileView({ player, onShowToast }: ProfileViewProps) {
  if (!player) return <EmptyProfile />;
  return <PlayerProfile player={player} onShowToast={onShowToast} />;
}

function PlayerProfile({
  player,
  onShowToast,
}: {
  player: Player;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState("Ligue 1 25/26");

  // --- Favoris ---
  const { user, requestLogin } = useAuth();
  const token = useAppSelector((state) => state.auth.token);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/favorites", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data: { favorites: { playerId: string }[] }) =>
        setIsFavorite(data.favorites.some((f) => f.playerId === player.id)),
      )
      .catch(() => setIsFavorite(false));
  }, [user, token, player.id]);

  // Pas de session : jamais affiché comme favori, même si l'état interne garde une vieille valeur.
  const showAsFavorite = Boolean(user) && isFavorite;

  function toggleFavorite() {
    if (!user) {
      requestLogin();
      onShowToast("Connectez-vous pour ajouter un favori", "warning");
      return;
    }

    setFavoritePending(true);

    const request = showAsFavorite
      ? fetch(`/api/favorites/${player.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      : fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            playerId: player.id,
            playerName: player.name,
            playerFullName: player.fullName,
            team: player.team,
            avatarUrl: player.avatarUrl,
            position: player.position,
          }),
        });

    request
      .then((res) => {
        if (!res.ok) throw new Error("Opération impossible");
        if (showAsFavorite) {
          setIsFavorite(false);
          onShowToast(`${player.name} retiré des favoris`, "success");
        } else {
          setIsFavorite(true);
          onShowToast(`${player.name} ajouté aux favoris`, "success");
        }
      })
      .catch(() => onShowToast("Opération impossible", "warning"))
      .finally(() => setFavoritePending(false));
  }

  // Synthèse "faut-il le titulariser en MPG ?" : croise la probabilité de titularisation,
  // la tendance des notes récentes et l'impact du remplaçant, chaque ligne citant sa source.
  const startRecommendation = (() => {
    type Tone = "good" | "neutral" | "bad";
    const reasons: { tone: Tone; text: string }[] = [];
    let score = player.probabilityToPlay;

    reasons.push({
      tone:
        player.probabilityToPlay >= 70
          ? "good"
          : player.probabilityToPlay >= 40
            ? "neutral"
            : "bad",
      text: `Probabilité de titularisation estimée à ${player.probabilityToPlay}% : ${player.iaJustification}`,
    });

    const notes = player.recentNotes;
    if (notes.length >= 2) {
      const delta = notes[notes.length - 1] - notes[0];
      if (delta > 0.5) {
        reasons.push({
          tone: "good",
          text: `Forme en progression sur les 5 derniers matchs (${notes[0].toFixed(1)} → ${notes[notes.length - 1].toFixed(1)}).`,
        });
        score += 5;
      } else if (delta < -0.5) {
        reasons.push({
          tone: "bad",
          text: `Forme en baisse sur les 5 derniers matchs (${notes[0].toFixed(1)} → ${notes[notes.length - 1].toFixed(1)}).`,
        });
        score -= 5;
      }
    }

    reasons.push({
      tone: "neutral",
      text: `Le laisser sur le banc coûterait ${player.comparison.impact} selon notre comparatif avec ${player.comparison.alternativeName}.`,
    });

    score = Math.max(0, Math.min(100, score));
    const verdict: "conseille" | "incertain" | "eviter" =
      score >= 70 ? "conseille" : score >= 40 ? "incertain" : "eviter";

    return { score, verdict, reasons };
  })();

  return (
    <div className="space-y-6 animate-fadeIn" id="player-profile-panel">
      {/* Header Joueur */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 border-primary-container/20 shadow-xl bg-surface-container-low">
              <PlayerAvatar
                src={player.avatarUrl}
                name={player.fullName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary-container text-on-primary-container text-[11px] font-extrabold px-2.5 py-1 rounded-full border-2 border-background shadow-md uppercase tracking-wider">
              {player.position}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="text-2xl md:text-4xl font-extrabold font-title-lg tracking-tight text-white leading-none">
                {player.fullName}
              </h1>
              <span className="bg-primary-container/10 text-primary-container text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-primary-container/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span>
                Forme stable • {player.form}
              </span>
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={favoritePending}
                aria-label={showAsFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors disabled:opacity-50 ${
                  showAsFavorite
                    ? "bg-primary-container/20 border-primary-container/40 text-primary-container"
                    : "bg-white/5 border-white/10 text-muted-text hover:text-white"
                }`}
              >
                <Star className="w-4 h-4" fill={showAsFavorite ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant text-sm font-medium flex-wrap">
              <span className="text-white font-bold">{player.team}</span>
              <span className="text-white/20">•</span>
              <span>{player.age} ans</span>
              <span className="text-white/20">•</span>
              <span>{player.country}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* 1. Index de Forme */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-text">
            Index de Forme
          </h3>
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex items-center justify-center w-24 h-24">
              {/* SVG Radial Progress */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#00FF87"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - player.form / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black text-white block leading-none">
                  {player.form}
                </span>
                <span className="text-[10px] text-muted-text uppercase font-bold tracking-wider">
                  / 100
                </span>
              </div>
            </div>

            <div className="space-y-3 flex-1 pl-2">
              <div>
                <span className="text-primary-container text-base font-bold">+12%</span>
                <p className="text-[10px] text-muted-text font-semibold uppercase">
                  vs sem. dernière
                </p>
              </div>
              {/* Simulated Sparkline Bar chart */}
              <div className="flex items-end gap-1.5 h-10 pt-1">
                {player.recentNotes.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-2.5 bg-primary-container rounded-t-sm transition-all duration-500"
                    style={{ height: `${(val / 10) * 100}%` }}
                    title={`Note: ${val}`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Probabilité de Jouer */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 border-l-4 border-l-primary-container shadow-xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-text mb-1">
                Probabilité de jouer
              </h3>
              <div className="text-4xl font-extrabold text-primary-container leading-none">
                {player.probabilityToPlay}%
              </div>
            </div>
            <Bolt className="w-8 h-8 text-primary-container animate-pulse fill-primary-container/10" />
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-primary-container font-bold text-xs">
                <BrainCircuit className="w-4 h-4" />
                JUSTIFICATION IA COMPANION
              </div>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed italic font-medium">
              "{player.iaJustification}"
            </p>
          </div>
        </div>

        {/* 3. Statistiques de Temps de Jeu */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
            <h3 className="text-lg font-bold font-title-lg text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" />
              Statistiques de Temps de Jeu
            </h3>
            <select
              className="bg-surface-container-high border-none text-xs font-semibold rounded-xl text-white focus:ring-primary-container focus:ring-2 py-2 px-3 appearance-none cursor-pointer"
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(e.target.value);
                onShowToast(`Simulation de saison changée pour ${player.name}`, "success");
              }}
            >
              <option>Ligue 1 25/26</option>
              <option>Ligue des Champions</option>
              <option>Stats Historiques</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-surface-container-low rounded-xl border border-white/5">
              <span className="text-xs text-muted-text font-semibold block mb-1">Min. / Match</span>
              <span className="text-2xl font-black text-white">{player.minPerMatch}</span>
            </div>
            <div className="p-4 bg-surface-container-low rounded-xl border border-white/5">
              <span className="text-xs text-muted-text font-semibold block mb-1">
                Titularisations
              </span>
              <span className="text-2xl font-black text-white">{player.starts}</span>
            </div>
            <div className="p-4 bg-surface-container-low rounded-xl border border-white/5">
              <span className="text-xs text-muted-text font-semibold block mb-1">Buts / 90min</span>
              <span className="text-2xl font-black text-white font-mono">{player.goalsPer90}</span>
            </div>
            <div className="p-4 bg-surface-container-low rounded-xl border border-white/5">
              <span className="text-xs text-muted-text font-semibold block mb-1">Passes D.</span>
              <span className="text-2xl font-black text-white">{player.assists || 0}</span>
            </div>
          </div>
        </div>

        {/* Derniers Matchs */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-text">
            Derniers Matchs Enregistrés
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-text uppercase font-bold">
                  <th className="pb-3 font-semibold">Adversaire</th>
                  <th className="pb-3 font-semibold">Résultat</th>
                  <th className="pb-3 font-semibold text-center">Minutes</th>
                  <th className="pb-3 font-semibold text-center">Buts</th>
                  <th className="pb-3 font-semibold text-right">Note MPG</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {player.lastMatches.map((match, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 font-bold text-white flex items-center gap-2">
                      <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-[10px] text-muted-text font-mono">
                        {match.opponent.slice(0, 2).toUpperCase()}
                      </div>
                      {match.opponent}
                    </td>
                    <td
                      className={`py-4 ${
                        match.isWin ? "text-primary-container" : "text-muted-text"
                      }`}
                    >
                      {match.result}
                    </td>
                    <td className="py-4 text-center font-mono text-xs">{match.minutes}</td>
                    <td className="py-4 text-center font-bold font-mono">{match.goals}</td>
                    <td className="py-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded font-bold font-mono text-xs ${
                          match.note >= 7.5
                            ? "bg-primary-container/20 text-primary-container border border-primary-container/30"
                            : "bg-white/10 text-white border border-white/15"
                        }`}
                      >
                        {match.note.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparaison Remplaçant */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-text">
            Comparaison Remplaçant Probable
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex-1 text-center">
                <p className="text-[10px] text-primary-container font-bold uppercase tracking-wider mb-1">
                  {player.name}
                </p>
                <div className="h-1 bg-primary-container rounded-full"></div>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-stat-decrease font-bold uppercase tracking-wider mb-1">
                  {player.comparison.alternativeName}
                </p>
                <div className="h-1 bg-stat-decrease/40 rounded-full"></div>
              </div>
            </div>

            <div className="space-y-3.5">
              {player.comparison.stats.map((st, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-primary-container font-mono">{st.playerVal}</span>
                    <span className="text-muted-text font-semibold uppercase text-[10px]">
                      {st.label}
                    </span>
                    <span className="text-stat-decrease font-mono">{st.altVal}</span>
                  </div>
                  {/* Double horizontal comparison progress bar */}
                  <div className="flex h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary-container rounded-l-full"
                      style={{ width: `${(st.playerVal / st.maxVal) * 50}%` }}
                    ></div>
                    <div className="w-0.5 bg-background"></div>
                    <div
                      className="bg-stat-decrease rounded-r-full ml-auto"
                      style={{ width: `${(st.altVal / st.maxVal) * 50}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[11px] font-semibold text-muted-text">
              <span className="uppercase">Style de jeu</span>
              <div className="flex gap-1.5">
                {player.styleTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="bg-primary-container/10 text-primary-container px-2 py-0.5 rounded-lg text-[10px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-stat-decrease/10 border border-stat-decrease/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-stat-decrease font-bold">
                Impact Remplacement Tactique
              </span>
              <span className="text-xl font-extrabold text-stat-decrease">
                {player.comparison.impact}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Faut-il le titulariser en MPG ? */}
        <div
          className={`glass-card p-5 rounded-2xl border shadow-xl space-y-4 border-l-4 ${
            startRecommendation.verdict === "conseille"
              ? "border-white/5 border-l-primary-container"
              : startRecommendation.verdict === "incertain"
                ? "border-white/5 border-l-secondary"
                : "border-white/5 border-l-stat-decrease"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-title-lg text-white flex items-center gap-2">
                {startRecommendation.verdict === "conseille" ? (
                  <Shield className="w-5 h-5 text-primary-container" />
                ) : startRecommendation.verdict === "incertain" ? (
                  <AlertTriangle className="w-5 h-5 text-secondary" />
                ) : (
                  <XCircle className="w-5 h-5 text-stat-decrease" />
                )}
                Faut-il le titulariser en MPG ?
              </h3>
              <p className="text-xs text-muted-text font-medium">
                Synthèse de la probabilité de titularisation, de la forme récente et du comparatif
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border ${
                startRecommendation.verdict === "conseille"
                  ? "bg-primary-container/10 text-primary-container border-primary-container/30"
                  : startRecommendation.verdict === "incertain"
                    ? "bg-secondary/15 text-secondary border-secondary/30"
                    : "bg-stat-decrease/10 text-stat-decrease border-stat-decrease/30"
              }`}
            >
              {startRecommendation.verdict === "conseille"
                ? "Titulaire conseillé"
                : startRecommendation.verdict === "incertain"
                  ? "Sous surveillance"
                  : "À éviter cette semaine"}
              <span className="font-mono opacity-70">{startRecommendation.score}/100</span>
            </span>
          </div>

          <ul className="space-y-2.5">
            {startRecommendation.reasons.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-on-surface-variant leading-relaxed"
              >
                <span
                  className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                    reason.tone === "good"
                      ? "bg-primary-container"
                      : reason.tone === "bad"
                        ? "bg-stat-decrease"
                        : "bg-secondary"
                  }`}
                ></span>
                <span>{reason.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
