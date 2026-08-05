function success(message, data = null) {
  return {
    success: true,
    message,
    data,
  };
}

function error(message) {
  return {
    success: false,
    message,
  };
}

module.exports = {
  success,
  error,
};