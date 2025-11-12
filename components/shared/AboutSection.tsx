// @/components/shared/AboutSection.tsx

import React from 'react';

export const AboutSection: React.FC = () => (
  <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 mb-8 border border-gray-200 dark:border-gray-800 backdrop-blur-sm">
    <h2 className="text-3xl font-bold text-brand-dark dark:text-white mb-2">Welcome to InkSpace</h2>
    <p className="text-brand-gray">
      InkSpace is the premier digital hub designed to bridge the gap in the tattoo industry. Our mission is to create a seamless ecosystem where talent meets opportunity. For artists, we provide a dynamic marketplace to discover and book guest spots at tattoo shops worldwide, eliminating the friction of finding a temporary creative home. For clients, InkSpace is a curated discovery platform to find and connect with skilled artists who are actively available in their city. We are committed to empowering artists' careers and helping clients find the perfect match for their next piece of body art.
    </p>
  </div>
);