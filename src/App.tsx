/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, CheckSquare, LogOut, CheckCircle2, Circle, Activity, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, X, User } from 'lucide-react';
import { StudyTask, GoogleCalendarEvent, GoogleTask, GoogleTasksList, GoogleUserProfile } from './types';
import { fetchCalendarEvents, fetchTaskLists, fetchTasks, createCalendarEvent, createGoogleTask, updateGoogleTask, fetchUserProfile } from './lib/google-api';
import { getAdjustedDate, getHistory, updateTodayProgress, getStreak, TrackerHistory, HistoryRecord } from './lib/history';
import { format, subDays, parseISO } from 'date-fns';
import { TaskModal } from './components/TaskModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SortableTaskItem } from './components/SortableTaskItem';
import { UndoToast } from './components/UndoToast';
import firebaseConfig from '../firebase-applet-config.json';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  TouchSensor,
  DragOverlay,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const DEFAULT_SCHEDULE: StudyTask[] = [
  { id: 't1', startTime: '09:00', endTime: '10:00', title: 'Wake Up & Fuel', desc: 'Hydrate, light meal, sunlight.', studyHours: 0, priority: 'Medium' },
  { id: 't2', startTime: '10:00', endTime: '11:00', title: 'Physical Training (1 hr)', desc: 'Core exercises & stretching.', studyHours: 0, priority: 'High' },
  { id: 't3', startTime: '11:00', endTime: '11:30', title: 'Post-Workout Recovery', desc: 'Shower & high-protein snack.', studyHours: 0, priority: 'Low' },
  { id: 't4', startTime: '11:30', endTime: '14:30', title: 'Study Block 1 (3 hrs)', desc: 'Heavy reading & conceptual work.', studyHours: 3, priority: 'High' },
  { id: 't5', startTime: '14:30', endTime: '16:00', title: 'Lunch & Mental Reset', desc: 'Step away completely.', studyHours: 0, priority: 'Medium' }
];

export const getCalendarColor = (colorId?: string) => {
  const colors: Record<string, { bg: string, text: string, border: string }> = {
    '1': { bg: 'bg-[#7986cb]/20', text: 'text-[#7986cb]', border: 'border-[#7986cb]' }, // Lavender
    '2': { bg: 'bg-[#33b679]/20', text: 'text-[#33b679]', border: 'border-[#33b679]' }, // Sage
    '3': { bg: 'bg-[#8e24aa]/20', text: 'text-[#ba68c8]', border: 'border-[#8e24aa]' }, // Grape
    '4': { bg: 'bg-[#e67c73]/20', text: 'text-[#e67c73]', border: 'border-[#e67c73]' }, // Flamingo
    '5': { bg: 'bg-[#f6c026]/20', text: 'text-[#f6c026]', border: 'border-[#f6c026]' }, // Banana
    '6': { bg: 'bg-[#f5511d]/20', text: 'text-[#f5511d]', border: 'border-[#f5511d]' }, // Tangerine
    '7': { bg: 'bg-[#039be5]/20', text: 'text-[#039be5]', border: 'border-[#039be5]' }, // Peacock
    '8': { bg: 'bg-[#616161]/20', text: 'text-[#a1a1a1]', border: 'border-[#616161]' }, // Graphite
    '9': { bg: 'bg-[#3f51b5]/20', text: 'text-[#7986cb]', border: 'border-[#3f51b5]' }, // Blueberry
    '10': { bg: 'bg-[#0b8043]/20', text: 'text-[#33b679]', border: 'border-[#0b8043]' }, // Basil
    '11': { bg: 'bg-[#d60000]/20', text: 'text-[#e67c73]', border: 'border-[#d60000]' }, // Tomato
    'default': { bg: 'bg-[#00f2fe]/10', text: 'text-[#00f2fe]', border: 'border-[#00f2fe]/50' }
  };
  return colors[colorId || 'default'] || colors['default'];
};

export default function App() {
  const [schedule, setSchedule] = useState<StudyTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_access_token');
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('google_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [history, setHistory] = useState<TrackerHistory>({});
  
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleTasks, setGoogleTasks] = useState<GoogleTask[]>([]);
  const [googleTasklists, setGoogleTasklists] = useState<GoogleTasksList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [googleError, setGoogleError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'protocol' | 'calendar' | 'tasks' | 'analytics'>('protocol');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deletedTaskState, setDeletedTaskState] = useState<{
    task: StudyTask;
    index: number;
    isCompleted: boolean;
  } | null>(null);

  // Load from local storage
  useEffect(() => {
    const savedSchedule = localStorage.getItem('trackerSchedule');
    const loadedSchedule = savedSchedule ? JSON.parse(savedSchedule) : DEFAULT_SCHEDULE;
    setSchedule(loadedSchedule);

    const currentDate = getAdjustedDate();
    const savedDate = localStorage.getItem('trackerDate');
    const fullHistory = getHistory();
    setHistory(fullHistory);
    
    if (savedDate !== currentDate) {
      localStorage.setItem('trackerDate', currentDate);
      loadedSchedule.forEach((task: StudyTask) => localStorage.removeItem(`task_${task.id}`));
      setCompletedTasks({});
      updateTodayProgress([], loadedSchedule.length);
    } else {
      const state: Record<string, boolean> = {};
      loadedSchedule.forEach((task: StudyTask) => {
        state[task.id] = localStorage.getItem(`task_${task.id}`) === 'true';
      });
      setCompletedTasks(state);
    }

    // Restore Google data if session token is active
    const savedToken = localStorage.getItem('google_access_token');
    if (savedToken) {
      loadGoogleData(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token && selectedListId) {
      fetchTasks(token, selectedListId)
        .then(setGoogleTasks)
        .catch(err => console.error('Failed to fetch tasks on list change:', err));
    }
  }, [selectedListId, token]);

  const saveSchedule = (newSchedule: StudyTask[]) => {
    setSchedule(newSchedule);
    localStorage.setItem('trackerSchedule', JSON.stringify(newSchedule));
    
    // update today's progress based on new schedule
    const completedIds = Object.keys(completedTasks).filter(k => completedTasks[k] && newSchedule.find(t => t.id === k));
    updateTodayProgress(completedIds, newSchedule.length);
    setHistory(getHistory());
  };

  const handleSaveTask = (task: StudyTask) => {
    let newSchedule;
    if (editingTask) {
      newSchedule = schedule.map(t => t.id === task.id ? task : t);
    } else {
      newSchedule = [...schedule, task];
      newSchedule.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    saveSchedule(newSchedule);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 }, // Immediate click & drag for desktop mouse
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 }, // 300ms deliberate hold to drag; swiping freely scrolls the page
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40); // Subtle 40ms haptic feedback on pick up
      } catch {
        // Safe fallback if permission is restricted
      }
    }
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSchedule((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        const newSchedule = arrayMove(items, oldIndex, newIndex) as StudyTask[];
        saveSchedule(newSchedule);
        return newSchedule;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDeleteTask = (id: string) => {
    const taskIndex = schedule.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const taskToDelete = schedule[taskIndex];
    const wasCompleted = Boolean(completedTasks[id]);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch {
        // Safe fallback
      }
    }

    // Set deleted task in undo state
    setDeletedTaskState({
      task: taskToDelete,
      index: taskIndex,
      isCompleted: wasCompleted,
    });

    // Remove from current active schedule immediately
    const newSchedule = schedule.filter(t => t.id !== id);
    saveSchedule(newSchedule);
    
    const newCompleted = { ...completedTasks };
    delete newCompleted[id];
    setCompletedTasks(newCompleted);
  };

  const handleUndoDelete = useCallback(() => {
    if (!deletedTaskState) return;

    const { task, index, isCompleted } = deletedTaskState;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([25, 40, 25]);
      } catch {
        // Safe fallback
      }
    }

    // Restore to its original index in the list
    setSchedule(prev => {
      const restored = [...prev];
      const targetIndex = Math.min(Math.max(0, index), restored.length);
      restored.splice(targetIndex, 0, task);
      localStorage.setItem('trackerSchedule', JSON.stringify(restored));

      // Update completions
      if (isCompleted) {
        setCompletedTasks(c => {
          const nextC = { ...c, [task.id]: true };
          localStorage.setItem(`task_${task.id}`, 'true');
          const completedIds = Object.keys(nextC).filter(k => nextC[k] && restored.find(t => t.id === k));
          updateTodayProgress(completedIds, restored.length);
          setHistory(getHistory());
          return nextC;
        });
      } else {
        const completedIds = Object.keys(completedTasks).filter(k => completedTasks[k] && restored.find(t => t.id === k));
        updateTodayProgress(completedIds, restored.length);
        setHistory(getHistory());
      }

      return restored;
    });

    setDeletedTaskState(null);
  }, [deletedTaskState, completedTasks]);

  const handleDismissUndo = useCallback(() => {
    if (deletedTaskState) {
      localStorage.removeItem(`task_${deletedTaskState.task.id}`);
      setDeletedTaskState(null);
    }
  }, [deletedTaskState]);

  // Global Ctrl+Z / Cmd+Z shortcut to undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (deletedTaskState) {
          e.preventDefault();
          handleUndoDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletedTaskState, handleUndoDelete]);

  const toggleTask = async (id: string) => {
    let newState = false;
    setCompletedTasks(prev => {
      newState = !prev[id];
      localStorage.setItem(`task_${id}`, String(newState));
      
      const nextState = { ...prev, [id]: newState };
      const completedIds = Object.keys(nextState).filter(k => nextState[k] && schedule.find(t => t.id === k));
      updateTodayProgress(completedIds, schedule.length);
      setHistory(getHistory());
      
      return nextState;
    });

    const task = schedule.find(t => t.id === id);
    if (task && task.isGoogleTask && task.googleListId && token) {
      try {
        await updateGoogleTask(token, task.googleListId, task.id, newState ? 'completed' : 'needsAction');
      } catch (err) {
        console.error('Failed to update Google Task:', err);
      }
    }
  };

  const completedCount = schedule.filter(t => completedTasks[t.id]).length;
  const totalTasks = schedule.length;
  const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const streak = getStreak();

  const loadGoogleData = async (accessToken: string) => {
    setIsLoadingGoogle(true);
    setGoogleError(null);
    const errors: string[] = [];

    try {
      // Concurrently fetch profile, calendar events, and task lists
      const [profileResult, eventsResult, listsResult] = await Promise.allSettled([
        fetchUserProfile(accessToken),
        fetchCalendarEvents(accessToken),
        fetchTaskLists(accessToken),
      ]);

      // 1. Profile
      if (profileResult.status === 'fulfilled' && profileResult.value) {
        setUserProfile(profileResult.value);
        try {
          localStorage.setItem('google_user_profile', JSON.stringify(profileResult.value));
        } catch {
          // ignore
        }
      }

      // 2. Calendar Events
      if (eventsResult.status === 'fulfilled') {
        setCalendarEvents(eventsResult.value);
      } else {
        const msg = (eventsResult.reason as Error)?.message || 'Failed to load Calendar events';
        errors.push(`Calendar: ${msg}`);
      }

      // 3. Task Lists
      if (listsResult.status === 'fulfilled') {
        const lists = listsResult.value;
        setGoogleTasklists(lists);
        if (lists.length > 0) {
          const defaultListId = selectedListId || lists[0].id;
          setSelectedListId(defaultListId);
          try {
            const tasks = await fetchTasks(accessToken, defaultListId);
            setGoogleTasks(tasks);
          } catch (taskErr: any) {
            errors.push(`Tasks: ${taskErr.message || 'Failed to load tasks'}`);
          }
        }
      } else {
        const msg = (listsResult.reason as Error)?.message || 'Failed to load Task lists';
        errors.push(`Tasks: ${msg}`);
      }

      if (errors.length > 0) {
        setGoogleError(
          errors.join(' | ') + '. (Note: Ensure Google Calendar API & Google Tasks API are enabled in your Google Cloud Console).'
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch google data:', err);
      setGoogleError(err.message || 'Unable to communicate with Google services.');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // Google Integration
  const handleGoogleLogin = useCallback(() => {
    setGoogleError(null);

    if (!window.google?.accounts?.oauth2) {
      setGoogleError('Google Sign-In library is still loading. Please wait a moment and try again.');
      return;
    }

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (firebaseConfig as { oAuthClientId?: string })?.oAuthClientId ||
      '';

    if (!clientId) {
      setGoogleError('Missing Google OAuth Client ID. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.');
      return;
    }

    setIsConnectingGoogle(true);
    
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, 
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
        error_callback: (err: any) => {
          setIsConnectingGoogle(false);
          console.error('Google OAuth error callback:', err);
          const errorMsg = err?.message || (err?.type ? `OAuth issue: ${err.type}` : 'Sign-in popup was closed or blocked.');
          setGoogleError(errorMsg);
        },
        callback: async (response: any) => {
          setIsConnectingGoogle(false);
          if (response.error) {
            console.error('OAuth response error:', response);
            setGoogleError(`Sign-in error: ${response.error_description || response.error}`);
            return;
          }
          if (response.access_token) {
            setToken(response.access_token);
            try {
              localStorage.setItem('google_access_token', response.access_token);
            } catch {
              // ignore
            }
            setSyncStatus('Connected to Google! Syncing data...');
            await loadGoogleData(response.access_token);
            setTimeout(() => setSyncStatus(''), 4000);
          }
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      setIsConnectingGoogle(false);
      console.error('Failed to initialize Google token client:', err);
      setGoogleError(`Sign-in initialization failed: ${err.message || 'Unknown error'}`);
    }
  }, [selectedListId]);

  const getTaskISO = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    
    const baseDate = new Date(now);
    if (baseDate.getHours() < 2) {
      baseDate.setDate(baseDate.getDate() - 1);
    }
    
    const taskDate = new Date(baseDate);
    if (hours < 2) {
      taskDate.setDate(taskDate.getDate() + 1);
    }
    
    taskDate.setHours(hours, minutes, 0, 0);
    
    const tzOffset = -taskDate.getTimezoneOffset();
    const dif = tzOffset >= 0 ? '+' : '-';
    const pad = (num: number) => `${Math.floor(Math.abs(num))}`.padStart(2, '0');
    const timezoneStr = `${dif}${pad(tzOffset / 60)}:${pad(tzOffset % 60)}`;
    
    const dateStr = format(taskDate, 'yyyy-MM-dd');
    return `${dateStr}T${timeStr}:00${timezoneStr}`;
  };

  const syncToGoogle = async () => {
    if (!token || schedule.length === 0) return;
    
    setIsSyncing(true);
    setSyncStatus('Syncing to Google Calendar & Tasks...');
    try {
      let syncedCount = 0;
      for (const task of schedule) {
        const startISO = getTaskISO(task.startTime);
        const endISO = getTaskISO(task.endTime);
        
        await createCalendarEvent(token, `[Protocol] ${task.title}`, task.desc, startISO, endISO, Intl.DateTimeFormat().resolvedOptions().timeZone);
        syncedCount++;
        
        // Optionally create as a task in the primary list
        if (googleTasklists.length > 0) {
           await createGoogleTask(token, googleTasklists[0].id, `[Protocol] ${task.title}`, `${task.startTime}-${task.endTime}\n${task.desc}`);
        }
      }
      
      setSyncStatus(`Synced ${syncedCount} items to Google Calendar & Tasks!`);
      await loadGoogleData(token);
      setTimeout(() => setSyncStatus(''), 4000);
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncStatus(`Sync Failed: ${error.message || 'Check permissions'}`);
      setGoogleError(`Sync Failed: ${error.message || 'Check Google Calendar & Tasks permissions'}`);
      setTimeout(() => setSyncStatus(''), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const importFromGoogleTasks = async () => {
    if (!token || !selectedListId) return;
    
    setIsImporting(true);
    setSyncStatus('Importing tasks from Google...');
    
    try {
      const tasks = await fetchTasks(token, selectedListId);
      setGoogleTasks(tasks);
      
      if (tasks.length === 0) {
        setSyncStatus('No tasks found in this Google Task list.');
        setTimeout(() => setSyncStatus(''), 4000);
        setIsImporting(false);
        return;
      }
      
      const newSchedule = [...schedule];
      const newCompleted = { ...completedTasks };
      
      let importedCount = 0;
      for (const t of tasks) {
        // deduplicate and update status
        const existingTask = newSchedule.find(s => s.id === t.id);
        if (existingTask) {
          if (t.status === 'completed') newCompleted[t.id] = true;
          else if (t.status === 'needsAction') newCompleted[t.id] = false;
          continue;
        }
        
        let startTime = '12:00';
        let endTime = '13:00';
        let studyHours = 1;
        
        // Try to parse [HH:MM - HH:MM] from notes
        if (t.notes) {
          const timeMatch = t.notes.match(/\[?(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]?/);
          if (timeMatch) {
            startTime = timeMatch[1];
            endTime = timeMatch[2];
          }
        }
        
        newSchedule.push({
          id: t.id,
          title: t.title.trim(),
          desc: t.notes || '',
          startTime,
          endTime,
          studyHours,
          priority: 'Medium',
          isGoogleTask: true,
          googleListId: selectedListId,
        });
        
        if (t.status === 'completed') {
          newCompleted[t.id] = true;
        }
        
        importedCount++;
      }
      
      newSchedule.sort((a, b) => a.startTime.localeCompare(b.startTime));
      saveSchedule(newSchedule);
      setCompletedTasks(newCompleted);
      // update local storage for completions
      const completedIds = Object.keys(newCompleted).filter(k => newCompleted[k] && newSchedule.find(t => t.id === k));
      Object.entries(newCompleted).forEach(([id, status]) => {
        localStorage.setItem(`task_${id}`, String(status));
      });
      
      updateTodayProgress(completedIds, newSchedule.length);
      setHistory(getHistory());
      
      setSyncStatus(`Imported ${importedCount} tasks from Google!`);
      setTimeout(() => setSyncStatus(''), 4000);
      
    } catch (err: any) {
      console.error('Failed to import tasks:', err);
      setSyncStatus(`Import failed: ${err.message || 'Error fetching tasks'}`);
      setGoogleError(`Google Tasks import failed: ${err.message || 'Check Tasks API permissions'}`);
      setTimeout(() => setSyncStatus(''), 5000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLogout = () => {
    if (token && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {
          // Token revoked
        });
      } catch {
        // ignore
      }
    }
    setToken(null);
    setUserProfile(null);
    setCalendarEvents([]);
    setGoogleTasks([]);
    setGoogleTasklists([]);
    try {
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_user_profile');
    } catch {
      // ignore
    }
    setSyncStatus('Disconnected from Google.');
    setTimeout(() => setSyncStatus(''), 3000);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'All day';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-screen p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-[#0a0a0c]/80 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 shadow-2xl border border-white/5 relative">
        <h1 className="text-3xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] to-[#4facfe] tracking-wide filter drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]">
          Night Owl Tracker
        </h1>
        <p className="text-center text-xs text-gray-400 mb-6">Productivity Protocol & Focus Routine</p>

        {/* Google Error / Diagnostics Notification */}
        {googleError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3 relative">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-grow pr-6">
              <p className="font-semibold mb-0.5">Google Integration Notice</p>
              <p className="text-xs text-amber-200/90 leading-relaxed">{googleError}</p>
            </div>
            <button
              onClick={() => setGoogleError(null)}
              className="absolute right-3 top-3 text-amber-400 hover:text-amber-200 p-1"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Google Connection Header */}
        {!token ? (
          <div className="flex justify-center mb-8">
            <button 
              onClick={handleGoogleLogin}
              disabled={isConnectingGoogle}
              className="min-h-[48px] flex items-center gap-2.5 bg-[#ffffff0a] hover:bg-[#ffffff15] text-white px-6 py-2.5 rounded-xl border border-white/10 transition-all shadow-lg hover:shadow-[#00f2fe]/20 hover:border-[#00f2fe]/40 active:scale-95 disabled:opacity-50"
            >
              {isConnectingGoogle ? (
                <RefreshCw size={18} className="text-[#00f2fe] animate-spin" />
              ) : (
                <Calendar size={18} className="text-[#00f2fe]" />
              )}
              <span>{isConnectingGoogle ? 'Connecting to Google...' : 'Connect Google Calendar & Tasks'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 mb-6 text-sm">
            <div className="flex items-center gap-3">
              {userProfile?.picture ? (
                <img 
                  src={userProfile.picture} 
                  alt="Profile" 
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-[#00f2fe]/50 object-cover" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#00f2fe]/20 text-[#00f2fe] flex items-center justify-center font-bold text-xs">
                  {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User size={14} />}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                  {userProfile?.name || 'Google Connected'}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                </span>
                <span className="text-[11px] text-gray-400">{userProfile?.email || 'Calendar & Tasks Sync Active'}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-500/20 transition-all flex items-center gap-1"
            >
              <LogOut size={13} /> Disconnect
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4 bg-[#ffffff05] p-2 rounded-xl border border-white/5">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('protocol')}
              className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'protocol' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
            >
              Protocol
            </button>
            {token && (
              <button 
                onClick={() => setActiveTab('calendar')}
                className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
              >
                <Calendar size={16} /> Calendar
              </button>
            )}
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
            >
              <Activity size={16} /> Analytics
            </button>
          </div>
          
        </div>

        <AnimatePresence mode="wait">
        {/* Protocol Tab */}
        {activeTab === 'protocol' && (
          <motion.div 
            key="protocol"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`grid grid-cols-1 ${token ? 'lg:grid-cols-[1.5fr_1fr] gap-8' : 'gap-4'}`}
          >
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Daily Protocol</h2>
                <div className="flex gap-2">
                  {token && schedule.length > 0 && (
                    <button
                      onClick={syncToGoogle}
                      disabled={isSyncing}
                      className="flex items-center gap-2 bg-[#0055ff]/10 text-[#5588ff] hover:bg-[#0055ff]/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-[#0055ff]/20 disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                      {isSyncing ? 'Syncing...' : 'Sync to Calendar'}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-[#00ffcc]/10 text-[#00ffcc] hover:bg-[#00ffcc]/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-[#00ffcc]/30"
                  >
                    <Plus size={16} /> Add Task
                  </button>
                </div>
              </div>
              
              {syncStatus && (
                <div className="mb-4 text-sm text-center py-2 rounded bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/20">
                  {syncStatus}
                </div>
              )}

              <div className="w-full bg-white/5 rounded-full mb-6 overflow-hidden h-5 relative border border-white/10 shadow-inner">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#00f2fe] to-[#4facfe] relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                >
                  <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 mix-blend-overlay"></div>
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference drop-shadow-md tracking-wider">
                  {percentage}% COMPLETED ({completedCount}/{totalTasks})
                </div>
              </div>

              <div className="w-full">
                {schedule.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 border border-dashed border-[#333] rounded-lg">
                    No tasks scheduled. Add one to get started!
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    autoScroll={{
                      threshold: { x: 0, y: 0.15 },
                      acceleration: 15,
                      interval: 10,
                    }}
                  >
                    <div className="relative space-y-3 min-h-[60px]">
                      <SortableContext items={schedule.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {schedule.map(task => (
                          <SortableTaskItem
                            key={task.id}
                            task={task}
                            isCompleted={completedTasks[task.id]}
                            toggleTask={toggleTask}
                            setEditingTask={setEditingTask}
                            setIsModalOpen={setIsModalOpen}
                            handleDeleteTask={handleDeleteTask}
                          />
                        ))}
                      </SortableContext>
                    </div>
                    <DragOverlay 
                      dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}
                      adjustScale={false}
                    >
                      {activeId ? (
                        <SortableTaskItem
                          task={schedule.find(t => t.id === activeId)!}
                          isCompleted={completedTasks[activeId]}
                          toggleTask={() => {}}
                          setEditingTask={() => {}}
                          setIsModalOpen={() => {}}
                          handleDeleteTask={() => {}}
                          isOverlay={true}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            </div>

            {token && (
              <div className="flex flex-col bg-[#ffffff02] rounded-2xl p-4 border border-white/5 h-fit">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <CheckSquare className="text-[#00f2fe]" size={18} />
                    Google Tasks
                  </h2>
                  <div className="flex items-center gap-2">
                    {googleTasklists.length > 0 && (
                      <select 
                        value={selectedListId} 
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="bg-[#111] text-xs text-gray-300 border border-[#333] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00f2fe] max-w-[120px] truncate"
                      >
                        {googleTasklists.map(list => (
                          <option key={list.id} value={list.id}>{list.title}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={importFromGoogleTasks}
                      disabled={isImporting}
                      className="flex items-center justify-center gap-1.5 bg-[#ffffff0a] hover:bg-[#ffffff15] text-[#00f2fe] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border border-white/10 disabled:opacity-50"
                      title="Import these tasks into your Daily Protocol"
                    >
                      <RefreshCw size={12} className={isImporting ? "animate-spin" : ""} />
                      Import
                    </button>
                  </div>
                </div>
                
                {isLoadingGoogle ? (
                  <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-[#00f2fe]" /></div>
                ) : googleTasks.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                    {googleTasks.map(task => (
                      <div key={task.id} className="group flex items-start p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl transition-colors">
                        <button 
                          onClick={() => {
                            if (token && selectedListId) {
                              setGoogleTasks(prev => prev.filter(t => t.id !== task.id));
                              updateGoogleTask(token, selectedListId, task.id, 'completed').catch(err => console.error(err));
                            }
                          }}
                          className="text-gray-500 hover:text-[#00f2fe] mr-3 mt-0.5 flex-shrink-0 transition-colors cursor-pointer"
                          title="Mark as completed in Google Tasks"
                        >
                          <Circle size={18} />
                        </button>
                        <div>
                          <h3 className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug">{task.title}</h3>
                          {task.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{task.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/[0.01] border border-white/5 rounded-xl mt-2">
                    <CheckSquare className="mx-auto text-gray-600 mb-3" size={28} />
                    <p className="text-xs text-gray-400">No active tasks found.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <motion.div 
            key="calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
              <Calendar className="text-[#00f2fe]" size={20} />
              Today's Timeline
            </h2>
            {isLoadingGoogle ? (
              <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-[#00f2fe]" /></div>
            ) : calendarEvents.length > 0 ? (
              <div className="relative pl-4 border-l-2 border-white/10 space-y-6">
                {calendarEvents.map(event => {
                  const colors = getCalendarColor(event.colorId);
                  let isCurrent = false;
                  if (event.start.dateTime && event.end.dateTime) {
                    const now = new Date();
                    isCurrent = now >= new Date(event.start.dateTime) && now <= new Date(event.end.dateTime);
                  }
                  return (
                    <div key={event.id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 border-[#0a0a0c] ${colors.bg.replace('/20', '/100')} ${isCurrent ? 'ring-2 ring-white/50 animate-pulse bg-white' : ''}`} />
                      
                      <div className={`p-4 rounded-xl border ${colors.border} ${colors.bg} ${isCurrent ? 'ring-1 ring-white/20 shadow-lg' : ''} transition-all`}>
                        <div className={`text-xs font-bold ${colors.text} mb-1.5 flex items-center justify-between`}>
                          <span>{formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}</span>
                          {isCurrent && <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase">Now</span>}
                        </div>
                        <h3 className="text-base text-white font-medium">{event.summary}</h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-white/[0.02] border border-white/5 rounded-xl">
                <Calendar className="mx-auto text-gray-600 mb-3" size={32} />
                <p className="text-gray-400">No events scheduled for today.</p>
              </div>
            )}
          </motion.div>
        )}



        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyticsDashboard history={history} schedule={schedule} />
          </motion.div>
        )}
        </AnimatePresence>

      </div>
      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
      />
      <UndoToast
        isVisible={Boolean(deletedTaskState)}
        taskTitle={deletedTaskState?.task.title || ''}
        duration={6000}
        onUndo={handleUndoDelete}
        onDismiss={handleDismissUndo}
      />
    </div>
  );
}
