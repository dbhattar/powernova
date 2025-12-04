import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { AdminLoginModal } from '@/components/admin/AdminLoginModal';
import { adminAuth, adminService } from '@/lib/adminApi';
import type { SystemStats } from '@/types/admin';
import { 
  FileText, 
  Database, 
  Users, 
  Loader,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

export function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(adminAuth.isAuthenticated());
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadStats = async () => {
    if (!adminAuth.isAuthenticated()) {
      setIsAuthenticated(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getSystemStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      // If authentication fails, show login modal
      if (!adminAuth.isAuthenticated()) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    loadStats();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <AdminLoginModal
          isOpen={true}
          onClose={() => navigate('/')}
          onSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
            <p className="text-gray-600 mt-1">Monitor your PowerNOVA system at a glance</p>
          </div>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !stats && (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="space-y-6">
            {/* Crawl Jobs Stats */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crawl Jobs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard
                  title="Total Jobs"
                  value={stats.crawl_jobs.total}
                  icon={<Loader className="w-5 h-5" />}
                  onClick={() => navigate('/admin/content/crawl-jobs')}
                />
                <StatsCard
                  title="Running"
                  value={stats.crawl_jobs.running}
                  label="Active crawlers"
                  className="border-l-4 border-l-blue-500"
                />
                <StatsCard
                  title="Pending"
                  value={stats.crawl_jobs.pending}
                  label="Waiting to start"
                  className="border-l-4 border-l-yellow-500"
                />
                <StatsCard
                  title="Completed"
                  value={stats.crawl_jobs.completed}
                  label="Finished successfully"
                  className="border-l-4 border-l-green-500"
                />
                <StatsCard
                  title="Failed"
                  value={stats.crawl_jobs.failed}
                  label="Needs attention"
                  className="border-l-4 border-l-red-500"
                />
              </div>
            </div>

            {/* Documents Stats */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Total Documents"
                  value={stats.documents.total}
                  icon={<FileText className="w-5 h-5" />}
                  onClick={() => navigate('/admin/content/documents')}
                />
                <StatsCard
                  title="With Embeddings"
                  value={stats.documents.with_embeddings}
                  label={`${stats.documents.total > 0 ? Math.round((stats.documents.with_embeddings / stats.documents.total) * 100) : 0}% complete`}
                  className="border-l-4 border-l-green-500"
                />
                <StatsCard
                  title="Processing"
                  value={stats.documents.processing}
                  label="Currently processing"
                  className="border-l-4 border-l-blue-500"
                />
                <StatsCard
                  title="Failed"
                  value={stats.documents.failed}
                  label="Needs attention"
                  className="border-l-4 border-l-red-500"
                />
              </div>
            </div>

            {/* Embeddings Stats */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Embeddings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatsCard
                  title="Documents with Chunks"
                  value={stats.embeddings.documents_with_chunks}
                  label="New embedding system"
                  icon={<Database className="w-5 h-5" />}
                  className="border-l-4 border-l-green-500"
                />
                <StatsCard
                  title="Old Embeddings"
                  value={stats.embeddings.documents_with_old_embeddings}
                  label="Needs migration"
                  className="border-l-4 border-l-yellow-500"
                  onClick={() => navigate('/admin/content/embeddings')}
                />
                <StatsCard
                  title="Total Chunks"
                  value={stats.embeddings.total_chunks}
                  label="Document chunks"
                  icon={<Database className="w-5 h-5" />}
                />
              </div>
            </div>

            {/* Users Stats */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Users</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatsCard
                  title="Total Users"
                  value={stats.users.total}
                  icon={<Users className="w-5 h-5" />}
                  onClick={() => navigate('/admin/users')}
                />
                <StatsCard
                  title="Active Users"
                  value={stats.users.active}
                  className="border-l-4 border-l-green-500"
                />
              </div>
            </div>

            {/* Migration Progress */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Migration Progress</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Embedding Migration
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {stats.embeddings.documents_with_chunks} of {stats.documents.total} documents migrated to new chunk system
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-gray-900">
                      {stats.embeddings.migration_progress.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-500 flex items-center justify-end px-2"
                    style={{ width: `${stats.embeddings.migration_progress}%` }}
                  >
                    {stats.embeddings.migration_progress > 10 && (
                      <span className="text-xs font-medium text-white">
                        {stats.embeddings.migration_progress.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/admin/content/crawl-jobs')}
                  className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
                >
                  <Loader className="w-8 h-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Start Crawl Job</h3>
                  <p className="text-sm text-gray-600">Create a new web crawling task</p>
                </button>
                
                <button
                  onClick={() => navigate('/admin/users')}
                  className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
                >
                  <Users className="w-8 h-8 text-indigo-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Manage Users</h3>
                  <p className="text-sm text-gray-600">Create and manage user accounts</p>
                </button>
                
                <button
                  onClick={() => navigate('/admin/data-quality')}
                  className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
                >
                  <Database className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Data Quality</h3>
                  <p className="text-sm text-gray-600">Check for duplicates and anomalies</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
