// @/components/shared/ErrorDisplay.tsx

import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-brand-dark p-8 text-center">
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-8 max-w-2xl">
        <h3 className="text-2xl font-bold text-red-400 mb-2">An Error Occurred</h3>
        <p className="text-red-300">{message}</p>
        <p className="text-sm text-red-300/70 mt-4">
          This is often caused by a network issue, missing environment variables in your deployment, or incorrect Supabase Row Level Security (RLS) policies.
          <br />
          Please consult the <strong>Troubleshooting Wiki</strong> section in the <code>README.md</code> file for solutions.
        </p>
      </div>
    </div>
  );
};