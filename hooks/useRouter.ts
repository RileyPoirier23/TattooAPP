// @/hooks/useRouter.ts
import { useState, useEffect } from 'react';

export const useRouter = () => {
  const [path, setPath] = useState(window.location.pathname);

  const handlePopState = () => {
    setPath(window.location.pathname);
  };

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  return { path, navigate };
};
