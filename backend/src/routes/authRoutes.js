const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const validate = require("../middleware/validate");

const {
  signupSchema,
  loginSchema,
} = require("../validators/authValidator");

const router = express.Router();

router.post("/signup", validate(signupSchema), authController.signup);

router.post("/login", validate(loginSchema), authController.login);

router.get("/me", authMiddleware, authController.me);

module.exports = router;