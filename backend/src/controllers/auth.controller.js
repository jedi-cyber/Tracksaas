const authService = require("../services/auth.service");

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.status(200).json({
    user: req.user,
  });
}

module.exports = {
  login,
  me,
};
