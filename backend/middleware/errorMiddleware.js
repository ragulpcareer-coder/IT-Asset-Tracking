// Global Error Handler Middleware
// Ensures API consistently returns JSON in { success: false, message: string } structure

const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode; // default Server Error unless explicitly set otherwise previously
    let message = err.message;

    // CastError for bad Mongoose ObjectIDs
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        message = 'Resource not found';
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        statusCode = 400;
        message = 'Duplicate field value entered';
    }

    // Generic Error Scrubbing/Masking (§10.3)
    // We mask specific database errors with generic business-friendly messages
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((val) => val.message);
        statusCode = 400;
        message = "Inventory validation failed. Please check your inputs."; // Generic message (§10.3)
    }

    // Handle custom API errors gracefully
    if (err.message && err.message.includes('Cross-origin')) {
        statusCode = 403;
        message = 'Forbidden: Cross-origin request denied by firewall context.';
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Not authorized, token invalid';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Not authorized, token expired';
    }

    // Security: Never leak database driver info, stack traces, or internal paths in production
    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? "Internal Enterprise Error. Technical details logged." : message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : null,
        errorRaw: statusCode === 500 && process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = { errorHandler, notFound };
