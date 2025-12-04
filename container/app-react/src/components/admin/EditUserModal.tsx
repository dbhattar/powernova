import { useState, FormEvent, useEffect } from 'react';
import { X } from 'lucide-react';
import type { AdminUser, UserUpdate } from '@/types/admin';

interface EditUserModalProps {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (id: number, user: UserUpdate) => Promise<void>;
  onResetPassword: (id: number) => Promise<{ password: string }>;
}

export function EditUserModal({ isOpen, user, onClose, onSubmit, onResetPassword }: EditUserModalProps) {
  const [formData, setFormData] = useState<UserUpdate>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        username: user.username,
        full_name: user.full_name || '',
        is_active: user.is_active,
        is_superuser: user.is_superuser,
      });
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit(user.id, formData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;

    setError('');
    setIsSubmitting(true);

    try {
      const result = await onResetPassword(user.id);
      setNewPassword(result.password);
      setShowResetPassword(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setError('');
    setNewPassword('');
    setShowResetPassword(false);
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                value={formData.full_name || ''}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_superuser ?? false}
                  onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Superuser</span>
              </label>
            </div>

            {/* Password Reset Section */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reset Password
              </button>
            </div>

            {showResetPassword && newPassword && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">New Password Generated</h4>
                <div className="bg-white p-3 rounded border border-green-300 font-mono text-sm break-all">
                  {newPassword}
                </div>
                <p className="text-xs text-green-700 mt-2">
                  ⚠️ Save this password now. It won't be shown again.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
