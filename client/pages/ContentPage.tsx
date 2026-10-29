// Admin-editable content page (FAQ, policies, terms…).
import React, { useEffect } from 'react';
import { Markdown } from '../lib/markdown';
import { useStore } from '../store';
import { Card, EmptyState, PageLoader, useApi } from '../components/ui';
import type { Page } from '../../shared/types';

export const ContentPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { data, error, loading } = useApi<Page>(`/pages/${slug}`);
  const siteName = useStore(s => s.config!.settings.siteName);
  useEffect(() => {
    if (data) document.title = `${data.title} · ${siteName}`;
    return () => {
      document.title = siteName;
    };
  }, [data, siteName]);

  if (error) return <Card className="max-w-md mx-auto mt-10"><EmptyState title="Page not found" /></Card>;
  if (loading || !data) return <PageLoader />;
  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-display mb-3">{data.title}</h1>
      <p className="text-xs text-brand-gray mb-6">Last updated {new Date(data.updatedAt).toLocaleDateString()}</p>
      <Markdown text={data.body} className="text-gray-700 dark:text-gray-300" />
    </article>
  );
};
