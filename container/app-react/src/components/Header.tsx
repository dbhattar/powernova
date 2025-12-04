import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { LoginModal } from './LoginModal';

interface HeaderProps {
  variant: 'chat' | 'search' | 'profile';
}

export function Header({ variant }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3 relative">
        {/* Logo Section */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <i className="fas fa-bolt text-2xl bg-gradient-to-br from-purple-600 to-indigo-600 bg-clip-text text-transparent"></i>
            {variant === 'chat' ? (
              <h1 className="text-xl font-bold text-gray-900">
                PowerNOVA{' '}
                <span className="text-sm font-semibold bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg ml-2">
                  Chat
                </span>{' '}
                <span className="text-xs font-semibold bg-gradient-to-br from-orange-500 to-orange-600 text-white px-2 py-1 rounded-lg ml-2 uppercase tracking-wide shadow-sm">
                  Beta
                </span>
              </h1>
            ) : variant === 'profile' ? (
              <h1 className="text-xl font-bold text-gray-900">
                PowerNOVA{' '}
                <span className="text-sm font-semibold bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg ml-2">
                  Profile
                </span>{' '}
                <span className="text-xs font-semibold bg-gradient-to-br from-orange-500 to-orange-600 text-white px-2 py-1 rounded-lg ml-2 uppercase tracking-wide shadow-sm">
                  Beta
                </span>
              </h1>
            ) : (
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <h1 className="text-xl font-bold text-gray-900">
                  PowerNOVA{' '}
                  <span className="text-sm font-semibold bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg ml-2">
                    Search
                  </span>{' '}
                  <span className="text-xs font-semibold bg-gradient-to-br from-orange-500 to-orange-600 text-white px-2 py-1 rounded-lg ml-2 uppercase tracking-wide shadow-sm">
                    Beta
                  </span>
                </h1>
              </Link>
            )}
          </div>
        </div>

        {/* Inline Search Bar - Only on Chat page, hidden on mobile */}
        {variant === 'chat' && (
          <div className={`hidden md:flex flex-1 max-w-lg mx-8 ${showMobileSearch ? 'md:hidden' : ''}`}>
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus-within:bg-gray-50 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <i className="fas fa-search text-gray-500 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400 min-w-0"
                  placeholder="Search documents..."
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Search"
                >
                  <i className="fas fa-arrow-right text-gray-500 text-sm"></i>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mobile Search Expanded - Positioned absolutely */}
        {showMobileSearch && variant === 'chat' && (
          <div className="absolute top-full left-0 right-0 p-3 bg-white border-b border-gray-200 md:hidden z-50 animate-slideDown">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100">
                <i className="fas fa-search text-gray-500 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400"
                  placeholder="Search documents..."
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <i className="fas fa-arrow-right text-gray-500 text-sm"></i>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile Search Toggle - Chat page only */}
          {variant === 'chat' && (
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
              title="Search Documents"
            >
              <i className="fas fa-search text-gray-600"></i>
            </button>
          )}

          {/* Back to Chat - Search page only */}
          {variant === 'search' && (
            <Link
              to="/"
              className="min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
              title="Back to Chat"
            >
              <i className="fas fa-comments text-gray-600"></i>
            </Link>
          )}

          {/* Profile Page Navigation */}
          {variant === 'profile' && (
            <>
              <Link
                to="/"
                className="min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                title="Back to Chat"
              >
                <i className="fas fa-comments text-gray-600"></i>
              </Link>
              <Link
                to="/search"
                className="min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                title="Search Documents"
              >
                <i className="fas fa-search text-gray-600"></i>
              </Link>
            </>
          )}

          {/* User Menu Button / Login Button */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors"
                title="Account"
              >
                <i className="fas fa-user-circle text-gray-600"></i>
                <span className="hidden sm:inline text-sm font-medium text-gray-900">
                  {user.username}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[45]"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-12 z-[60] w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <i className="fas fa-user w-4"></i>
                      <span>My Profile</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <i className="fas fa-sign-out-alt w-4"></i>
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="min-w-[40px] h-10 px-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
              title="Login"
              onClick={() => setShowLoginModal(true)}
            >
              <i className="fas fa-user text-gray-600"></i>
            </button>
          )}
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </header>
  );
}
