// Warns before leaving a form with unsaved changes: closing the tab, or moving to another page of the site.
import { useEffect } from 'react';
import { setLeaveGuard } from '../router';

let dirtyForms = 0;

/** Asks before leaving while a form has unsaved changes. Returns true if it's OK to leave. */
export const confirmLeave = () => dirtyForms === 0 || window.confirm('You have unsaved changes. Leave without saving them?');

/** True while any form on the page has unsaved changes. */
export const hasUnsavedChanges = () => dirtyForms > 0;

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    dirtyForms++;
    setLeaveGuard(confirmLeave);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      dirtyForms--;
      if (dirtyForms === 0) setLeaveGuard(null);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);
}
