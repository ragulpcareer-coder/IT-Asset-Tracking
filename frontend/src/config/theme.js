// Professional IT Asset Tracker Design System
// Brand: AssetFlow - Enterprise Asset Intelligence
import { professionalColors, colorReference } from "./brandIdentity";

export const theme = {
  colors: {
    // Primary Colors - Enterprise Blue (IBM/Tech-inspired)
    primary: {
      50: "#F0F6FC",
      100: "#E0EAF7",
      200: "#C5D9F1",
      300: "#A0B8E6",
      400: "#7A98D1",
      500: "#5577BC",          // professional blue
      600: "#2E7BB4",          // brand sky blue
      700: "#1B5E9B",          // brand primary
      800: "#0F3D6E",          // darker blue
      900: "#0F2050",          // deep enterprise blue
    },
    // Secondary Colors - Security Teal
    secondary: {
      50: "#F1F8F8",
      100: "#D4EDED",
      200: "#B2DFDB",
      300: "#80CBC4",
      400: "#4DB6AC",
      500: "#26A69A",
      600: "#009D8C",
      700: "#00897B",          // brand security teal
      800: "#00695C",
      900: "#004D40",
    },
    // Status Colors - Professional Semantic
    accent: {
      success: "#2E7D32",      // deep green - active
      warning: "#F57C00",      // orange - maintenance
      error: "#C62828",        // deep red - critical
      info: "#00897B",         // teal - information
    },
    // Neutral Colors - Clean & Professional
    neutral: {
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
    // Professional Gradient Backgrounds
    gradients: {
      // Primary brand gradient
      primary: "linear-gradient(135deg, #0F2050 0%, #1B5E9B 50%, #00796B 100%)",
      // Secondary blue to sky
      secondary: "linear-gradient(135deg, #1B5E9B 0%, #2E7BB4 100%)",
      // Accent teal variations
      accent: "linear-gradient(135deg, #00897B 0%, #4DB6AC 100%)",
      // Status gradients
      success: "linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)",
      warning: "linear-gradient(135deg, #F57C00 0%, #FFB74D 100%)",
      error: "linear-gradient(135deg, #C62828 0%, #EF5350 100%)",
      // Subtle backgrounds
      subtleBlue: "linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%)",
      subtleTeal: "linear-gradient(180deg, #F1F8F8 0%, #FFFFFF 100%)",
      darkPrimary: "linear-gradient(135deg, #1a3a52 0%, #0F2050 100%)",
    },
    // Asset Type Colors
    assetTypes: {
      laptop: "#1B5E9B",       // blue
      server: "#00796B",       // teal
      phone: "#2E7BB4",        // sky blue
      network: "#00897B",      // dark teal
      monitor: "#5BA9D9",      // light blue
      printer: "#F57C00",      // orange
      other: "#9E9E9E",        // gray
    },
  },

  // Professional Typography
  typography: {
    fontFamily: {
      primary: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'Monaco', 'Courier New', monospace",
    },
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

  // Spacing Scale (8px base)
  spacing: {
    xs: "0.5rem",    // 8px
    sm: "1rem",      // 16px
    md: "1.5rem",    // 24px
    lg: "2rem",      // 32px
    xl: "3rem",      // 48px
    "2xl": "4rem",   // 64px
  },

  // Border Radius
  radius: {
    none: "0",
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.5rem",
    full: "9999px",
  },

  // Professional Shadows
  shadows: {
    none: "0 0 #0000",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.08)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.15)",
    // Brand-specific glows
    glowBlue: "0 0 20px rgba(27, 94, 155, 0.2)",
    glowTeal: "0 0 20px rgba(0, 137, 123, 0.2)",
    glowError: "0 0 20px rgba(198, 40, 40, 0.2)",
    // Professional elevation
    elevation1: "0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    elevation2: "0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)",
    elevation3: "0 8px 16px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.08)",
  },

  // Transitions - Professional & Smooth
  transitions: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
    smooth: "400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  },

  // Breakpoints
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // Professional Component Size Presets
  componentSizes: {
    button: {
      sm: {
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        borderRadius: "0.5rem",
        fontWeight: "600",
      },
      md: {
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        borderRadius: "0.5rem",
        fontWeight: "600",
      },
      lg: {
        padding: "1rem 2rem",
        fontSize: "1.125rem",
        borderRadius: "0.625rem",
        fontWeight: "600",
      },
      xl: {
        padding: "1.25rem 2.5rem",
        fontSize: "1.25rem",
        borderRadius: "0.75rem",
        fontWeight: "700",
      },
    },
    input: {
      sm: {
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        borderRadius: "0.375rem",
      },
      md: {
        padding: "0.75rem 1rem",
        fontSize: "1rem",
        borderRadius: "0.5rem",
      },
      lg: {
        padding: "1rem 1.25rem",
        fontSize: "1.125rem",
        borderRadius: "0.625rem",
      },
    },
    card: {
      sm: {
        padding: "1rem",
        borderRadius: "0.5rem",
      },
      md: {
        padding: "1.5rem",
        borderRadius: "0.75rem",
      },
      lg: {
        padding: "2rem",
        borderRadius: "1rem",
      },
    },
  },

  // Z-Index Scale
  zIndex: {
    hide: "-1",
    base: "0",
    docked: "10",
    sticky: "20",
    fixed: "30",
    overlay: "40",
    modal: "50",
    popover: "60",
    dropdown: "70",
    tooltip: "80",
    notification: "90",
  },
};

// Color Utilities
export const getColorByStatus = (status) => {
  const statusMap = {
    success: theme.colors.accent.success,
    error: theme.colors.accent.error,
    warning: theme.colors.accent.warning,
    info: theme.colors.accent.info,
    pending: theme.colors.accent.warning,
    active: theme.colors.accent.success,
    inactive: theme.colors.neutral[400],
  };
  return statusMap[status] || theme.colors.primary[500];
};

export default theme;
