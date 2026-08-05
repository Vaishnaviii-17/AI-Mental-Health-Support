const { z } = require("zod");

const signupSchema = z.object({
  username: z
    .string({
      required_error: "Username is required",
    })
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters"),

  password: z
    .string({
      required_error: "Password is required",
    })
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password cannot exceed 100 characters"),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),

  password: z.string().min(1, "Password is required"),
});

module.exports = {
  signupSchema,
  loginSchema,
};