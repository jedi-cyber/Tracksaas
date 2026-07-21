const activationsService = require("../services/activations.service");

async function list(req, res, next) {
  try {
    res.status(200).json(await activationsService.listActivations(req.query));
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    res.status(200).json({ data: await activationsService.getActivation(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function getByLicense(req, res, next) {
  try {
    res
      .status(200)
      .json({ data: await activationsService.getActivationByLicense(req.params.licenseUnitId) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  getByLicense,
};
