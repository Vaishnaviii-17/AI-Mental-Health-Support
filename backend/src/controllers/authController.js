const authService = require("../services/authService");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);

  res.status(201).json(
    response.success("User created successfully.", result)
  );
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json(
    response.success("Login successful.", result)
  );
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json(
    response.success("User fetched successfully.", req.user)
  );
});

module.exports = {
  signup,
  login,
  me,
};