import React, { useState, useEffect } from "react";
import { Player } from "../types";
import { PlayerAvatar } from "./PlayerAvatar";
import { FavoriteButton } from "./FavoriteButton";
import {
  Shield,
  Bolt,
  BrainCircuit,
  Users,
  Share2,
  BarChart3,
  ExternalLink,
  Loader2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

interface ProfileViewProps {
  player: Player;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

interface CompoMatch {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  lineups: { label: string; lineup: string }[];
  observations: string[];
}

interface CompositionsPayload {
  sourceUrl: string;
  updatedAt: string;
  matches: CompoMatch[];
  stale?: boolean;
}

const LIGUE1_SOURCE_URL =
  "https://ligue1.com/fr/articles/l1_article_3199-2526-les-compositions-probables-l1";

// Surligne le nom du joueur consulté dans une composition (utile si c'est un joueur de L1)
function highlightPlayer(lineup: string, name: string): React.ReactNode {
  const short = name.split(" ").pop() || name;
  if (short.length < 3) return lineup;
  const parts = lineup.split(new RegExp(`(${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  if (parts.length === 1) return lineup;
  return parts.map((part, i) =>
    part.toLowerCase() === short.toLowerCase() ? (
      <span key={i} className="text-primary-container font-bold">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export default function ProfileView({ player, onShowToast }: ProfileViewProps) {
  const [selectedSeason, setSelectedSeason] = useState("La Liga 25/26");

  // Compositions probables Ligue 1, scrappées côté serveur depuis ligue1.com
  const [compos, setCompos] = useState<CompositionsPayload | null>(null);
  const [composLoading, setComposLoading] = useState(true);
  const [composError, setComposError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/compositions");
        if (!res.ok) throw new Error("indisponible");
        const data = await res.json() as CompositionsPayload;
        if (active) {
          setCompos(data);
          setComposError(false);
        }
      } catch {
        if (active) setComposError(true);
      } finally {
        if (active) setComposLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Met en avant le match impliquant l'équipe du joueur consulté (si elle est en L1)
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const teamMatches = (a: string, b: string) => {
    const na = normalize(a);
    const nb = normalize(b);
    return na.includes(nb) || nb.includes(na);
  };
  const orderedMatches = (() => {
    if (!compos) return [];
    const idx = compos.matches.findIndex(
      (m) => teamMatches(m.homeTeam, player.team) || teamMatches(m.awayTeam, player.team),
    );
    if (idx <= 0) return compos.matches;
    const copy = [...compos.matches];
    const [featured] = copy.splice(idx, 1);
    return [featured, ...copy];
  })();

  const matchForPlayer = compos
    ? compos.matches.find(
        (m) => teamMatches(m.homeTeam, player.team) || teamMatches(m.awayTeam, player.team),
      ) || null
    : null;

  const lineupForPlayer = matchForPlayer
    ? matchForPlayer.lineups.find((l) =>
        l.lineup.toLowerCase().includes(player.name.toLowerCase()),
      ) || null
    : null;

  const observationForPlayer = matchForPlayer
    ? matchForPlayer.observations.find((o) =>
        o.toLowerCase().includes(player.name.toLowerCase()),
      ) || null
    : null;

  // Recherche du statut en direct du joueur (blessure/forme/composition) dans les compositions
  // Ligue 1 scrappées : d'abord dans les "Observations" (source d'infos blessures/forfaits),
  // sinon dans la composition probable elle-même (confirmation qu'il est titulaire).
  const liveStatus = (() => {
    if (!matchForPlayer) return null;
    if (observationForPlayer) {
      return { label: "Statut médical en direct — Ligue1.com", text: observationForPlayer };
    }
    if (lineupForPlayer) {
      return {
        label: "Composition confirmée — Ligue1.com",
        text: `Annoncé titulaire probable par Ligue1.com pour ${matchForPlayer.homeTeam} vs ${matchForPlayer.awayTeam} (${matchForPlayer.kickoff}).`,
      };
    }
    return null;
  })();

  // Synthèse "faut-il le titulariser en MPG ?" : combine les données réelles scrappées
  // (composition/observations Ligue1.com) avec la forme récente et l'impact du remplaçant,
  // pour produire un verdict transparent (chaque commentaire cite sa source).
  const startRecommendation = (() => {
    type Tone = "good" | "neutral" | "bad";
    const reasons: { tone: Tone; text: string }[] = [];
    let score = player.probabilityToPlay;

    if (matchForPlayer) {
      const short = player.name;
      const escaped = short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const isAlternative = lineupForPlayer
        ? new RegExp(`\\(ou[^)]*${escaped}`, "i").test(lineupForPlayer.lineup)
        : false;
      const isCaptain = lineupForPlayer
        ? new RegExp(`${escaped}\\s*\\(c\\)`, "i").test(lineupForPlayer.lineup)
        : false;
      const isContested = lineupForPlayer
        ? new RegExp(`${escaped}[^,–-]{0,25}\\(ou`, "i").test(lineupForPlayer.lineup)
        : false;

      if (observationForPlayer) {
        reasons.push({
          tone: "neutral",
          text: `Ligue1.com mentionne ${player.name} dans ses observations : "${observationForPlayer}" — à vérifier avant le coup d'envoi.`,
        });
        score -= 15;
      }

      if (lineupForPlayer && isAlternative) {
        reasons.push({
          tone: "bad",
          text: `Ligue1.com l'annonce comme option alternative (pas titulaire indiscutable) pour ${matchForPlayer.homeTeam} vs ${matchForPlayer.awayTeam}.`,
        });
        score -= 25;
      } else if (lineupForPlayer && isCaptain) {
        reasons.push({
          tone: "good",
          text: `Annoncé titulaire ET capitaine par Ligue1.com pour ${matchForPlayer.homeTeam} vs ${matchForPlayer.awayTeam} (${matchForPlayer.kickoff}) — rotation peu probable.`,
        });
        score += 10;
      } else if (lineupForPlayer && isContested) {
        reasons.push({
          tone: "neutral",
          text: `Annoncé titulaire par Ligue1.com mais en concurrence directe avec un autre joueur à son poste.`,
        });
        score -= 5;
      } else if (lineupForPlayer) {
        reasons.push({
          tone: "good",
          text: `Annoncé titulaire probable par Ligue1.com pour ${matchForPlayer.homeTeam} vs ${matchForPlayer.awayTeam} (${matchForPlayer.kickoff}).`,
        });
        score += 5;
      } else if (!observationForPlayer) {
        reasons.push({
          tone: "neutral",
          text: `${player.name} n'apparaît pas dans la compo probable ni les observations Ligue1.com de ${matchForPlayer.homeTeam} vs ${matchForPlayer.awayTeam}.`,
        });
        score -= 10;
      }
    } else {
      reasons.push({
        tone: "neutral",
        text: `${player.team} ne fait pas partie des compositions Ligue 1 analysées cette semaine par Ligue1.com — verdict basé sur nos données internes.`,
      });
    }

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

  const handleShare = () => {
    onShowToast(`Lien de partage du profil de ${player.fullName} copié !`, "success");
  };

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

        <div className="flex gap-2.5 w-full md:w-auto">
          <FavoriteButton
            playerId={player.id}
            playerName={player.fullName}
            onShowToast={onShowToast}
          />
          <button
            className="w-full md:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            Partager le profil
          </button>
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
                {liveStatus ? liveStatus.label.toUpperCase() : "JUSTIFICATION IA COMPANION"}
              </div>
              {liveStatus && (
                <a
                  href={compos!.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-primary-container underline underline-offset-2"
                >
                  Source
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed italic font-medium">
              "{liveStatus ? liveStatus.text : player.iaJustification}"
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
              <option>La Liga 25/26</option>
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

        {/* 4. Faut-il le titulariser en MPG ? — synthèse basée sur les données scrappées Ligue1.com */}
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
                Synthèse basée sur les compositions et observations Ligue1.com de la semaine
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

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-[10px] text-muted-text font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {compos
                ? `Données Ligue1.com mises à jour le ${new Date(compos.updatedAt).toLocaleString(
                    "fr-FR",
                    {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}`
                : composLoading
                  ? "Récupération des données Ligue1.com en cours…"
                  : "Ligue1.com indisponible — verdict basé sur nos données internes"}
            </span>
            {compos && (
              <a
                href={compos.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 font-bold text-primary-container underline underline-offset-2"
              >
                Source
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* 5. Prochaine composition probable — scrappée depuis ligue1.com */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-title-lg text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-container" />
                Prochaine Composition Probable
              </h3>
              <p className="text-xs text-muted-text font-medium">
                Compositions probables de la journée de Ligue 1, analysées chaque semaine
              </p>
            </div>
            <a
              href={compos?.sourceUrl || LIGUE1_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary-container/10 text-primary-container border border-primary-container/30 hover:bg-primary-container/20 transition-colors underline underline-offset-2 decoration-primary-container/50"
            >
              Voir sur Ligue1.com
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {composLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-text text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Récupération des compositions en direct…
            </div>
          )}

          {!composLoading && composError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="w-6 h-6 text-stat-decrease" />
              <p className="text-sm text-on-surface-variant font-medium">
                Impossible de récupérer les compositions pour le moment.
              </p>
              <a
                href={LIGUE1_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-container underline underline-offset-2"
              >
                Consulter directement sur Ligue1.com
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {!composLoading && !composError && compos && (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {orderedMatches.map((match, idx) => {
                const isFeatured =
                  teamMatches(match.homeTeam, player.team) ||
                  teamMatches(match.awayTeam, player.team);
                return (
                  <div
                    key={`${match.homeTeam}-${match.awayTeam}-${idx}`}
                    className={`rounded-xl p-4 border ${
                      isFeatured
                        ? "bg-primary-container/5 border-primary-container/30"
                        : "bg-surface-container-low border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-sm font-bold text-white">
                        {match.homeTeam} <span className="text-muted-text font-normal">vs</span>{" "}
                        {match.awayTeam}
                      </span>
                      {match.kickoff && (
                        <span className="shrink-0 text-[10px] text-muted-text bg-white/5 px-2 py-1 rounded-lg border border-white/5 font-semibold">
                          {match.kickoff}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {match.lineups.map((l, li) => (
                        <div key={li} className="text-xs leading-relaxed">
                          <span className="text-primary-container font-bold uppercase tracking-wide text-[10px] block mb-0.5">
                            {l.label}
                          </span>
                          <span className="text-on-surface-variant">
                            {highlightPlayer(l.lineup, player.name)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {compos.stale && (
                <p className="text-[10px] text-muted-text text-center italic pt-1">
                  Données mises en cache — le site source est momentanément indisponible.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
