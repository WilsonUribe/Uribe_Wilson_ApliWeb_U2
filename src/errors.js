class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);

    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(message = "Recurso no encontrado") {
  return new AppError(404, "NOT_FOUND", message);
}

function errorHandler(err, req, res, next) {

  if (res.headersSent) {
    return next(err);
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: {
        code: "FILE_TOO_LARGE",
        message: "El archivo supera los 5 MB"
      }
    });
  }

  const status = err.status || 500;

  const response = {
    error: {
      code: err.code || "INTERNAL_ERROR",

      message:
        status === 500
          ? "Error interno del servidor"
          : err.message
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json(response);
}

module.exports = {
  AppError,
  notFound,
  errorHandler
};