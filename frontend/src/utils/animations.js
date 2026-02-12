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
