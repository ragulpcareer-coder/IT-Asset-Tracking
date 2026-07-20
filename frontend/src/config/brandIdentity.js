/**
 * Professional IT Asset Tracker Brand Identity
 * 
 * Brand: AssetFlow Pro
 * Core Concept: Seamless asset lifecycle management
 * Visual Identity: Tech-forward, secure, efficient, trustworthy
 */

export const brandIdentity = {
  name: "AssetFlow",
  tagline: "Enterprise Asset Intelligence",
  description: "Professional IT asset lifecycle management",
  
  // Brand Mission
  mission: "Empower IT teams with intelligent asset tracking and management",
  
  // Core Values
  values: ["Trust", "Intelligence", "Efficiency", "Security"],
};

/**
 * Professional Color Palette for IT Asset Tracking
 * 
 * Primary: Tech-focused blue (IBM, Microsoft, Dell inspired)
 * Accent: Teal for security/trust
 * Status: Green (active), Amber (maintenance), Red (issues)
 */
export const professionalColors = {
  // Primary Brand Colors - Enterprise Blue
  brand: {
    darkBlue: "#0F2050",      // Deep enterprise blue
    primary: "#1B5E9B",       // IBM/tech company blue
    sky: "#2E7BB4",           // Professional sky blue
    light: "#5BA9D9",         // Light accent blue
  },

  // Secondary Brand Colors - Security Teal
  security: {
    dark: "#00796B",          // Deep teal - trust
    primary: "#00897B",       // Teal - security
    light: "#4DB6AC",         // Light teal - accessible
    lighter: "#B2DFDB",       // Very light teal
  },

  // Status Colors - Professional Semantic
  status: {
    active: "#2E7D32",        // Deep green - active assets
    activeLight: "#66BB6A",   // Light green
    maintenance: "#F57C00",   // Orange - maintenance
    warning: "#E65100",       // Dark orange - warning
    error: "#C62828",         // Deep red - critical
    errorLight: "#EF5350",    // Light red
    deprecated: "#7E57C2",    // Purple - deprecated
    archived: "#616161",      // Gray - archived
  },

  // Neutral Palette - Professional & Clean
  neutral: {
    white: "#FFFFFF",
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#EEEEEE",
    300: "#E0E0E0",
    400: "#BDBDBD",
    500: "#9E9E9E",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#212121",
  },

  // Gradients - Professional & Modern
  gradients: {
    // Primary gradient - dark blue to teal
    primary: "linear-gradient(135deg, #0F2050 0%, #1B5E9B 50%, #00796B 100%)",
    
    // Secondary gradient - blue to sky
    secondary: "linear-gradient(135deg, #1B5E9B 0%, #2E7BB4 100%)",
    
    // Accent gradient - teal variations
    accent: "linear-gradient(135deg, #00897B 0%, #4DB6AC 100%)",
    
    // Status gradients
    successGradient: "linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)",
    warningGradient: "linear-gradient(135deg, #F57C00 0%, #FFB74D 100%)",
    errorGradient: "linear-gradient(135deg, #C62828 0%, #EF5350 100%)",
    
    // Subtle background gradients
    subtleBlue: "linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%)",
    subtleTeal: "linear-gradient(180deg, #F1F8F8 0%, #FFFFFF 100%)",
    
    // Dark mode gradients
    darkPrimary: "linear-gradient(135deg, #1a3a52 0%, #0F2050 100%)",
  },

  // Asset Type Colors
  assetTypes: {
    laptop: "#1B5E9B",        // Blue - primary devices
    server: "#00796B",        // Teal - critical infrastructure
    phone: "#2E7BB4",         // Sky blue - mobile
    network: "#00897B",       // Dark teal - network
    monitor: "#5BA9D9",       // Light blue - display
    printer: "#F57C00",       // Orange - peripherals
    other: "#9E9E9E",         // Gray - miscellaneous
  },
};

/**
 * Typography Hierarchy - Professional & Clean
 */
export const professionalTypography = {
  fontFamily: {
    primary: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Monaco', 'Courier New', monospace",
  },
  scale: {
    heading1: {
      fontSize: "2.75rem",
      fontWeight: "700",
      lineHeight: "1.1",
      letterSpacing: "-0.02em",
      color: "#0F2050",
    },
    heading2: {
      fontSize: "2.25rem",
      fontWeight: "700",
      lineHeight: "1.2",
      letterSpacing: "-0.01em",
      color: "#1B5E9B",
    },
    heading3: {
      fontSize: "1.75rem",
      fontWeight: "600",
      lineHeight: "1.3",
      color: "#212121",
    },
    heading4: {
      fontSize: "1.35rem",
      fontWeight: "600",
      lineHeight: "1.4",
      color: "#424242",
    },
    body: {
      fontSize: "1rem",
      fontWeight: "400",
      lineHeight: "1.6",
      color: "#212121",
    },
    small: {
      fontSize: "0.875rem",
      fontWeight: "400",
      lineHeight: "1.5",
      color: "#616161",
    },
    tiny: {
      fontSize: "0.75rem",
      fontWeight: "500",
      lineHeight: "1.4",
      color: "#757575",
    },
    label: {
      fontSize: "0.875rem",
      fontWeight: "600",
      lineHeight: "1.25",
      color: "#424242",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
  },
};

/**
 * Logo SVG Components
 * Can be used as inline SVGs in React
 */
export const logoSVG = {
  // Main brand logo - abstract asset/network concept
  main: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <!-- Background circle -->
    <circle cx="100" cy="100" r="95" fill="none" stroke="#1B5E9B" stroke-width="2"/>
    
    <!-- Asset nodes -->
    <circle cx="100" cy="50" r="8" fill="#1B5E9B"/>
    <circle cx="140" cy="100" r="8" fill="#00897B"/>
    <circle cx="100" cy="150" r="8" fill="#1B5E9B"/>
    <circle cx="60" cy="100" r="8" fill="#00897B"/>
    <circle cx="100" cy="100" r="10" fill="#2E7BB4"/>
    
    <!-- Connecting lines -->
    <line x1="100" y1="50" x2="100" y2="90" stroke="#1B5E9B" stroke-width="2" opacity="0.5"/>
    <line x1="100" y1="110" x2="100" y2="150" stroke="#1B5E9B" stroke-width="2" opacity="0.5"/>
    <line x1="100" y1="100" x2="140" y2="100" stroke="#00897B" stroke-width="2" opacity="0.5"/>
    <line x1="60" y1="100" x2="100" y2="100" stroke="#00897B" stroke-width="2" opacity="0.5"/>
    
    <!-- Text -->
    <text x="100" y="185" font-family="Inter, sans-serif" font-size="14" font-weight="600" text-anchor="middle" fill="#1B5E9B">ASSETFLOW</text>
  </svg>`,

  // Compact icon logo
  icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="#1B5E9B" opacity="0.1"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#1B5E9B" stroke-width="2"/>
    <circle cx="50" cy="30" r="5" fill="#1B5E9B"/>
    <circle cx="70" cy="50" r="5" fill="#00897B"/>
    <circle cx="50" cy="70" r="5" fill="#1B5E9B"/>
    <circle cx="30" cy="50" r="5" fill="#00897B"/>
    <circle cx="50" cy="50" r="6" fill="#2E7BB4"/>
    <line x1="50" y1="30" x2="50" y2="44" stroke="#1B5E9B" stroke-width="1.5" opacity="0.6"/>
    <line x1="50" y1="50" x2="70" y2="50" stroke="#00897B" stroke-width="1.5" opacity="0.6"/>
    <line x1="50" y1="56" x2="50" y2="70" stroke="#1B5E9B" stroke-width="1.5" opacity="0.6"/>
    <line x1="30" y1="50" x2="44" y2="50" stroke="#00897B" stroke-width="1.5" opacity="0.6"/>
  </svg>`,
};

/**
 * Professional Icon Pack for IT Assets
 */
export const assetIcons = {
  // Device icons
  laptop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h14l4-5V5c0-1.1-.9-2-2-2z"/>
    <path d="M2 16h20"/>
  </svg>`,
  
  server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="2" width="20" height="8" rx="1"/>
    <rect x="2" y="14" width="20" height="8" rx="1"/>
    <circle cx="6" cy="6" r="1"/>
    <circle cx="6" cy="18" r="1"/>
    <circle cx="18" cy="6" r="1"/>
    <circle cx="18" cy="18" r="1"/>
  </svg>`,
  
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <path d="M12 18h.01"/>
  </svg>`,
  
  network: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
    <circle cx="12" cy="12" r="2"/>
    <circle cx="19" cy="5" r="2"/>
    <circle cx="5" cy="5" r="2"/>
    <circle cx="19" cy="19" r="2"/>
    <circle cx="5" cy="19" r="2"/>
  </svg>`,
  
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`,
  
  printer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>`,
  
  router: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <ellipse cx="12" cy="12" rx="10" ry="7"/>
    <path d="M12 5v14M5 12h14"/>
    <circle cx="6" cy="6" r="1"/>
    <circle cx="18" cy="6" r="1"/>
    <circle cx="6" cy="18" r="1"/>
    <circle cx="18" cy="18" r="1"/>
  </svg>`,
};

/**
 * Status Badge Icons
 */
export const statusIcons = {
  active: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>`,
  
  maintenance: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8v5l4.25 2.5.7-1.19-3.95-2.31V8z M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
  </svg>`,
  
  deprecated: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
  </svg>`,
  
  archived: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 5.5h6v1.5h-6V5.5zm6 9l-6 6-6-6h5V9h2v5.5h5z"/>
  </svg>`,
};

/**
 * Action Icons
 */
export const actionIcons = {
  add: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>`,
  
  edit: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>`,
  
  delete: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/>
  </svg>`,
  
  search: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.48-5.34c0-3.6-2.92-6.5-6.5-6.5s-6.5 2.9-6.5 6.5 2.92 6.5 6.5 6.5c2.04 0 3.86-.87 5.15-2.27l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 10s2.01-4 4.5-4 4.5 2.01 4.5 4-2.01 4-4.5 4z"/>
  </svg>`,
};

/**
 * Brand Color Reference
 */
export const colorReference = {
  primary: "#1B5E9B",           // Primary brand blue
  secondary: "#00897B",         // Secondary teal
  accent: "#2E7BB4",            // Accent sky blue
  success: "#2E7D32",           // Success green
  warning: "#F57C00",           // Warning orange
  error: "#C62828",             // Error red
  info: "#00897B",              // Info teal
  neutral: "#616161",           // Neutral gray
  background: "#FAFAFA",        // Clean background
  surface: "#FFFFFF",           // Surface white
  text: "#212121",              // Primary text
  textSecondary: "#616161",     // Secondary text
};

export default {
  brandIdentity,
  professionalColors,
  professionalTypography,
  logoSVG,
  assetIcons,
  statusIcons,
  actionIcons,
  colorReference,
};
