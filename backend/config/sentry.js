/**
 * Sentry Error Tracking Configuration
 * 
 * Integrates Sentry for error boundary tracking, monitoring, and alerting
 * Captures:
 * - Unhandled exceptions
 * - Async errors
 * - Performance issues
 * - Release tracking
 * - User feedback
 */

const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

/**
 * Initialize Sentry for Backend
 */
const initializeSentryBackend = (app) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || "https://your-sentry-dsn",
    environment: process.env.NODE_ENV || "development",
    release: process.env.APP_VERSION || "1.0.0",
    
    // Tracing
    tracesSampleRate: process.env.SENTRY_TRACE_RATE || 0.1,
    
    // Performance monitoring
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({
        app: true,
        request: true,
        transaction: 'request', // Transaction name mode
      }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],

    // Error filtering
    beforeSend(event, hint) {
      // Ignore specific errors
      if (event.exception) {
        const error = hint.originalException;

        // Ignore validation errors (they're expected)
        if (error?.name === 'ValidationError') {
          return null;
        }

        // Ignore known safe errors
        if (error?.message?.includes('Expected')) {
          return null;
        }
      }

      return event;
    },

    // Attach stack trace
    attachStacktrace: true,

    // Max breadcrumbs
    maxBreadcrumbs: 100,

    // Ignore URL patterns
    ignoreUrls: [
      /\/health/, // Health checks
      /\/metrics/, // Metrics endpoints
    ],
  });

  // Capture request middleware
  app.use(Sentry.Handlers.requestHandler());
  
  // Tracing middleware
  app.use(Sentry.Handlers.tracingHandler());

  return Sentry;
};

/**
 * Error handling middleware for Sentry
 */
const errorHandler = (app) => {
  // Error handler MUST be last middleware
  app.use(Sentry.Handlers.errorHandler());

  // Fallback error handler
  app.use((err, req, res, next) => {
    Sentry.captureException(err, {
      tags: {
        method: req.method,
        url: req.url,
      },
      contexts: {
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: req.query,
          body: req.body,
        },
        user: {
          id: req.user?.id,
          email: req.user?.email,
        },
      },
    });

    res.status(err.status || 500).json({
      message: err.message || "Internal Server Error",
      sentry_event_id: res.sentry, // For user reference
    });
  });
};

/**
 * Frontend Sentry Configuration
 */
const initializeSentryFrontend = () => {
  const SentryReact = require("@sentry/react");
  const SentryIntegrations = require("@sentry/integrations");

  return {
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.REACT_APP_VERSION || "1.0.0",
    
    tracesSampleRate: parseFloat(process.env.REACT_APP_SENTRY_TRACE_RATE || "0.1"),
    
    integrations: [
      new SentryReact.BrowserTracing(),
      new SentryIntegrations.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  };
};

/**
 * Manual Error Capture
 */
const captureError = (error, context = {}) => {
  Sentry.captureException(error, {
    contexts: context,
    level: "error",
  });
};

/**
 * Manual Warning Capture
 */
const captureWarning = (message, context = {}) => {
  Sentry.captureMessage(message, {
    contexts: context,
    level: "warning",
  });
};

/**
 * Set User Context
 */
const setUserContext = (userId, email, username) => {
  Sentry.setUser({
    id: userId,
    email: email,
    username: username,
  });
};

/**
 * Clear User Context (on logout)
 */
const clearUserContext = () => {
  Sentry.setUser(null);
};

/**
 * Add Breadcrumb (for tracking user actions)
 */
const addBreadcrumb = (message, category, data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
};

/**
 * Track Performance Span
 */
const trackPerformance = (operation, duration) => {
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    const span = transaction.startChild({
      op: operation,
      description: `${operation} completed in ${duration}ms`,
      tags: { duration },
    });
    span.finish();
  }
};

/**
 * Error Boundary Component (React)
 * Usage: <ErrorBoundary><YourComponent /></ErrorBoundary>
 */
const createErrorBoundary = () => {
  const SentryReact = require("@sentry/react");

  const ErrorBoundaryComponent = ({ children }) => {
    return (
      <SentryReact.ErrorBoundary
        fallback={
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h2>Oops! Something went wrong</h2>
            <p>Our team has been notified. Please try refreshing the page.</p>
          </div>
        }
        showDialog
      >
        {children}
      </SentryReact.ErrorBoundary>
    );
  };

  return ErrorBoundaryComponent;
};

/**
 * Sentry Health Check
 */
const healthCheck = async () => {
  try {
    const lastEvent = await Sentry.captureMessage(
      "Health check ping",
      "info"
    );
    
    return {
      status: "ok",
      sentry_enabled: !!process.env.SENTRY_DSN,
      last_event: lastEvent,
    };
  } catch (error) {
    return {
      status: "error",
      message: error.message,
      sentry_enabled: false,
    };
  }
};

module.exports = {
  initializeSentryBackend,
  errorHandler,
  initializeSentryFrontend,
  captureError,
  captureWarning,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  trackPerformance,
  createErrorBoundary,
  healthCheck,
};
