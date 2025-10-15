

import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] bg-red-900/20 border border-red-500/50 rounded-lg p-8 text-center">
      <h3 className="text-2xl font-bold text-red-400 mb-2">An Error Occurred</h3>
      <p className="text-red-300">{message}</p>
      <p className="text-sm text-red-300/70 mt-4">Please check your Gemini API key and try again.</p>
    </div>
  );
};
