import React from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StudyTask } from '../types';
import { CheckCircle2, Circle, Edit2, Trash2 } from 'lucide-react';

interface SortableTaskItemProps {
  task: StudyTask;
  isCompleted: boolean;
  toggleTask: (id: string) => void;
  setEditingTask: (task: StudyTask) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  handleDeleteTask: (id: string) => void;
  isOverlay?: boolean;
}

export const SortableTaskItem: React.FC<SortableTaskItemProps> = ({
  task,
  isCompleted,
  toggleTask,
  setEditingTask,
  setIsModalOpen,
  handleDeleteTask,
  isOverlay,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    disabled: Boolean(isOverlay),
    animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    transition: {
      duration: 280,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Smooth Apple iOS spring curve
    }
  });

  const priorityColor = task.priority === 'High' ? 'text-red-400' : task.priority === 'Medium' ? 'text-yellow-400' : 'text-blue-400';
  const priorityBorder = task.priority === 'High' ? 'border-l-red-400' : task.priority === 'Medium' ? 'border-l-yellow-400' : 'border-l-blue-400';

  if (isOverlay) {
    return (
      <div
        className="flex items-center p-4 bg-[#222] rounded-2xl border-l-4 border-[#00ffcc] relative shadow-[0_20px_45px_rgba(0,0,0,0.85),0_0_20px_rgba(0,255,204,0.35)] ring-1 ring-[#00ffcc]/70 cursor-grabbing select-none pointer-events-none"
        style={{ width: '100%' }}
      >
        <div className="mr-4 flex-shrink-0 flex items-center justify-center w-12 h-12 text-[#00ffcc] rounded-full">
          {isCompleted ? <CheckCircle2 size={30} className="text-[#00ffcc]" fill="rgba(0, 255, 204, 0.2)" /> : <Circle size={30} />}
        </div>

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
          {task.desc && <p className="text-sm text-[#bbb] leading-relaxed line-clamp-1">{task.desc}</p>}
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-60">
          <div className="p-2 text-gray-400 rounded-lg">
            <Edit2 size={16} />
          </div>
          <div className="p-2 text-gray-400 rounded-lg">
            <Trash2 size={16} />
          </div>
        </div>
      </div>
    );
  }

  // Placeholder slot in the list while dragging - exactly matching size of the real card
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition,
        }}
        className="flex items-center p-4 bg-[#141418] rounded-2xl border-2 border-dashed border-[#00ffcc]/40 opacity-30 select-none pointer-events-none"
      >
        <div className="mr-4 flex-shrink-0 flex items-center justify-center w-12 h-12 text-[#00ffcc]/40 rounded-full">
          {isCompleted ? <CheckCircle2 size={30} /> : <Circle size={30} />}
        </div>

        <div className="flex-grow pr-20">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs font-bold text-[#00ffcc]/60">
              {task.startTime} - {task.endTime}
            </div>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-[#111] ${priorityColor} opacity-50`}>
              {task.priority}
            </span>
          </div>
          <h3 className="text-base font-medium mb-1 text-[#e0e0e0]/50">
            {task.title}
          </h3>
          {task.desc && <p className="text-sm text-[#bbb]/40 leading-relaxed line-clamp-1">{task.desc}</p>}
        </div>
      </div>
    );
  }

  // Normal resting item
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group flex items-center p-4 bg-[#222] rounded-2xl transition-[background-color,border-color,box-shadow] duration-200 border-l-4 ${
        isCompleted ? 'border-l-[#4CAF50] opacity-75' : priorityBorder
      } relative shadow-md shadow-black/30 hover:shadow-lg hover:bg-[#272727] cursor-grab active:cursor-grabbing select-none touch-pan-y`}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          toggleTask(task.id);
        }}
        className="mr-4 flex-shrink-0 flex items-center justify-center w-12 h-12 text-[#00ffcc] hover:scale-110 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-[#00ffcc] rounded-full"
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
        {task.desc && <p className="text-sm text-[#bbb] leading-relaxed">{task.desc}</p>}
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-90 sm:opacity-75 group-hover:opacity-100 transition-opacity">
        <button
          id={`edit-task-btn-${task.id}`}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          className="p-2 text-gray-400 hover:text-[#00ffcc] hover:bg-white/10 active:scale-90 rounded-lg transition-all cursor-pointer"
          title="Edit Task"
          aria-label={`Edit ${task.title}`}
        >
          <Edit2 size={16} />
        </button>
        <button
          id={`delete-task-btn-${task.id}`}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.id);
          }}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/15 active:scale-90 rounded-lg transition-all cursor-pointer"
          title="Delete Task"
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

