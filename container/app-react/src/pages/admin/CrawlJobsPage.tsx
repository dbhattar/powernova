import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { CreateCrawlJobModal } from '@/components/admin/CreateCrawlJobModal';
import { adminService } from '@/lib/adminApi';
import type { CrawlJob } from '@/types/admin';
import {
  Loader,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  StopCircle,
  Link as LinkIcon,
} from 'lucide-react';

export function CrawlJobsPage() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Use ref to track latest jobs without causing re-renders
  const jobsRef = useRef<CrawlJob[]>([]);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getCrawlJobs();
      setJobs(data);
      jobsRef.current = data; // Keep ref in sync
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crawl jobs');
      setJobs([]);
      jobsRef.current = [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadJobs();
    
    // Auto-refresh every 10 seconds if there are running or pending jobs
    const interval = setInterval(() => {
      // Use ref to check current jobs without adding to dependencies
      const hasActiveJobs = jobsRef.current.some(
        job => job.status === 'running' || job.status === 'pending'
      );
      
      if (hasActiveJobs) {
        loadJobs();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount

  const handleCreateJob = async (startUrl: string, maxDepth: number, maxPages: number) => {
    await adminService.createCrawlJob({ 
      start_url: startUrl, 
      max_depth: maxDepth,
      max_pages: maxPages
    });
    setSuccessMessage(`Crawl job created for ${startUrl}`);
    setTimeout(() => setSuccessMessage(''), 5000);
    loadJobs();
  };

  const handleCancelJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to cancel this crawl job?')) {
      return;
    }

    try {
      await adminService.cancelCrawlJob(jobId);
      setSuccessMessage('Crawl job cancelled');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this crawl job? This will remove all associated data.')) {
      return;
    }

    try {
      await adminService.deleteCrawlJob(jobId);
      setSuccessMessage('Crawl job deleted');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'cancelled':
        return <StopCircle className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const runningJobs = jobs.filter(j => j.status === 'running').length;
  const pendingJobs = jobs.filter(j => j.status === 'pending').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Crawl Jobs</h1>
            <p className="text-gray-600 mt-1">Manage web crawling jobs and monitor progress</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadJobs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Crawl Job
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatsCard
            title="Total Jobs"
            value={jobs.length}
            icon={<LinkIcon className="w-5 h-5" />}
          />
          <StatsCard
            title="Running"
            value={runningJobs}
            className="border-l-4 border-l-blue-500"
            icon={<PlayCircle className="w-5 h-5 text-blue-600" />}
          />
          <StatsCard
            title="Pending"
            value={pendingJobs}
            className="border-l-4 border-l-yellow-500"
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
          />
          <StatsCard
            title="Completed"
            value={completedJobs}
            className="border-l-4 border-l-green-500"
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          />
          <StatsCard
            title="Failed"
            value={failedJobs}
            className="border-l-4 border-l-red-500"
            icon={<XCircle className="w-5 h-5 text-red-600" />}
          />
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start URL
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Depth
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{job.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="max-w-md truncate" title={job.start_url}>
                        {job.start_url}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {job.max_depth}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {getStatusIcon(job.status)}
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {job.pages_crawled !== undefined && job.max_pages !== undefined ? (
                        <div>
                          <div className="text-sm">
                            {job.pages_crawled} / {job.max_pages} pages
                          </div>
                          <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${job.max_pages > 0 ? (job.pages_crawled / job.max_pages) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {(job.status === 'running' || job.status === 'pending') && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Cancel job"
                          >
                            <StopCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete job"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {jobs.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                No crawl jobs yet. Create your first crawl job!
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <CreateCrawlJobModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateJob}
      />
    </AdminLayout>
  );
}
