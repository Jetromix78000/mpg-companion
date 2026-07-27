import React, { useState, useEffect, useRef } from "react";
import { Player, InjuryStatus } from "./types";
import { MOCK_PLAYERS, MOCK_TRANSFERS, MOCK_INJURIES } from "./data";
import { POPULAR_PLAYERS, SuggestionPlayer } from "./popularPlayers";
import { matchPlayer, normalizeText } from "./utils/search";
import DashboardView from "./components/DashboardView";
import MarketView from "./components/MarketView";
import ProfileView from "./components/ProfileView";
import InjuriesView from "./components/InjuriesView";
import { PlayerAvatar } from "./components/PlayerAvatar";
import { useAuth } from "./auth/AuthContext";
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  Activity,
  Settings,
  Bell,
  Search,
  X,
  CheckCircle,
  Sparkles,
  Smartphone,
  Volume2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Github,
  MessageSquare,
  Filter,
  Menu,
  LogIn,
  LogOut
} from "lucide-react";

// Messages associés aux redirections d'auth (?auth_error=...) renvoyées par le serveur.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_init: "Connexion Google indisponible pour le moment",
  oauth_refused: "Connexion Google annulée",
  missing_code: "Retour de connexion incomplet",
  exchange_failed: "Session non créée, réessayez",
  missing_token: "Lien de connexion invalide",
  link_expired: "Lien de connexion expiré, demandez-en un nouveau"
};

export default function App() {
  const { user, requestLogin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "market" | "stats" | "injuries">("dashboard");
  const [selectedPlayer, setSelectedPlayer] = useState<Player>(MOCK_PLAYERS[0]); // Default to Mbappé
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showGithubBanner, setShowGithubBanner] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Feedback fields
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("Suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(`Merci ${feedbackName || "Manager"} ! Votre feedback a été partagé avec la communauté collaborative.`, "success");
    setFeedbackMessage("");
    setShowFeedbackModal(false);
  };

  // Manager settings state
  const [managerName, setManagerName] = useState("");
  const [favoriteLeague, setFavoriteLeague] = useState("Ligue 1");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [globalTeamFilter, setGlobalTeamFilter] = useState<string | null>(null);

  // Alert/Toast notifications
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning";
    visible: boolean;
  }>({
    message: "",
    type: "success",
    visible: false
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Clear toast timeout helper
  const showToast = (message: string, type: "success" | "warning" = "success") => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // Retour de connexion : le serveur redirige vers /?auth=success ou /?auth_error=...
  // On informe puis on nettoie l'URL pour ne pas rejouer le message au rechargement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authSuccess = params.get("auth") === "success";
    if (!authError && !authSuccess) return;

    showToast(
      authError ? AUTH_ERROR_MESSAGES[authError] ?? "Connexion impossible" : "Connexion réussie",
      authError ? "warning" : "success"
    );
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mockIds = new Set(MOCK_PLAYERS.map(p => p.id));
  const ALL_SUGGESTION_SEEDS: SuggestionPlayer[] = [
    ...MOCK_PLAYERS.map(p => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      team: p.team,
      positionLong: p.positionLong,
      position: p.position,
      form: p.form,
      avatarUrl: p.avatarUrl
    })),
    ...POPULAR_PLAYERS.filter(p => !mockIds.has(p.id))
  ];

  function handleSelectPlayer(player: Player | SuggestionPlayer) {
    const isFullPlayer = "starts" in player || MOCK_PLAYERS.some(p => p.id === player.id);
    
    if (isFullPlayer) {
      const fullPlayer = "starts" in player ? (player as Player) : MOCK_PLAYERS.find(p => p.id === player.id)!;
      setSelectedPlayer(fullPlayer);
      setActiveTab("stats");
      setShowSearchDropdown(false);
      setSearchQuery("");
    } else {
      setShowSearchDropdown(false);
      setSearchQuery("");
      handleGlobalSearch(player.fullName);
    }
  }

  async function handleGlobalSearch(query: string) {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    
    // 1. First, check if there is an exact/partial match for a player name in our static mock data
    const localMatch = MOCK_PLAYERS.find(
      (p) => matchPlayer(p, cleanQuery)
    );
    
    if (localMatch) {
      handleSelectPlayer(localMatch);
      showToast(`Scout instantané : ${localMatch.fullName}`, "success");
      return;
    }

    // 2. Second, check if the query matches a team
    const lowerQuery = cleanQuery.toLowerCase();
    const teamTerms = [
      "lyon", "paris", "marseille", "psg", "ol", "om", "madrid", "arsenal", "man city", 
      "city", "liverpool", "barcelone", "juventus", "newcastle", "bayer", "milan", 
      "girona", "atletico", "olympique"
    ];
    
    const isTeam = teamTerms.some(term => lowerQuery.includes(term)) ||
                   MOCK_PLAYERS.some(p => p.team.toLowerCase().includes(lowerQuery));

    if (isTeam) {
      let standardTeamName = cleanQuery;
      if (lowerQuery.includes("lyon") || lowerQuery === "ol") {
        standardTeamName = "Olympique Lyonnais";
      } else if (lowerQuery.includes("marseille") || lowerQuery === "om") {
        standardTeamName = "Olympique de Marseille";
      } else if (lowerQuery.includes("paris") || lowerQuery === "psg") {
        standardTeamName = "PSG";
      } else if (lowerQuery.includes("madrid") || lowerQuery.includes("real")) {
        standardTeamName = "Real Madrid";
      } else if (lowerQuery.includes("arsenal")) {
        standardTeamName = "Arsenal FC";
      } else if (lowerQuery.includes("city") || lowerQuery.includes("manchester")) {
        standardTeamName = "Man City";
      } else if (lowerQuery.includes("liverpool")) {
        standardTeamName = "Liverpool";
      } else if (lowerQuery.includes("barcelone") || lowerQuery.includes("barca")) {
        standardTeamName = "FC Barcelone";
      } else if (lowerQuery.includes("juventus") || lowerQuery.includes("juve")) {
        standardTeamName = "Juventus";
      } else {
        // Fallback matching
        const foundPlayer = MOCK_PLAYERS.find(p => p.team.toLowerCase().includes(lowerQuery));
        if (foundPlayer) {
          standardTeamName = foundPlayer.team;
        }
      }

      setGlobalTeamFilter(standardTeamName);
      
      // Select the first player of this team to show in Stats/Profile View
      const teamPlayers = MOCK_PLAYERS.filter(p => p.team === standardTeamName || p.team.toLowerCase().includes(lowerQuery));
      if (teamPlayers.length > 0) {
        setSelectedPlayer(teamPlayers[0]);
        setActiveTab("stats");
        showToast(`Recherche Équipe : ${standardTeamName} activé. Stats affichées pour ${teamPlayers[0].fullName}.`, "success");
      } else {
        showToast(`Recherche Équipe : ${standardTeamName} activé.`, "success");
      }
      return;
    }
    
    setIsSearching(true);
    showToast(`Lancement du scout IA européen pour "${cleanQuery}"...`, "success");
    
    try {
      const res = await fetch(`/api/search-player?query=${encodeURIComponent(cleanQuery)}`);
      if (!res.ok) {
        throw new Error("Erreur de scouting");
      }
      const data = await res.json();
      if (data.player) {
        setSelectedPlayer(data.player);
        setActiveTab("stats");
        showToast(`Joueur scouté avec succès : ${data.player.fullName} (${data.player.team})`, "success");
      } else {
        showToast(`Aucun joueur actif trouvé en Europe pour "${cleanQuery}"`, "warning");
      }
    } catch (err) {
      console.error(err);
      showToast("Une erreur est survenue lors de la recherche IA.", "warning");
    } finally {
      setIsSearching(false);
    }
  }

  // Autocomplete suggestions based on top bar search input (accent-insensitive)
  const filteredSuggestions = searchQuery
    ? ALL_SUGGESTION_SEEDS.filter((p) => matchPlayer(p, searchQuery))
    : [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredSuggestions.length > 0) {
      handleSelectPlayer(filteredSuggestions[0]);
    } else if (searchQuery.trim()) {
      handleGlobalSearch(searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-pitch-dark text-on-surface font-sans antialiased overflow-x-hidden">
      
      {/* Dynamic Toasts / Game notifications */}
      {toast.visible && (
        <div className="fixed top-20 right-4 md:right-8 z-[100] animate-fadeIn max-w-sm">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
            toast.type === "success" 
              ? "bg-surface-glass border-primary-container/20 text-white"
              : "bg-surface-glass border-stat-decrease/20 text-white"
          }`}>
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-primary-container shrink-0 fill-primary-container/10" />
            ) : (
              <AlertCircle className="w-5 h-5 text-stat-decrease shrink-0 fill-stat-decrease/10" />
            )}
            <p className="text-xs font-semibold tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Top Fixed Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 h-16 bg-surface-glass backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 shadow-md">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => {
            setActiveTab("dashboard");
            showToast("Retour à l'accueil", "success");
          }}
        >
          <span className="font-title text-xl md:text-2xl font-black tracking-tighter text-primary-container bg-clip-text text-transparent bg-gradient-to-r from-white to-primary-container">
            MPG Companion
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-white/5 border border-white/10 text-muted-text font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg">
            V1.0
          </span>
        </div>

        {/* Global Search Bar (Desktop) */}
        {activeTab !== "dashboard" ? (
          <div className="hidden md:block flex-1 max-w-md mx-8 relative" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit}>
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary-container transition-colors w-4.5 h-4.5 pointer-events-none" />
                <input
                  className="w-full h-10 pl-11 pr-4 bg-surface-container-high/60 border border-white/10 rounded-full text-xs text-white placeholder-muted-text focus:outline-none focus:ring-1 focus:ring-primary-container focus:border-primary-container transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Rechercher un joueur (Saka, De Bruyne, Kane...)"
                  type="text"
                  autoComplete="off"
                />
              </div>
            </form>

            {/* Autocomplete Suggestions */}
            {showSearchDropdown && searchQuery.trim() && (
              <div className="absolute top-full left-0 w-full mt-2 bg-surface-container-high border border-white/10 rounded-xl shadow-2xl z-[70] overflow-hidden backdrop-blur-md animate-fadeIn">
                <div className="p-2 space-y-1">
                  <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest px-3 py-1.5 border-b border-white/5">
                    Suggestions de Scout
                  </p>
                  {filteredSuggestions.length > 0 ? (
                    <>
                      {filteredSuggestions.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2.5 hover:bg-primary-container/10 cursor-pointer rounded-lg transition-colors group"
                          onClick={() => handleSelectPlayer(item)}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-surface-container-low">
                            <PlayerAvatar
                              src={item.avatarUrl}
                              name={item.fullName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-primary-container transition-colors truncate">
                              {item.fullName}
                            </p>
                            <p className="text-[10px] text-muted-text uppercase font-semibold truncate">
                              {item.team} • {item.positionLong}
                            </p>
                          </div>
                          <span className="text-[10px] bg-primary-container/10 text-primary-container px-2 py-0.5 rounded font-mono font-bold shrink-0">
                            {item.form} Forme
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted-text font-medium">
                        Aucun joueur correspondant trouvé.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:block flex-1 max-w-md mx-8" />
        )}

        {/* Navigation Accessories */}
        <div className="flex items-center gap-3">
          {/* Auth : simple accessoire, aucune rubrique du site n'en dépend */}
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden sm:inline-block max-w-[160px] truncate text-[11px] font-bold text-on-surface-variant"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <button
                className="p-2 text-on-surface-variant hover:text-white active:scale-95 transition-all"
                onClick={async () => {
                  await logout();
                  showToast("Déconnecté", "success");
                }}
                title="Se déconnecter"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              onClick={requestLogin}
            >
              <LogIn className="w-3.5 h-3.5" />
              Connexion
            </button>
          )}
          <button
            className="p-2 text-on-surface-variant hover:text-white relative active:scale-95 transition-all"
            onClick={() => showToast("Aucune nouvelle notification médicale", "success")}
            title="Notifications médicales"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-stat-decrease rounded-full ring-2 ring-pitch-dark"></span>
          </button>
          {/* Burger menu — mobile only */}
          <button
            className="md:hidden p-2 text-on-surface-variant hover:text-white active:scale-95 transition-all"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[80] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-surface-container-low border-r border-white/10 shadow-2xl flex flex-col pt-6 pb-8 px-4 animate-slideInLeft">
            <div className="flex justify-between items-center mb-8 px-2">
              <span className="font-black text-lg text-primary-container tracking-tighter">MPG Companion</span>
              <button
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                onClick={() => setShowMobileMenu(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              {[
                { id: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
                { id: "market",    label: "Marché",          Icon: TrendingUp },
                { id: "stats",     label: "Stats Joueurs",   Icon: Award },
                { id: "injuries",  label: "Blessures",       Icon: Activity },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3 font-bold text-sm transition-all ${
                    activeTab === id
                      ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container"
                      : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => {
                    setActiveTab(id as typeof activeTab);
                    setShowMobileMenu(false);
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </button>
              ))}

              <button
                className="w-full py-3.5 px-4 rounded-xl flex items-center gap-3 font-bold text-sm text-on-surface-variant hover:bg-white/5 hover:text-white transition-all"
                onClick={() => { setShowSettingsModal(true); setShowMobileMenu(false); }}
              >
                <Settings className="w-5 h-5 shrink-0" />
                Paramètres
              </button>
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5">
              <button
                className="w-full py-3 px-4 bg-gradient-to-r from-secondary to-primary-container text-pitch-dark font-black rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                onClick={() => { setShowFeedbackModal(true); setShowMobileMenu(false); }}
              >
                <MessageSquare className="w-4 h-4" />
                Feedbacks
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Side Sidebar for Desktop */}
      <aside className="hidden md:flex h-full w-64 fixed left-0 top-0 pt-24 flex-col bg-surface-container-low border-r border-white/5 shadow-2xl z-40">
        
        {/* Nav lists - Aérée et espacée avec space-y-3.5 et px-4 */}
        <nav className="flex-1 space-y-3.5 px-4">
          <button
            className={`w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 transition-all font-bold text-xs uppercase tracking-wider ${
              activeTab === "dashboard"
                ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
            Tableau de bord
          </button>

          <button
            className={`w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 transition-all font-bold text-xs uppercase tracking-wider ${
              activeTab === "market"
                ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => setActiveTab("market")}
          >
            <TrendingUp className="w-4.5 h-4.5 shrink-0" />
            Marché
          </button>

          <button
            className={`w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 transition-all font-bold text-xs uppercase tracking-wider ${
              activeTab === "stats"
                ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => {
              setActiveTab("stats");
              showToast(`Fiche active : ${selectedPlayer.fullName}`, "success");
            }}
          >
            <Award className="w-4.5 h-4.5 shrink-0" />
            Stats Joueurs
          </button>

          <button
            className={`w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 transition-all font-bold text-xs uppercase tracking-wider ${
              activeTab === "injuries"
                ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => setActiveTab("injuries")}
          >
            <Activity className="w-4.5 h-4.5 shrink-0" />
            Blessures
          </button>

          <button
            className="w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 text-on-surface-variant hover:bg-white/5 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
            onClick={() => {
              setShowSettingsModal(true);
            }}
          >
            <Settings className="w-4.5 h-4.5 shrink-0" />
            Paramètres
          </button>
        </nav>

        {/* GitHub Open Source & Feedbacks Encart - Optimisé et Aéré */}
        <div className="px-4 pb-8 mt-auto">
          <div className="bg-surface-container-high/80 p-4.5 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden group transition-all duration-300 hover:border-primary-container/20">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/5 rounded-full blur-xl group-hover:bg-primary-container/20 transition-all duration-500"></div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <Github className="w-5 h-5 text-primary-container" />
              <span className="text-[10px] text-primary-container font-extrabold uppercase tracking-widest">
                PROJET COLLABORATIF
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4 font-semibold">
              Plateforme de partage collaborative pour les passionnés de football et de MPG.
            </p>
            <button 
              className="w-full py-3 px-4 bg-gradient-to-r from-secondary to-primary-container text-pitch-dark font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-container/5"
              onClick={() => {
                setFeedbackName("");
                setShowFeedbackModal(true);
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Feedbacks
            </button>
          </div>
        </div>
      </aside>

      {/* Main Viewport Container */}
      <main className="pt-20 pb-8 md:pl-64 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
          

          
          {/* Dynamic Tab Rendering */}
          {activeTab === "dashboard" && (
            <DashboardView 
              onSelectPlayer={handleSelectPlayer}
              onSearchQuery={handleGlobalSearch}
              onShowToast={showToast}
            />
          )}

          {activeTab === "market" && (
            <MarketView 
              onSelectPlayer={handleSelectPlayer}
              onShowToast={showToast}
            />
          )}

          {activeTab === "stats" && (
            <ProfileView
              player={selectedPlayer}
              onShowToast={showToast}
            />
          )}

          {activeTab === "injuries" && (
            <InjuriesView 
              onSelectPlayer={handleSelectPlayer}
              onShowToast={showToast}
            />
          )}
        </div>
      </main>


      {/* Modal 1: Feedbacks & Contribution */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative border border-white/10">
            <button 
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
              onClick={() => setShowFeedbackModal(false)}
            >
              <X className="w-4 h-4" />
            </button>
            <form onSubmit={handleFeedbackSubmit} className="p-6 md:p-8 space-y-5">
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-primary-container/10 border border-primary-container/20 text-primary-container font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  <Github className="w-3.5 h-3.5" /> Communauté
                </span>
                <h3 className="text-xl font-black text-white font-title tracking-tight mt-1">
                  Partagez vos Feedbacks !
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Vos suggestions aident la plateforme collaborative de football & MPG à s'améliorer.
                </p>
              </div>

              <div className="space-y-4">
                {/* Votre Pseudo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                    Votre Pseudo
                  </label>
                  <input
                    type="text"
                    required
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder=""
                    className="w-full h-9 bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container px-3"
                  />
                </div>

                {/* Category selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                    Sujet de votre feedback
                  </label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="w-full h-9 bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container px-2 cursor-pointer"
                  >
                    <option value="Statistiques">Statistiques ou Note MPG erronée</option>
                    <option value="Suggestion">Idée de fonctionnalité</option>
                    <option value="Bug">Bug ou Problème d'affichage</option>
                    <option value="OpenSource">Contribuer sur le Github</option>
                  </select>
                </div>

                {/* Feedback Message */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                    Votre Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Écrivez vos suggestions, bugs rencontrés ou encouragements..."
                    className="w-full bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container p-3 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button 
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-primary-container to-secondary text-pitch-dark font-black rounded-xl text-xs uppercase tracking-wider hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Envoyer mon feedbacks
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-text">
                  <span>Projet hébergé sur</span>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline font-bold flex items-center gap-0.5">
                    <Github className="w-3 h-3" /> GitHub
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Settings customization */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative border border-white/10">
            <button 
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
              onClick={() => setShowSettingsModal(false)}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-6 md:p-8 space-y-6">
              <h3 className="text-xl font-bold font-title tracking-tight text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Settings className="w-5 h-5 text-primary-container" />
                Ajuster vos Préférences
              </h3>

              <div className="space-y-4">
                {/* Manager name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-text uppercase tracking-wider">
                    Pseudo
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 bg-surface-container-high border-none text-xs font-semibold rounded-xl text-white focus:ring-2 focus:ring-primary-container px-4"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>

                {/* Championnat favori */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-text uppercase tracking-wider">
                    Ligue Préférée
                  </label>
                  <select
                    className="w-full h-11 bg-surface-container-high border-none text-xs font-semibold rounded-xl text-white focus:ring-2 focus:ring-primary-container px-3 cursor-pointer"
                    value={favoriteLeague}
                    onChange={(e) => setFavoriteLeague(e.target.value)}
                  >
                    <option value="Ligue 1">Ligue 1 Uber Eats</option>
                    <option value="La Liga">La Liga EA Sports</option>
                    <option value="Premier League">Premier League</option>
                    <option value="Serie A">Serie A</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <p className="text-xs font-bold text-white">Alertes Push Médicales</p>
                    <p className="text-[10px] text-muted-text">Alerter en direct si un titulaire est blessé.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-primary-container focus:ring-primary-container bg-surface-container-high border-none"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  className="w-full py-3 bg-primary-container text-on-primary-container font-black rounded-xl text-xs uppercase tracking-wider hover:brightness-105 active:scale-98 transition-all"
                  onClick={() => {
                    showToast("Préférences enregistrées avec succès !", "success");
                    setShowSettingsModal(false);
                  }}
                >
                  Valider les Préférences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global AI Scouting Loader */}
      {isSearching && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-high/90 border border-white/10 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full border-4 border-primary-container border-t-transparent animate-spin mx-auto"></div>
            <h3 className="font-bold text-white text-base">Scouting IA en cours...</h3>
            <p className="text-xs text-on-surface-variant font-semibold">
              Recherche des statistiques réelles de {searchQuery || "votre joueur"} dans tous les clubs d'Europe...
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
