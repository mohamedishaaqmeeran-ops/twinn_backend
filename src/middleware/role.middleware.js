const {
  ROLES,
  ALL_ROLES,
  INTERNAL_ROLES,
} = require("../config/roles");

const {
  normalizeRole,
  isAdmin,
  isInternalRole,
  isBrandCreator,
} = require("../utils/accessControl");

/* =========================================================
   RESPONSE HELPERS
========================================================= */

const unauthorized = (
  res,
  code,
  message
) =>
  res.status(401).json({
    success: false,
    code,
    message,
  });

const forbidden = (
  res,
  code,
  message,
  extra = {}
) =>
  res.status(403).json({
    success: false,
    code,
    message,
    ...extra,
  });

/* =========================================================
   AUTH HELPERS
========================================================= */

const ensureAuthenticated = (
  req,
  res
) => {
  if (!req.user) {
    unauthorized(
      res,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    );

    return false;
  }

  return true;
};

const getCurrentRole = (
  req
) =>
  normalizeRole(
    req.userRole ||
      req.auth?.role ||
      req.user?.role
  );

/* =========================================================
   VALIDATE ROLES
========================================================= */

const validateRoles = (
  roles,
  middlewareName
) => {
  const normalized =
    [
      ...new Set(
        roles
          .flat(Infinity)
          .map(normalizeRole)
          .filter(Boolean)
      ),
    ];

  if (!normalized.length) {
    throw new Error(
      `${middlewareName} requires at least one valid role.`
    );
  }

  const invalid =
    roles
      .flat(Infinity)
      .filter(
        (role) =>
          !ALL_ROLES.includes(
            normalizeRole(role)
          )
      );

  if (invalid.length) {
    throw new Error(
      `Unknown roles: ${invalid.join(
        ", "
      )}`
    );
  }

  return normalized;
};

/* =========================================================
   REQUIRE ROLE
========================================================= */

const requireRole =
  (...roles) => {
    const allowed =
      validateRoles(
        roles,
        "requireRole"
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

      const current =
        getCurrentRole(req);

      if (
        !allowed.includes(
          current
        )
      ) {
        return forbidden(
          res,
          "ROLE_NOT_ALLOWED",
          "You do not have permission to access this resource",
          {
            currentRole:
              current,
            requiredRoles:
              allowed,
          }
        );
      }

      next();
    };
  };

/* =========================================================
   ADMIN ONLY
========================================================= */

const requireAdmin = (
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
    !isAdmin(
      getCurrentRole(req)
    )
  ) {
    return forbidden(
      res,
      "ADMIN_ONLY",
      "Administrator access is required"
    );
  }

  next();
};

/* =========================================================
   INTERNAL USERS
========================================================= */

const requireInternalRole =
  (
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
      !isInternalRole(
        getCurrentRole(req)
      )
    ) {
      return forbidden(
        res,
        "INTERNAL_ROLE_REQUIRED",
        "This resource is available only to internal users"
      );
    }

    next();
  };

/* =========================================================
   BRAND CREATOR
   (Admins & Managers bypass)
========================================================= */

const requireBrandCreator =
  (
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
      getCurrentRole(req);

    if (
      isInternalRole(role)
    ) {
      return next();
    }

    if (
      !isBrandCreator(
        role
      )
    ) {
      return forbidden(
        res,
        "BRAND_CREATOR_ONLY",
        "This feature is available only to brand creator accounts"
      );
    }

    next();
  };

/* =========================================================
   STRICT BRAND CREATOR
   (No admin bypass)
========================================================= */

const requireStrictBrandCreator =
  (
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
      !isBrandCreator(
        getCurrentRole(req)
      )
    ) {
      return forbidden(
        res,
        "BRAND_CREATOR_ONLY",
        "Only brand creators can access this resource"
      );
    }

    next();
  };

/* =========================================================
   MANAGER OR ADMIN
========================================================= */

const requireManagerOrAdmin =
  requireRole(
    ROLES.MANAGER,
    ROLES.ADMIN
  );

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  requireRole,

  requireAdmin,

  requireInternalRole,

  requireBrandCreator,

  requireStrictBrandCreator,

  requireManagerOrAdmin,
};