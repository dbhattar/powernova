import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { adminService } from '@/lib/adminApi';
import type { Feedback, FeedbackUpdate } from '@/types/admin';
import {
  MessageSquare,
  RefreshCw,
  Trash2,
  Mail,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  X,
} from 'lucide-react';

interface FeedbackModalProps {
  feedback: Feedback | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: number, update: FeedbackUpdate) => Promise<void>;
}

function FeedbackModal({ feedback, isOpen, onClose, onUpdate }: FeedbackModalProps) {
  const [status, setStatus] = useState<'new' | 'in_progress' | 'resolved'>('new');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (feedback) {
      setStatus(feedback.status);
      setAdminNotes(feedback.admin_notes || '');
    }
  }, [feedback]);

  if (!isOpen || !feedback) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onUpdate(feedback.id, { status, admin_notes: adminNotes });
      onClose();
    } catch (err) {
      console.error('Failed to update feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Feedback Details</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Feedback Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700">{feedback.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href={`mailto:${feedback.email}`} className="text-blue-600 hover:underline">
                {feedback.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              {new Date(feedback.created_at).toLocaleString()}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{feedback.message}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'new' | 'in_progress' | 'resolved')}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                disabled={isSubmitting}
                placeholder="Add internal notes about this feedback..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadFeedbacks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getFeedback();
      setFeedbacks(data);
      setFilteredFeedbacks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  useEffect(() => {
    let filtered = feedbacks;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(f => f.status === filterStatus);
    }

    setFilteredFeedbacks(filtered);
  }, [feedbacks, filterStatus]);

  const handleUpdateFeedback = async (id: number, update: FeedbackUpdate) => {
    await adminService.updateFeedback(id, update);
    setSuccessMessage('Feedback updated successfully');
    setTimeout(() => setSuccessMessage(''), 5000);
    loadFeedbacks();
  };

  const handleDeleteFeedback = async (id: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      await adminService.deleteFeedback(id);
      setSuccessMessage('Feedback deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadFeedbacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback');
    }
  };

  const handleViewFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setShowModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      case 'in_progress':
        return <Loader className="w-4 h-4 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const newFeedbacks = feedbacks.filter(f => f.status === 'new').length;
  const inProgressFeedbacks = feedbacks.filter(f => f.status === 'in_progress').length;
  const resolvedFeedbacks = feedbacks.filter(f => f.status === 'resolved').length;

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feedback Management</h1>
            <p className="text-gray-600 mt-1">Review and manage user feedback</p>
          </div>
          <button
            onClick={loadFeedbacks}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
            title="Total Feedback"
            value={feedbacks.length}
            icon={<MessageSquare className="w-5 h-5" />}
          />
          <StatsCard
            title="New"
            value={newFeedbacks}
            className="border-l-4 border-l-blue-500"
            icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
          />
          <StatsCard
            title="In Progress"
            value={inProgressFeedbacks}
            className="border-l-4 border-l-yellow-500"
            icon={<Loader className="w-5 h-5 text-yellow-600" />}
          />
          <StatsCard
            title="Resolved"
            value={resolvedFeedbacks}
            className="border-l-4 border-l-green-500"
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('new')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              New
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'in_progress'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterStatus('resolved')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'resolved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Feedback Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                {filteredFeedbacks.map((feedback) => (
                  <tr
                    key={feedback.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewFeedback(feedback)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{feedback.name}</div>
                        <div className="text-sm text-gray-500">{feedback.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md truncate text-sm text-gray-600">
                        {feedback.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          feedback.status
                        )}`}
                      >
                        {getStatusIcon(feedback.status)}
                        {feedback.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFeedback(feedback.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete feedback"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredFeedbacks.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                {filterStatus !== 'all'
                  ? `No ${filterStatus.replace('_', ' ')} feedback found`
                  : 'No feedback yet'}
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

      {/* Feedback Modal */}
      <FeedbackModal
        feedback={selectedFeedback}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedFeedback(null);
        }}
        onUpdate={handleUpdateFeedback}
      />
    </AdminLayout>
  );
}
