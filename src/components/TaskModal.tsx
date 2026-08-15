import React, { useState, useEffect } from 'react';
import { StudyTask } from '../types';
import { X } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: StudyTask) => void;
  task?: StudyTask;
}

export function TaskModal({ isOpen, onClose, onSave, task }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDesc(task.desc);
      setStartTime(task.startTime);
      setEndTime(task.endTime);
      setPriority(task.priority);
    } else {
      setTitle('');
      setDesc('');
      setStartTime('09:00');
      setEndTime('10:00');
      setPriority('Medium');
    }
    setError('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    onSave({
      id: task?.id || Date.now().toString(),
      title: title.trim(),
      desc: desc.trim(),
      startTime,
      endTime,
      priority,
      studyHours: hours
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-[#333]">
          <h2 className="text-xl font-bold text-[#00ffcc]">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#333] transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-400/10 p-2 rounded border border-red-400/20">{error}</div>}
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all"
              placeholder="e.g. Deep Work Session"
              maxLength={60}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Time</label>
              <input 
                type="time" 
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00ffcc] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Time</label>
              <input 
                type="time" 
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00ffcc] transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <select 
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00ffcc] transition-all"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full bg-[#222] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00ffcc] transition-all min-h-[80px]"
              placeholder="Details, focus areas, materials needed..."
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-[#00ffcc]/10 text-[#00ffcc] hover:bg-[#00ffcc]/20 border border-[#00ffcc]/30 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
