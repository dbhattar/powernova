import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../hooks/useProfile';
import { Header } from '../components/Header';
import { Upload, X, Loader2, User, Lock, Check, AlertCircle, FolderOpen, FileText, MessageSquare, Book } from 'lucide-react';
import { ProcessingStatus } from '../components/ui/ProcessingStatus';
import type { UserDocument } from '@/types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  currentEmail: string;
  onSave: (username: string) => Promise<void>;
}

function EditProfileModal({ isOpen, onClose, currentUsername, currentEmail, onSave }: EditProfileModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setUsername(currentUsername);
  }, [currentUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSave(username);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="editUsername" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="editUsername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={1}
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (cannot be changed)
              </label>
              <input
                type="email"
                value={currentEmail}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}

function ChangePasswordModal({ isOpen, onClose, onSubmit }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Change Password</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Change Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const {
    profile,
    documents,
    isLoadingProfile,
    isLoadingDocuments,
    updateProfile,
    changePassword,
    uploadDocument,
    currentScope,
    setCurrentScope,
    refetchDocuments,
  } = useProfile();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Use ref to track documents without triggering re-renders
  const documentsRef = useRef<UserDocument[]>([]);
  
  // Sync ref with documents
  useEffect(() => {
    if (documents) {
      documentsRef.current = documents;
    }
  }, [documents]);
  
  // Auto-refresh when documents are processing
  useEffect(() => {
    const hasProcessingDocs = documentsRef.current.some(
      (doc) => doc.processing_status === 'pending' || doc.processing_status === 'processing'
    );
    
    if (!hasProcessingDocs) {
      return; // No processing documents, no need to poll
    }
    
    const interval = setInterval(() => {
      const stillProcessing = documentsRef.current.some(
        (doc) => doc.processing_status === 'pending' || doc.processing_status === 'processing'
      );
      
      if (stillProcessing) {
        refetchDocuments();
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []); // Empty deps - use ref to avoid re-creating interval

  const handleEditProfile = async (username: string) => {
    await updateProfile.mutateAsync({ username });
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await changePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword });
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const validTypes = ['.pdf', '.docx', '.txt', '.md'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(fileExt)) {
      alert('Supported file types: PDF, DOCX, TXT, MD');
      return;
    }

    try {
      setUploadProgress(0);
      await uploadDocument.mutateAsync(file);
      // Reset file input
      e.target.value = '';
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (error: any) {
      alert(error.message || 'Failed to upload document');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredDocuments = documents?.filter((doc: UserDocument) => {
    if (currentScope === 'all') return true;
    return doc.document_scope === currentScope;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="profile" />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : profile ? (
          <>
            {/* Profile Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{profile.username}</h2>
                      <p className="text-gray-600">{profile.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {profile.is_active && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Active
                        </span>
                      )}
                      {profile.is_verified && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <div className="text-2xl font-bold text-gray-900">{profile.total_conversations}</div>
                      <div className="text-xs text-gray-600">Conversations</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <div className="text-2xl font-bold text-gray-900">{profile.total_documents}</div>
                      <div className="text-xs text-gray-600">Documents</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <div className="text-2xl font-bold text-gray-900">{profile.total_messages}</div>
                      <div className="text-xs text-gray-600">Messages</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-gray-900">My Documents</h3>
                <label className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload to Library
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleUploadDocument}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-800">Uploading document...</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setCurrentScope('all')}
                  className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
                    currentScope === 'all'
                      ? 'border-purple-600 text-purple-600 font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  All Documents
                </button>
                <button
                  onClick={() => setCurrentScope('user')}
                  className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
                    currentScope === 'user'
                      ? 'border-purple-600 text-purple-600 font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Book className="w-4 h-4" />
                  My Library
                </button>
                <button
                  onClick={() => setCurrentScope('conversation')}
                  className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
                    currentScope === 'conversation'
                      ? 'border-purple-600 text-purple-600 font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  In Conversations
                </button>
              </div>

              {/* Documents List */}
              {isLoadingDocuments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h4>
                  <p className="text-gray-600 mb-4">
                    Upload documents to your library to access them across all conversations
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload Document
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleUploadDocument}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredDocuments.map((doc: UserDocument) => (
                    <div
                      key={doc.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            <h4 className="font-medium text-gray-900 truncate">{doc.title}</h4>
                            {doc.processing_status && (
                              <ProcessingStatus status={doc.processing_status} size="sm" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">{formatFileSize(doc.file_size)}</span>
                            </span>
                            <span>•</span>
                            <span>{formatDate(doc.created_at)}</span>
                            {doc.conversation_title && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {doc.conversation_title}
                                </span>
                              </>
                            )}
                          </div>
                          {doc.embedding_generated && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                              <Check className="w-3 h-3" />
                              Indexed ({doc.chunk_count} chunks)
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            doc.status === 'processed'
                              ? 'bg-green-100 text-green-800'
                              : doc.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load profile</h3>
            <p className="text-gray-600">Please try refreshing the page</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {profile && (
        <>
          <EditProfileModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            currentUsername={profile.username}
            currentEmail={profile.email}
            onSave={handleEditProfile}
          />
          <ChangePasswordModal
            isOpen={showPasswordModal}
            onClose={() => setShowPasswordModal(false)}
            onSubmit={handleChangePassword}
          />
        </>
      )}
    </div>
  );
}
