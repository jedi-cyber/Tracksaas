function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function paginatedResponse(rows, page, limit) {
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  return {
    data: rows.map(({ total_count, ...row }) => row),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  getPagination,
  paginatedResponse,
};
