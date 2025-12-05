import { useState, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, ArrowLeft, Check, AlertCircle } from 'lucide-react';

interface AccountRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin?: () => void;
}

export function AccountRequestModal({ isOpen, onClose, onBackToLogin }: AccountRequestModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setCompany('');
    setJustification('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate justification length
    if (justification.trim().length < 20) {
      setError('Please provide at least 20 characters explaining why you need access.');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${apiUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: justification.trim(),
          request_type: 'account_request',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        resetForm();
        
        // Close modal after 3 seconds
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        throw new Error(data.detail || 'Failed to submit request');
      }
    } catch (err: any) {
      console.error('Account request error:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📝</span>
            <h2 className="text-xl font-bold text-gray-900">Request Account Access</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-green-900 mb-1">Request Submitted!</h3>
                <p className="text-sm text-green-800">
                  Thank you! Your request has been submitted successfully. We'll review your request and contact you via email.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <p className="text-sm text-gray-600 mb-4">
              Fill out the form below to request access to PowerNOVA. We'll review your request and contact you via email.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label htmlFor="requestName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="requestName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                  autoFocus
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="requestEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="requestEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  This email will be used for your account login
                </p>
              </div>

              {/* Company Field */}
              <div>
                <label htmlFor="requestCompany" className="block text-sm font-medium text-gray-700 mb-1">
                  Company/Organization <span className="text-red-500">*</span>
                </label>
                <input
                  id="requestCompany"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your company name"
                  autoComplete="organization"
                  required
                />
              </div>

              {/* Justification Field */}
              <div>
                <label htmlFor="requestJustification" className="block text-sm font-medium text-gray-700 mb-1">
                  Why do you need access?{' '}
                  <span className="text-gray-500 font-normal">(min. 20 characters)</span>
                </label>
                <textarea
                  id="requestJustification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Please explain your use case for PowerNOVA..."
                  rows={4}
                  minLength={20}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {justification.length}/20 characters minimum
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            {onBackToLogin ? (
              <button
                onClick={() => {
                  handleClose();
                  onBackToLogin();
                }}
                className="text-sm text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </button>
            ) : (
              <p className="text-xs text-gray-600 text-center">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Close
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
