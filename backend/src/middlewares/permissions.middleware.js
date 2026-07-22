const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const RESOURCE_PERMISSIONS = {
  activations: {
    administrator: ["read"],
    license_user: ["read"],
    viewer: ["read"],
  },
  auditLogs: {
    administrator: ["read", "delete"],
    license_user: [],
    viewer: [],
  },
  roles: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read"],
    viewer: [],
  },
  users: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read"],
    viewer: [],
  },
  providers: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read"],
    viewer: ["read"],
  },
  customers: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read", "create", "update"],
    viewer: ["read"],
  },
  products: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read"],
    viewer: ["read"],
  },
  variants: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read"],
    viewer: ["read"],
  },
  batches: {
    administrator: ["read", "create", "update", "delete"],
    license_user: ["read", "create", "update"],
    viewer: ["read"],
  },
  licenses: {
    administrator: ["read", "create", "update", "delete", "activate", "reserve", "expire"],
    license_user: ["read", "create", "update", "activate", "reserve", "expire"],
    viewer: ["read"],
  },
  dashboard: {
    administrator: ["read"],
    license_user: ["read"],
    viewer: ["read"],
  },
};

function actionFromRequest(req, resourceName) {
  if (
    resourceName === "auditLogs" &&
    req.method === "POST" &&
    req.path.split("/").filter(Boolean).includes("cleanup")
  ) {
    return "delete";
  }

  if (
    resourceName === "licenses" &&
    req.method === "POST" &&
    req.path.split("/").filter(Boolean).includes("expire-overdue")
  ) {
    return "expire";
  }

  if (
    resourceName === "licenses" &&
    req.method === "POST" &&
    req.path.split("/").filter(Boolean).includes("activate")
  ) {
    return "activate";
  }

  if (
    resourceName === "licenses" &&
    req.method === "POST" &&
    ["reserve", "release-reservation"].some((action) =>
      req.path.split("/").filter(Boolean).includes(action)
    )
  ) {
    return "reserve";
  }

  if (READ_METHODS.has(req.method)) {
    return "read";
  }

  if (req.method === "POST") {
    return "create";
  }

  if (["PUT", "PATCH"].includes(req.method)) {
    return "update";
  }

  if (req.method === "DELETE") {
    return "delete";
  }

  return null;
}

function requirePermission(resourceName) {
  return (req, res, next) => {
    const roleName = req.user?.role?.name;
    const action = actionFromRequest(req, resourceName);
    const allowedActions = RESOURCE_PERMISSIONS[resourceName]?.[roleName] || [];

    if (!action || !allowedActions.includes(action)) {
      return res.status(403).json({
        message: "No tiene permisos para realizar esta acción",
      });
    }

    return next();
  };
}

module.exports = {
  RESOURCE_PERMISSIONS,
  requirePermission,
};
