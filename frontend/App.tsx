import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Player } from "../shared/types";
import DashboardView from "./components/DashboardView";
import MarketView from "./components/MarketView";
import ProfileView from "./components/ProfileView";
import InjuriesView from "./components/InjuriesView";
import { PlayerAvatar } from "./components/PlayerAvatar";
import { useAuth } from "./auth/useAuth";
import { errorMessage } from "./api";
import { useAppDispatch, useAppSelector } from "./store";
import { playerSelected, resultsCleared, searchPlayers } from "./reducers/players";
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  Activity,
  Bell,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  LogIn,
  LogOut,
} from "lucide-react";

type Tab = "dashboard" | "market" | "stats" | "injuries";

/** Un onglet = une URL. La racine "/" redirige vers /dashboard. */
const TAB_PATHS: Record<Tab, string> = {
  dashboard: "/dashboard",
  market: "/market",
  stats: "/stats",
  injuries: "/injuries",
};

function tabFromPathname(pathname: string): Tab {
  const match = (Object.entries(TAB_PATHS) as [Tab, string][]).find(([, path]) => path === pathname);
  return match ? match[0] : "dashboard";
}

/** Délai avant d'interroger le serveur pendant la frappe, en millisecondes. */
const SEARCH_DEBOUNCE_MS = 250;

export default function App() {
  const dispatch = useAppDispatch();
  const { user, logout, requestLogin } = useAuth();
  const { selected: selectedPlayer, results } = useAppSelector((state) => state.players);

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPathname(location.pathname);
  const setActiveTab = (tab: Tab) => navigate(TAB_PATHS[tab]);

  // Racine et chemins inconnus retombent sur le dashboard, sans casser l'URL saisie.
  useEffect(() => {
    if (!Object.values(TAB_PATHS).includes(location.pathname)) {
      navigate(TAB_PATHS.dashboard, { replace: true });
    }
  }, [location.pathname, navigate]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Alert/Toast notifications
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning";
    visible: boolean;
  }>({
    message: "",
    type: "success",
    visible: false,
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

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // L'autocomplétion interroge GET /api/players/search. Le délai évite un
  // aller-retour par caractère frappé.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      dispatch(resultsCleared());
      return;
    }

    const timer = setTimeout(() => {
      dispatch(searchPlayers(query));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [dispatch, searchQuery]);

  /** Ouvre une fiche déjà complète, sans aller-retour serveur. */
  function handleSelectPlayer(player: Player) {
    dispatch(playerSelected(player));
    setActiveTab("stats");
    setShowSearchDropdown(false);
    setSearchQuery("");
  }

  /**
   * Recherche par nom de joueur ou d'équipe, puis ouverture de la première fiche.
   * Le Marché et le Centre des blessures s'en servent pour ouvrir un joueur dont
   * ils ne connaissent que le nom.
   */
  async function handleGlobalSearch(query: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setShowSearchDropdown(false);
    setSearchQuery("");

    try {
      const players = await dispatch(searchPlayers(cleanQuery)).unwrap();

      if (players.length > 0) {
        handleSelectPlayer(players[0]);
        showToast(`Fiche active : ${players[0].fullName}`, "success");
      } else {
        showToast(`Aucun joueur trouvé pour "${cleanQuery}"`, "warning");
      }
    } catch (error: unknown) {
      showToast(errorMessage(error), "warning");
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelectPlayer(results[0]);
      showToast(`Fiche active : ${results[0].fullName}`, "success");
    } else if (searchQuery.trim()) {
      handleGlobalSearch(searchQuery);
    }
  };

  const NAV_ITEMS: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
    { id: "market", label: "Marché", Icon: TrendingUp },
    { id: "stats", label: "Stats Joueurs", Icon: Award },
    { id: "injuries", label: "Blessures", Icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-pitch-dark text-on-surface font-sans antialiased overflow-x-hidden">
      {/* Dynamic Toasts / Game notifications */}
      {toast.visible && (
        <div className="fixed top-20 right-4 md:right-8 z-[100] animate-fadeIn max-w-sm">
          <div
            className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-surface-glass border-primary-container/20 text-white"
                : "bg-surface-glass border-stat-decrease/20 text-white"
            }`}
          >
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
                  placeholder="Rechercher un joueur (Dembélé, David, Lacazette...)"
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
                  {results.length > 0 ? (
                    results.map((item) => (
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
                    ))
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
              className="hidden sm:flex items-center gap-1.5 py-2 px-4 rounded-full bg-gradient-to-r from-secondary to-primary-container text-pitch-dark text-[11px] font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary-container/20"
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
              <span className="font-black text-lg text-primary-container tracking-tighter">
                MPG Companion
              </span>
              <button
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                onClick={() => setShowMobileMenu(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              {NAV_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3 font-bold text-sm transition-all ${
                    activeTab === id
                      ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container"
                      : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => {
                    setActiveTab(id);
                    setShowMobileMenu(false);
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Side Sidebar for Desktop */}
      <aside className="hidden md:flex h-full w-64 fixed left-0 top-0 pt-24 flex-col bg-surface-container-low border-r border-white/5 shadow-2xl z-40">
        <nav className="flex-1 space-y-3.5 px-4">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`w-full py-3.5 px-4.5 rounded-xl flex items-center gap-3.5 transition-all font-bold text-xs uppercase tracking-wider ${
                activeTab === id
                  ? "bg-primary-container/10 text-primary-container border-l-4 border-primary-container shadow-sm"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => {
                setActiveTab(id);
                if (id === "stats" && selectedPlayer) {
                  showToast(`Fiche active : ${selectedPlayer.fullName}`, "success");
                }
              }}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
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
            <MarketView onOpenPlayerByName={handleGlobalSearch} onShowToast={showToast} />
          )}

          {activeTab === "stats" && <ProfileView player={selectedPlayer} onShowToast={showToast} />}

          {activeTab === "injuries" && (
            <InjuriesView onOpenPlayerByName={handleGlobalSearch} onShowToast={showToast} />
          )}
        </div>
      </main>
    </div>
  );
}
