const rolesService = require("../services/roles.service");

async function list(req, res, next) {
  try {
    res.status(200).json(await rolesService.listRoles(req.query));
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    res.status(200).json({ data: await rolesService.getRole(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await rolesService.createRole(req.body, req.user.id, req.ip);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await rolesService.updateRole(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const data = await rolesService.deactivateRole(req.params.id, req.user.id, req.ip);
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
};
