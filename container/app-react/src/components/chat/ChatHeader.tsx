import { Menu, Search, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
}

export function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3">
            <i className="fas fa-bolt text-2xl bg-gradient-to-br from-purple-600 to-indigo-600 bg-clip-text text-transparent"></i>
            <h1 className="text-xl font-bold text-gray-900">
              PowerNOVA{' '}
              <span className="text-sm font-semibold bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg ml-2">
                Chat
              </span>{' '}
              <span className="text-xs font-semibold bg-gradient-to-br from-orange-500 to-orange-600 text-white px-2 py-1 rounded-lg ml-2 uppercase tracking-wide shadow-sm">
                Beta
              </span>
            </h1>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <Link
            to="/search"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Search documents"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </Link>

          {/* User menu */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-900">
                  {user.username}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600">Not logged in</div>
          )}
        </div>
      </div>
    </header>
  );
}
