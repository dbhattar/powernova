import { Wrench, Loader2 } from 'lucide-react';

interface MaintenanceScreenProps {
  message: string;
  estimatedDuration?: string;
}

export function MaintenanceScreen({ message, estimatedDuration }: MaintenanceScreenProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full mb-6">
          <Wrench className="w-10 h-10 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          We'll Be Right Back!
        </h1>

        {/* Message */}
        <p className="text-lg text-gray-600 mb-6">
          {message}
        </p>

        {/* Estimated Duration */}
        {estimatedDuration && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg mb-8">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">Estimated Duration: {estimatedDuration}</span>
          </div>
        )}

        {/* Loading Spinner */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm text-gray-500">Checking status...</p>
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          This page will automatically refresh when maintenance is complete.
          <br />
          Thank you for your patience!
        </p>

        {/* PowerNOVA Branding */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            <span className="text-sm font-medium">PowerNOVA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
