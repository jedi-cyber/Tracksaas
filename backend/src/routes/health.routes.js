const { Router } = require("express");

const pool = require("../config/database");

const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "TrackSaaS API funcionando",
  });
});

router.get("/db", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database_name"
    );

    res.status(200).json({
      status: "ok",
      database: rows[0].database_name,
      serverTime: rows[0].server_time,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
