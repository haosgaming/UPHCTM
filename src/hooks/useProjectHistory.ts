import { useState, useCallback, useEffect, useRef } from 'react';
import { CadProject } from '../types/cad';

const MAX_HISTORY_STEPS = 50;
const STORAGE_KEY = 'cad_iot_spatial_planner_project_v1';

export interface UseProjectHistoryReturn {
  project: CadProject;
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
  updateProject: (newProject: CadProject | ((prev: CadProject) => CadProject), commitToHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  resetProject: (newProject: CadProject) => void;
}

export function useProjectHistory(initialProject: CadProject): UseProjectHistoryReturn {
  const [past, setPast] = useState<CadProject[]>([]);
  const [present, setPresent] = useState<CadProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load project from localStorage, using initial', e);
    }
    return initialProject;
  });
  const [future, setFuture] = useState<CadProject[]>([]);

  // Keep a ref to present state for callbacks
  const presentRef = useRef(present);
  presentRef.current = present;

  // Persist present to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(present));
    } catch (e) {
      console.error('Failed to save project locally', e);
    }
  }, [present]);

  // Update project state with optional history commitment
  const updateProject = useCallback((
    newProject: CadProject | ((prev: CadProject) => CadProject),
    commitToHistory: boolean = true
  ) => {
    setPresent((prevPresent) => {
      const nextPresent = typeof newProject === 'function' ? newProject(prevPresent) : newProject;

      if (commitToHistory) {
        setPast((prevPast) => {
          // Push previous present into past, truncated to MAX_HISTORY_STEPS
          const updatedPast = [...prevPast, prevPresent];
          if (updatedPast.length > MAX_HISTORY_STEPS) {
            return updatedPast.slice(updatedPast.length - MAX_HISTORY_STEPS);
          }
          return updatedPast;
        });
        // Clear future on new action
        setFuture([]);
      }

      return nextPresent;
    });
  }, []);

  // Undo action
  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;

      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [presentRef.current, ...prevFuture]);
      setPresent(previous);

      return newPast;
    });
  }, []);

  // Redo action
  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => [...prevPast, presentRef.current]);
      setPresent(next);

      return newFuture;
    });
  }, []);

  // Reset project (e.g. on JSON import or clear)
  const resetProject = useCallback((newProject: CadProject) => {
    setPast([]);
    setPresent(newProject);
    setFuture([]);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    project: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pastCount: past.length,
    futureCount: future.length,
    updateProject,
    undo,
    redo,
    resetProject,
  };
}
