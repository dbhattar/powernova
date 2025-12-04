import { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Database, 
  Users, 
  MessageSquare,
  Menu,
  X,
  LogOut,
  FolderOpen,
  AlertTriangle,
  Loader,
} from 'lucide-react';
import { adminAuth } from '@/lib/adminApi';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Content',
    path: '/admin/content',
    icon: <FolderOpen className="w-5 h-5" />,
    children: [
      { label: 'Crawl Jobs', path: '/admin/content/crawl-jobs', icon: <Loader className="w-4 h-4" /> },
      { label: 'Documents', path: '/admin/content/documents', icon: <FileText className="w-4 h-4" /> },
      { label: 'Embeddings', path: '/admin/content/embeddings', icon: <Database className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Data Quality',
    path: '/admin/data-quality',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    label: 'Processing',
    path: '/admin/processing',
    icon: <Loader className="w-5 h-5" />,
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Feedback',
    path: '/admin/feedback',
    icon: <MessageSquare className="w-5 h-5" />,
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>(['/admin/content']);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    adminAuth.clearAdminKey();
    navigate('/admin');
  };

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.path);

    return (
      <div key={item.path}>
        <Link
          to={!hasChildren ? item.path : '#'}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.path);
            }
          }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            depth > 0 ? 'ml-6' : ''
          } ${
            active && !hasChildren
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {item.icon}
          <span className="flex-1 font-medium">{item.label}</span>
          {hasChildren && (
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </Link>
        
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children!.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <i className="fas fa-bolt text-2xl bg-gradient-to-br from-purple-600 to-indigo-600 bg-clip-text text-transparent"></i>
            <div>
              <h1 className="text-lg font-bold text-gray-900">PowerNOVA</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {navigationItems.map(item => renderNavItem(item))}
          </div>
        </nav>

        {/* Logout button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-gray-600">
                <i className="fas fa-shield-alt mr-2"></i>
                Admin Mode
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
