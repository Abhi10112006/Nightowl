/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, CheckSquare, LogOut, CheckCircle2, Circle, Activity, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { StudyTask, GoogleCalendarEvent, GoogleTask, GoogleTasksList } from './types';
import { fetchCalendarEvents, fetchTaskLists, fetchTasks, createCalendarEvent, createGoogleTask, updateGoogleTask } from './lib/google-api';
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

export default function App() {
  const [schedule, setSchedule] = useState<StudyTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState<string | null>(null);
  const [history, setHistory] = useState<TrackerHistory>({});
  
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleTasks, setGoogleTasks] = useState<GoogleTask[]>([]);
  const [googleTasklists, setGoogleTasklists] = useState<GoogleTasksList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  
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
  }, []);

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

  // Google Integration
  const handleGoogleLogin = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      console.warn('Google Identity Services library is not loaded yet.');
      return;
    }

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (firebaseConfig as { oAuthClientId?: string })?.oAuthClientId ||
      '';

    if (!clientId) {
      console.error('Missing Google OAuth Client ID.');
      return;
    }
    
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, 
        // Requesting full access to write events and tasks
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks',
        callback: (response: any) => {
          if (response.error) {
            console.error('OAuth error:', response);
            return;
          }
          if (response.access_token) {
            setToken(response.access_token);
            loadGoogleData(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error('Failed to initialize Google token client:', err);
    }
  }, []);

  const loadGoogleData = async (accessToken: string) => {
    setIsLoadingGoogle(true);
    try {
      const events = await fetchCalendarEvents(accessToken);
      setCalendarEvents(events);
      
      const lists = await fetchTaskLists(accessToken);
      setGoogleTasklists(lists);
      if (lists.length > 0) {
        setSelectedListId(lists[0].id);
        const tasks = await fetchTasks(accessToken, lists[0].id);
        setGoogleTasks(tasks);
      }
    } catch (err) {
      console.error('Failed to fetch google data:', err);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const syncToGoogle = async () => {
    if (!token || schedule.length === 0) return;
    
    setIsSyncing(true);
    setSyncStatus('Syncing...');
    try {
      const today = new Date();
      const tzOffset = -today.getTimezoneOffset();
      const dif = tzOffset >= 0 ? '+' : '-';
      const pad = (num: number) => `${Math.floor(Math.abs(num))}`.padStart(2, '0');
      // Format: +05:30
      const timezoneStr = `${dif}${pad(tzOffset / 60)}:${pad(tzOffset % 60)}`;
      
      // Sync Calendar Events
      const dateStr = format(today, 'yyyy-MM-dd');
      
      let syncedCount = 0;
      for (const task of schedule) {
        // e.g. "2023-10-25T09:00:00+05:30"
        const startISO = `${dateStr}T${task.startTime}:00${timezoneStr}`;
        const endISO = `${dateStr}T${task.endTime}:00${timezoneStr}`;
        
        await createCalendarEvent(token, `[Protocol] ${task.title}`, task.desc, startISO, endISO, Intl.DateTimeFormat().resolvedOptions().timeZone);
        syncedCount++;
        
        // Optionally create as a task in the primary list
        if (googleTasklists.length > 0) {
           await createGoogleTask(token, googleTasklists[0].id, `[Protocol] ${task.title}`, `${task.startTime}-${task.endTime}\n${task.desc}`);
        }
      }
      
      setSyncStatus(`Synced ${syncedCount} items successfully!`);
      // refresh data
      await loadGoogleData(token);
      setTimeout(() => setSyncStatus(''), 4000);
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('Sync Failed - Retry');
    } finally {
      setIsSyncing(false);
    }
  };

  const importFromGoogleTasks = async () => {
    if (!token || !selectedListId) return;
    
    setIsImporting(true);
    setSyncStatus('Importing tasks...');
    
    try {
      const tasks = await fetchTasks(token, selectedListId);
      if (tasks.length === 0) {
        setSyncStatus('No tasks found to import.');
        setTimeout(() => setSyncStatus(''), 3000);
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
      
      saveSchedule(newSchedule);
      setCompletedTasks(newCompleted);
      // update local storage for completions
      const completedIds = Object.keys(newCompleted).filter(k => newCompleted[k] && newSchedule.find(t => t.id === k));
      Object.entries(newCompleted).forEach(([id, status]) => {
        localStorage.setItem(`task_${id}`, String(status));
      });
      
      updateTodayProgress(completedIds, newSchedule.length);
      setHistory(getHistory());
      
      setSyncStatus(`Imported ${importedCount} tasks!`);
      setTimeout(() => setSyncStatus(''), 4000);
      
    } catch (err) {
      console.error('Failed to import tasks:', err);
      setSyncStatus('Import failed.');
      setTimeout(() => setSyncStatus(''), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLogout = () => {
    if (token) {
      window.google?.accounts.oauth2.revoke(token, () => {
        setToken(null);
        setCalendarEvents([]);
        setGoogleTasks([]);
      });
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'All day';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-screen p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-[#0a0a0c]/80 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 shadow-2xl border border-white/5 relative">
        <h1 className="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] to-[#4facfe] tracking-wide filter drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]">
          Night Owl Tracker
        </h1>

        {!token && (
          <div className="flex justify-center mb-8">
            <button 
              onClick={handleGoogleLogin}
              className="min-h-[48px] flex items-center gap-2 bg-[#ffffff0a] hover:bg-[#ffffff15] text-white px-6 py-2 rounded-xl border border-white/10 transition-colors shadow-lg hover:shadow-[#00f2fe]/20"
            >
              <Calendar size={18} className="text-[#00f2fe]" />
              Connect Google Calendar & Tasks
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
              <>
                <button 
                  onClick={() => setActiveTab('calendar')}
                  className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
                >
                  <Calendar size={16} /> Calendar
                </button>
                <button 
                  onClick={() => setActiveTab('tasks')}
                  className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
                >
                  <CheckSquare size={16} /> Tasks
                </button>
              </>
            )}
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-[#ffffff15] text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.1)]' : 'text-gray-400 hover:text-white hover:bg-[#ffffff0a]'}`}
            >
              <Activity size={16} /> Analytics
            </button>
          </div>
          
          {token && (
            <button 
              onClick={handleLogout}
              className="text-gray-500 hover:text-[#ff0055] min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl hover:bg-[#ffffff0a] transition-colors"
              title="Disconnect Google"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

        {/* Protocol Tab */}
        {activeTab === 'protocol' && (
          <>
            {token && googleTasklists.length > 0 && (
              <div className="bg-[#ffffff05] border border-[#ffffff10] rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-300">Import from Google Tasks</span>
                  <span className="text-xs text-gray-500">Map your existing tasks to today's protocol.</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={selectedListId} 
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="bg-[#111] text-sm text-gray-300 border border-[#333] rounded-lg px-3 py-2 flex-grow sm:flex-grow-0 min-w-[150px] focus:outline-none focus:border-[#00f2fe]"
                  >
                    {googleTasklists.map(list => (
                      <option key={list.id} value={list.id}>{list.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={importFromGoogleTasks}
                    disabled={isImporting}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-black px-4 py-2 rounded-lg text-sm font-semibold transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap"
                  >
                    {isImporting ? (
                      <><RefreshCw size={16} className="animate-spin" /> Importing...</>
                    ) : (
                      'Sync Tasks'
                    )}
                  </button>
                </div>
              </div>
            )}
            
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
                    {isSyncing ? 'Syncing...' : 'Sync to Google'}
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

            <div className="w-full bg-[#333] rounded-lg mb-6 overflow-hidden h-5">
              <div 
                className="h-full bg-[#00ffcc] transition-all duration-500 ease-out" 
                style={{ width: `${percentage}%`, boxShadow: '0 0 10px rgba(0, 255, 204, 0.5)' }}
              />
            </div>
            <div className="text-center text-sm text-[#aaa] -mt-4 mb-6">
              {percentage}% Completed ({completedCount}/{totalTasks})
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
                    threshold: {
                      x: 0,
                      y: 0.15,
                    },
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
                    dropAnimation={{
                      duration: 220,
                      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                    }}
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
          </>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4 text-white">Today's Events</h2>
            {isLoadingGoogle ? (
              <p className="text-gray-400 text-center py-8">Loading calendar...</p>
            ) : calendarEvents.length > 0 ? (
              calendarEvents.map(event => (
                <div key={event.id} className="p-4 bg-[#222] rounded-lg border-l-4 border-blue-500">
                  <div className="text-xs font-bold text-blue-400 mb-1">
                    {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                  </div>
                  <h3 className="text-base text-white">{event.summary}</h3>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No events scheduled for today.</p>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4 text-white">Google Tasks</h2>
            {isLoadingGoogle ? (
              <p className="text-gray-400 text-center py-8">Loading tasks...</p>
            ) : googleTasks.length > 0 ? (
              googleTasks.map(task => (
                <div key={task.id} className="flex items-start p-4 bg-[#222] rounded-lg">
                  <CheckSquare size={20} className="text-gray-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-base text-white">{task.title}</h3>
                    {task.notes && <p className="text-sm text-[#bbb] mt-1 whitespace-pre-wrap">{task.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No active tasks found.</p>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard history={history} schedule={schedule} />
        )}

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
