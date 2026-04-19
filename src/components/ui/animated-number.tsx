"use client";
import { useEffect, useRef, useCallback } from "react";
import { useMotionValue, useSpring, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 100,
    damping: 20,
    restDelta: 1,
  });

  const updateDisplay = useCallback(
    (latest: number) => {
      if (ref.current) {
        ref.current.textContent = format(Math.round(latest));
      }
    },
    [format]
  );

  useEffect(() => {
    motionValue.set(value);
    // Spring "change" does not fire when value stays at 0 on mount, so without
    // this call the span stays empty for zero-values.
    updateDisplay(value);
  }, [motionValue, value, updateDisplay]);

  useEffect(() => {
    const unsubscribe = spring.on("change", updateDisplay);
    return unsubscribe;
  }, [spring, updateDisplay]);

  return <motion.span ref={ref} className={className}>{format(Math.round(value))}</motion.span>;
}
