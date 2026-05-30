'use client';

import { motion } from 'framer-motion';

interface HermesFabProps {
  onClick: () => void;
  hasNotifications: boolean;
  isTyping: boolean;
}

export function HermesFab({ onClick, hasNotifications, isTyping }: HermesFabProps) {
  return (
    <motion.button
      onClick={onClick}
      className="pointer-events-auto group relative flex h-48 w-48 items-center justify-center rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2"
      style={{ background: 'transparent' }}
      whileHover={{
        scale: 1.12,
      }}
      whileTap={{ scale: 0.92 }}
      aria-label="Open Hermes AI assistant"
    >
      {/* Subtle glow ring */}
      <motion.div
        className="absolute inset-[-4px] rounded-full opacity-0 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, transparent 70%)',
        }}
        animate={
          hasNotifications
            ? {
                scale: [1, 1.4, 1],
                opacity: [0.5, 0, 0.5],
              }
            : {}
        }
        transition={
          hasNotifications
            ? {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : {}
        }
      />

      {/* Owl animation */}
      <motion.div
        className="relative"
        animate={
          isTyping
            ? {
                y: [0, -3, 0],
              }
            : {}
        }
        transition={
          isTyping
            ? {
                duration: 0.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : {}
        }
      >
        <img
          src="/hermes-owl.webp"
          alt=""
          className="h-42 w-auto object-contain drop-shadow-lg"
          draggable={false}
        />
      </motion.div>

      {/* Typing indicator dots (shown below the owl) */}
      {isTyping && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-2 w-2 rounded-full bg-amber-400"
              animate={{
                y: [0, -3, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Notification badge */}
      {hasNotifications && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900"
        >
          !
        </motion.span>
      )}
    </motion.button>
  );
}
