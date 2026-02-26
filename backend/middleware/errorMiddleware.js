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

    // Security: Never leak database driver info, stack traces, or internal paths in production
    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? "Internal Enterprise Error. Technical details logged." : message,
        stack: null, // Always null in high-assurance mode (§10.3)
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = { errorHandler, notFound };
