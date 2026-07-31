const {
  ALL_PERMISSIONS,
} = require(
  "../config/permissions"
);

const {
  normalizeRole,
  isInternalRole,
} = require(
  "../utils/accessControl"
);

/* =========================================================
   NORMALIZE PERMISSION
========================================================= */

const normalizePermission = (
  value
) =>
  String(value || "")
    .trim()
    .toLowerCase();

/* =========================================================
   NORMALIZE PERMISSION LIST
========================================================= */

const normalizePermissions = (
  permissions
) =>
  [
    ...new Set(
      permissions
        .flat(Infinity)
        .map(
          normalizePermission
        )
        .filter(Boolean)
    ),
  ];

/* =========================================================
   VALIDATE REQUIRED PERMISSIONS
========================================================= */

const validatePermissions = (
  permissions,
  middlewareName
) => {
  const required =
    normalizePermissions(
      permissions
    );

  if (!required.length) {
    throw new Error(
      `${middlewareName} requires at least one permission.`
    );
  }

  const invalid =
    required.filter(
      (permission) =>
        !ALL_PERMISSIONS.includes(
          permission
        )
    );

  if (invalid.length) {
    throw new Error(
      `Unknown permissions: ${invalid.join(
        ", "
      )}`
    );
  }

  return required;
};

/* =========================================================
   GET USER PERMISSIONS
========================================================= */

const getUserPermissions = (
  req
) => {
  const permissions =
    req.user
      ?.permissions;

  if (
    !Array.isArray(
      permissions
    )
  ) {
    return [];
  }

  return normalizePermissions(
    permissions
  );
};

/* =========================================================
   AUTHENTICATION CHECK
========================================================= */

const ensureAuthenticated = (
  req,
  res
) => {
  if (!req.user) {
    res.status(401).json({
      success: false,

      code:
        "AUTHENTICATION_REQUIRED",

      message:
        "Authentication is required",
    });

    return false;
  }

  return true;
};

/* =========================================================
   INTERNAL BYPASS
   ADMIN + MANAGER
========================================================= */

const hasInternalBypass = (
  req
) => {
  const role =
    normalizeRole(
      req.userRole ||
      req.auth?.role ||
      req.user?.role
    );

  return isInternalRole(
    role
  );
};

/* =========================================================
   DEVELOPMENT DETAILS
========================================================= */

const permissionDebugInfo = (
  details
) => {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return {};
  }

  return details;
};

/* =========================================================
   REQUIRE ALL PERMISSIONS
========================================================= */

const requirePermission =
  (...permissions) => {
    const required =
      validatePermissions(
        permissions,
        "requirePermission"
      );

    return (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      /*
       Admin and Manager have
       unrestricted access.
      */

      if (
        hasInternalBypass(
          req
        )
      ) {
        return next();
      }

      const userPermissions =
        getUserPermissions(
          req
        );

      const missingPermissions =
        required.filter(
          (permission) =>
            !userPermissions.includes(
              permission
            )
        );

      if (
        missingPermissions.length
      ) {
        return res
          .status(403)
          .json({
            success: false,

            code:
              "PERMISSION_REQUIRED",

            message:
              "You do not have all the required permissions",

            ...permissionDebugInfo({
              requiredPermissions:
                required,

              missingPermissions,

              userPermissions,
            }),
          });
      }

      return next();
    };
  };

/* =========================================================
   REQUIRE ANY PERMISSION
========================================================= */

const requireAnyPermission =
  (...permissions) => {
    const required =
      validatePermissions(
        permissions,
        "requireAnyPermission"
      );

    return (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      if (
        hasInternalBypass(
          req
        )
      ) {
        return next();
      }

      const userPermissions =
        getUserPermissions(
          req
        );

      const hasAny =
        required.some(
          (permission) =>
            userPermissions.includes(
              permission
            )
        );

      if (!hasAny) {
        return res
          .status(403)
          .json({
            success: false,

            code:
              "ANY_PERMISSION_REQUIRED",

            message:
              "You do not have any of the required permissions",

            ...permissionDebugInfo({
              requiredPermissions:
                required,

              userPermissions,
            }),
          });
      }

      return next();
    };
  };

/* =========================================================
   REQUIRE INTERNAL ROLE
========================================================= */

const requireInternalPermission =
  (...permissions) => {
    /*
     Validate permission names during
     application startup.
    */

    validatePermissions(
      permissions,
      "requireInternalPermission"
    );

    return (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      const role =
        normalizeRole(
          req.userRole ||
          req.auth?.role ||
          req.user?.role
        );

      if (
        !isInternalRole(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            code:
              "INTERNAL_ROLE_REQUIRED",

            message:
              "This action is available only to internal users",
          });
      }

      return next();
    };
  };

/* =========================================================
   OPTIONAL PERMISSION CHECK
========================================================= */

const hasPermission = (
  req,
  permission
) => {
  const normalized =
    normalizePermission(
      permission
    );

  if (
    !normalized ||
    !ALL_PERMISSIONS.includes(
      normalized
    )
  ) {
    return false;
  }

  if (
    hasInternalBypass(
      req
    )
  ) {
    return true;
  }

  return getUserPermissions(
    req
  ).includes(
    normalized
  );
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireInternalPermission,

  hasPermission,
  getUserPermissions,
  normalizePermission,
};