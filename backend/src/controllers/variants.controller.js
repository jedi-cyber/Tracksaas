const variantsService = require("../services/variants.service");

async function list(req, res, next) {
  try {
    res.status(200).json(await variantsService.listVariants(req.query));
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    res.status(200).json({ data: await variantsService.getVariant(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await variantsService.createVariant(req.body, req.user.id, req.ip);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await variantsService.updateVariant(req.params.id, req.body, req.user.id, req.ip);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const data = await variantsService.deactivateVariant(req.params.id, req.user.id, req.ip);
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
