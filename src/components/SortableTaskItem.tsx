import React from 'react';
import { StudyTask } from '../types';
import { CheckCircle2, Circle, Edit2, Trash2 } from 'lucide-react';

interface SortableTaskItemProps {
  task: StudyTask;
  isCompleted: boolean;
  toggleTask: (id: string) => void;
  setEditingTask: (task: StudyTask) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  handleDeleteTask: (id: string) => void;
}

export const SortableTaskItem: React.FC<SortableTaskItemProps> = ({
  task,
  isCompleted,
  toggleTask,
  setEditingTask,
  setIsModalOpen,
  handleDeleteTask,
}) => {
  const priorityColor = task.priority === 'High' ? 'text-red-400' : task.priority === 'Medium' ? 'text-yellow-400' : 'text-blue-400';
  const priorityBorder = task.priority === 'High' ? 'border-l-red-400' : task.priority === 'Medium' ? 'border-l-yellow-400' : 'border-l-blue-400';

  return (
    <div
      className={`group flex items-center p-4 bg-[#222] rounded-2xl transition-all duration-300 ease-out border-l-4 ${
        isCompleted ? 'border-l-[#4CAF50] opacity-75 bg-[#222]/80' : priorityBorder
      } relative shadow-md shadow-black/30 hover:shadow-lg hover:bg-[#272727] select-none`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleTask(task.id);
        }}
        className="mr-4 flex-shrink-0 flex items-center justify-center w-12 h-12 text-[#00ffcc] hover:scale-110 active:scale-95 transition-transform focus:outline-none rounded-full"
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted ? <CheckCircle2 size={30} className="text-[#00ffcc]" fill="rgba(0, 255, 204, 0.2)" /> : <Circle size={30} />}
      </button>

      <div className="flex-grow pr-20">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xs font-bold text-[#00ffcc]">
            {task.startTime} - {task.endTime}
          </div>
          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-[#111] ${priorityColor}`}>
            {task.priority}
          </span>
        </div>
        <h3 className={`text-base font-medium mb-1 ${isCompleted ? 'line-through text-[#888]' : 'text-[#e0e0e0]'}`}>
          {task.title}
        </h3>
        {task.desc && <p className="text-sm text-[#bbb] leading-relaxed line-clamp-2">{task.desc}</p>}
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-90 sm:opacity-75 group-hover:opacity-100 transition-opacity">
        <button
          id={`edit-task-btn-${task.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          className="p-2 text-gray-400 hover:text-[#00ffcc] hover:bg-white/10 active:scale-90 rounded-lg transition-all cursor-pointer"
          title="Edit Task"
        >
          <Edit2 size={16} />
        </button>
        <button
          id={`delete-task-btn-${task.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.id);
          }}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/15 active:scale-90 rounded-lg transition-all cursor-pointer"
          title="Delete Task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
