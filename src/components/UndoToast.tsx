import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trash2, X } from 'lucide-react';

interface UndoToastProps {
  isVisible: boolean;
  taskTitle: string;
  duration?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  isVisible,
  taskTitle,
  duration = 6000,
  onUndo,
  onDismiss,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isVisible) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isVisible, duration, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="undo-delete-toast"
          initial={{ opacity: 0, y: 50, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 25, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md"
        >
          <div className="relative overflow-hidden bg-[#181822]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(0,255,204,0.15)] p-3.5 flex items-center justify-between gap-3 ring-1 ring-[#00ffcc]/30">
            {/* Countdown progress line */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-[#00ffcc] to-[#00ffcc] transition-all ease-linear"
                style={{ width: `${progress}%`, transitionDuration: '50ms' }}
              />
            </div>

            {/* Left section: Icon & Title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Task Deleted
                </div>
                <div className="text-sm font-medium text-white truncate" title={taskTitle}>
                  {taskTitle}
                </div>
              </div>
            </div>

            {/* Right section: Action Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={onUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ffcc] hover:bg-[#33ffd6] active:scale-95 text-black font-semibold text-xs rounded-xl shadow-[0_0_15px_rgba(0,255,204,0.4)] transition-all cursor-pointer"
                aria-label="Undo task deletion"
              >
                <RotateCcw size={14} className="stroke-[2.5]" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 rounded-lg transition-all"
                title="Dismiss"
                aria-label="Dismiss toast"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
