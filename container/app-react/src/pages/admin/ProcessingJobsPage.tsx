import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { adminService } from '@/lib/adminApi';
import type { DocumentJob } from '@/types/admin';
import {
  Loader,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  RotateCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export function ProcessingJobsPage() {
  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Use ref to track latest jobs without causing re-renders
  const jobsRef = useRef<DocumentJob[]>([]);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [jobsData, statsData] = await Promise.all([
        adminService.getDocumentJobs(),
        adminService.getDocumentJobStats(),
      ]);
      // Ensure jobsData is an array
      const jobsList = Array.isArray(jobsData) ? jobsData : [];
      setJobs(jobsList);
      jobsRef.current = jobsList; // Update ref
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processing jobs');
      setJobs([]); // Set to empty array on error
      jobsRef.current = [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadJobs();
    
    // Auto-refresh every 10 seconds if there are processing or pending jobs
    const interval = setInterval(() => {
      // Use ref to check current jobs without adding to dependencies
      const hasActiveJobs = jobsRef.current.some(
        job => job.status === 'processing' || job.status === 'pending'
      );
      
      if (hasActiveJobs) {
        loadJobs();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount

  const handleProcessJobs = async (batchSize = 10) => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await adminService.processDocumentJobs(batchSize);
      setSuccessMessage(`Started processing ${result.processed} jobs`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process jobs');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    try {
      await adminService.retryDocumentJob(jobId);
      setSuccessMessage('Job queued for retry');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      await adminService.deleteDocumentJob(jobId);
      setSuccessMessage('Job deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending').length;
  const processingJobs = jobs.filter(j => j.status === 'processing').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Processing Jobs</h1>
            <p className="text-gray-600 mt-1">Monitor and manage document processing queue</p>
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
              onClick={() => handleProcessJobs(10)}
              disabled={isProcessing || pendingJobs === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              Process Jobs
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Pending"
            value={pendingJobs}
            className="border-l-4 border-l-yellow-500"
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
          />
          <StatsCard
            title="Processing"
            value={processingJobs}
            className="border-l-4 border-l-blue-500"
            icon={<Loader className="w-5 h-5 text-blue-600" />}
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

        {/* Additional Stats */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total || jobs.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Retry Count</p>
                <p className="text-2xl font-bold text-gray-900">
                  {jobs.length > 0 
                    ? (jobs.reduce((sum, j) => sum + j.retry_count, 0) / jobs.length).toFixed(1)
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {jobs.length > 0
                    ? ((completedJobs / jobs.length) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document ID
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retry Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {job.document_id}
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
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {job.retry_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-orange-600">
                          <AlertCircle className="w-4 h-4" />
                          {job.retry_count}
                        </span>
                      ) : (
                        job.retry_count
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Retry job"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        )}
                        {(job.status === 'completed' || job.status === 'failed') && (
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
                No processing jobs in the queue.
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Error Details */}
        {jobs.some(job => job.error_message) && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Errors</h3>
            <div className="space-y-3">
              {jobs
                .filter(job => job.error_message)
                .slice(0, 5)
                .map((job) => (
                  <div key={job.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">
                          Job #{job.id} - Document {job.document_id}
                        </p>
                        <p className="text-sm text-red-700 mt-1">{job.error_message}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
