const AppError = require("./AppError");

class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}

module.exports = NotFoundError;