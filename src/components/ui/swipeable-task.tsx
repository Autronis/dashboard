"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

interface SwipeableTaskProps {
  children: ReactNode;
  onComplete: () => void;
  onDelete: () => void;
}

export function SwipeableTask({ children, onComplete, onDelete }: SwipeableTaskProps) {
  const x = useMotionValue(0);
  const [swiping, setSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgOpacityRight = useTransform(x, [0, 100], [0, 1]);
  const bgOpacityLeft = useTransform(x, [-100, 0], [1, 0]);
  const scaleRight = useTransform(x, [0, 100], [0.5, 1]);
  const scaleLeft = useTransform(x, [-100, 0], [1, 0.5]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      setSwiping(false);
      if (info.offset.x > 100) {
        onComplete();
      } else if (info.offset.x < -100) {
        onDelete();
      }
    },
    [onComplete, onDelete]
  );

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl touch-pan-y">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right swipe = complete */}
        <motion.div
          className="flex-1 flex items-center justify-start pl-6 bg-emerald-500/20"
          style={{ opacity: bgOpacityRight }}
        >
          <motion.div style={{ scale: scaleRight }}>
            <Check className="w-6 h-6 text-emerald-400" />
          </motion.div>
        </motion.div>
        {/* Left swipe = delete */}
        <motion.div
          className="flex-1 flex items-center justify-end pr-6 bg-red-500/20"
          style={{ opacity: bgOpacityLeft }}
        >
          <motion.div style={{ scale: scaleLeft }}>
            <Trash2 className="w-6 h-6 text-red-400" />
          </motion.div>
        </motion.div>
      </div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 150 }}
        dragElastic={0.1}
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={swiping ? "cursor-grabbing" : "cursor-grab md:cursor-auto"}
        whileTap={{ cursor: "grabbing" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
