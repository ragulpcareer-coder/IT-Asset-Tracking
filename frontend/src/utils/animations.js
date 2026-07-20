// Animation Variants for Framer Motion
export const animationVariants = {
  // Page Transitions
  pageIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },

  pageInLeft: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
    transition: { duration: 0.3 },
  },

  // Stagger animations for lists
  containerVariants: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },

  itemVariants: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
      },
    },
  },

  // Button animations
  buttonHover: {
    scale: 1.05,
    boxShadow: "0 10px 25px rgba(59, 130, 246, 0.3)",
  },

  buttonTap: {
    scale: 0.95,
  },

  // Card animations
  cardHover: {
    y: -8,
    boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
  },

  // Input focus
  inputFocus: {
    boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
  },

  // Modal animations
  modalBackdropVariants: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },

  modalContentVariants: {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", damping: 15 },
    },
  },

  // Pulse animation
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
  },

  // Slide in from sides
  slideInFromLeft: {
    initial: { x: -100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { type: "spring", damping: 10 },
  },

  slideInFromRight: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { type: "spring", damping: 10 },
  },

  // Scale animations
  scaleIn: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: "spring", stiffness: 100 },
  },

  // Rotate animations
  rotateIn: {
    initial: { rotate: -10, opacity: 0 },
    animate: { rotate: 0, opacity: 1 },
    transition: { duration: 0.5 },
  },

  // Bounce animation
  bounce: {
    y: [0, -10, 0],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },

  // Shimmer/Loading animation
  shimmer: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },

  // Success checkmark animation
  checkmark: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },

  // 3D Flip animation
  flip3D: {
    initial: { rotateY: 0, opacity: 1 },
    animate: { rotateY: [0, 180, 360] },
    transition: { duration: 3, repeat: Infinity, ease: "linear" },
  },

  // 3D Tilt on hover
  tilt3D: {
    initial: { rotateX: 0, rotateY: 0 },
    whileHover: {
      rotateX: [0, 5, -5, 0],
      rotateY: [0, 5, -5, 0],
    },
    transition: { duration: 0.6 },
  },

  // Floating 3D effect
  float3D: {
    initial: { y: 0, rotateX: 0, rotateY: 0 },
    animate: {
      y: [-10, 10, -10],
      rotateX: [0, 2, -2, 0],
      rotateY: [0, 2, -2, 0],
    },
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },

  // Glow pulse animation
  glowPulse: {
    boxShadow: [
      "0 0 20px rgba(27, 94, 155, 0.5)",
      "0 0 40px rgba(27, 94, 155, 0.8)",
      "0 0 20px rgba(27, 94, 155, 0.5)",
    ],
    transition: { duration: 2, repeat: Infinity },
  },

  // Data stream animation
  dataStream: {
    initial: { opacity: 0, y: -100, x: 0 },
    animate: { opacity: [0, 1, 0], y: 100, x: [0, 50, -50, 0] },
    transition: { duration: 2.5, repeat: Infinity },
  },

  // Holographic shimmer
  holographicShimmer: {
    initial: { left: "-100%", opacity: 0 },
    animate: { left: "100%", opacity: [0, 1, 0] },
    transition: { duration: 3, repeat: Infinity },
  },

  // Tech pulse (like a radar)
  techPulse: {
    initial: { scale: 0.8, opacity: 1 },
    animate: { scale: [0.8, 1.5, 0.8], opacity: [1, 0, 1] },
    transition: { duration: 2, repeat: Infinity },
  },

  // Morphing shape
  morph: {
    initial: { borderRadius: "50%" },
    animate: { borderRadius: ["50%", "0%", "50%"] },
    transition: { duration: 4, repeat: Infinity },
  },

  // Constellation animation (connecting dots)
  constellation: {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: "spring", stiffness: 100 },
  },

  // Neon glow border
  neonGlow: {
    boxShadow: [
      "0 0 10px rgba(27, 94, 155, 0.5), inset 0 0 10px rgba(0, 137, 123, 0.2)",
      "0 0 20px rgba(27, 94, 155, 0.8), inset 0 0 20px rgba(0, 137, 123, 0.4)",
      "0 0 10px rgba(27, 94, 155, 0.5), inset 0 0 10px rgba(0, 137, 123, 0.2)",
    ],
    transition: { duration: 2, repeat: Infinity },
  },

  // Scan line effect
  scanLine: {
    initial: { top: "-100%" },
    animate: { top: "100%" },
    transition: { duration: 3, repeat: Infinity },
  },
};

// Transition presets
export const transitionPresets = {
  smooth: { type: "tween", duration: 0.3, ease: "easeInOut" },
  smoothSlow: { type: "tween", duration: 0.5, ease: "easeInOut" },
  bouncy: { type: "spring", stiffness: 300, damping: 10 },
  gentle: { type: "spring", stiffness: 100, damping: 15 },
  snappy: { type: "spring", stiffness: 400, damping: 20 },
};

// Delay stagger function
export const getStaggerDelay = (index, baseDelay = 0.05) => ({
  transition: {
    delay: index * baseDelay,
  },
});

// Create staggered animation for lists
export const createStaggerAnimation = (count, baseDelay = 0.05) => {
  return Array.from({ length: count }).map((_, i) => ({
    index: i,
    transition: {
      delay: i * baseDelay,
    },
  }));
};
