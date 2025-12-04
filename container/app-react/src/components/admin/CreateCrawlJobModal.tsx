import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateCrawlJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (startUrl: string, maxDepth: number, maxPages: number) => Promise<void>;
}

export function CreateCrawlJobModal({ isOpen, onClose, onSubmit }: CreateCrawlJobModalProps) {
  const [startUrl, setStartUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate URL
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(startUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    if (maxDepth < 0 || maxDepth > 10) {
      setError('Depth must be between 0 and 10');
      return;
    }

    if (maxPages < 1 || maxPages > 1000) {
      setError('Max pages must be between 1 and 1000');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(startUrl, maxDepth, maxPages);
      // Reset form
      setStartUrl('');
      setMaxDepth(2);
      setMaxPages(100);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create crawl job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setStartUrl('');
      setMaxDepth(2);
      setMaxPages(100);
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create Crawl Job</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Start URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start URL *
            </label>
            <input
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="mt-1 text-sm text-gray-500">
              The URL where the crawler will start. The crawler will follow links within the same domain.
            </p>
          </div>

          {/* Max Depth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Crawl Depth
            </label>
            <input
              type="number"
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value))}
              min={0}
              max={10}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="mt-1 text-sm text-gray-500">
              How many levels deep to crawl (0-10). Higher values take longer. 0 = only the start URL.
            </p>
          </div>

          {/* Max Pages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Pages
            </label>
            <input
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value))}
              min={1}
              max={1000}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="mt-1 text-sm text-gray-500">
              Maximum number of pages to crawl (1-1000). Prevents runaway crawls.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Crawl Job Info</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• The crawler will follow links within the same domain</li>
              <li>• Each page will be processed and stored as a document</li>
              <li>• Embeddings will be generated automatically after crawling</li>
              <li>• You can monitor progress in real-time on this page</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
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
              {isSubmitting ? 'Creating...' : 'Create Crawl Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
