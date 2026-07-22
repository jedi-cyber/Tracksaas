const licensesService = require("../services/licenses.service");

async function list(req, res, next) {
  try {
    res.status(200).json(await licensesService.listLicenses(req.query));
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    res.status(200).json({ data: await licensesService.getLicense(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await licensesService.createLicense(req.body, req.user.id, req.ip);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await licensesService.updateLicense(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const data = await licensesService.deactivateLicense(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function activate(req, res, next) {
  try {
    const data = await licensesService.activateLicense(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function reserve(req, res, next) {
  try {
    const data = await licensesService.reserveLicense(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function releaseReservation(req, res, next) {
  try {
    const data = await licensesService.releaseReservation(
      req.params.id,
      req.body,
      req.user.id,
      req.ip
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function expireOverdue(req, res, next) {
  try {
    const data = await licensesService.expireOverdueLicenses(req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  activate,
  reserve,
  releaseReservation,
  expireOverdue,
};
