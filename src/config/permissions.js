/* =========================================================
   PERMISSIONS
========================================================= */

const PERMISSIONS = Object.freeze({
  /* =======================================================
     USERS
  ======================================================= */

  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",

  /* =======================================================
     PRODUCTS
  ======================================================= */

  PRODUCTS_READ: "products:read",
  PRODUCTS_WRITE: "products:write",
  PRODUCTS_DELETE: "products:delete",

  /* =======================================================
     TWINS
  ======================================================= */

  TWINS_READ: "twins:read",
  TWINS_WRITE: "twins:write",
  TWINS_DELETE: "twins:delete",
  TWINS_TRAIN: "twins:train",

  /* =======================================================
     PAYMENTS
  ======================================================= */

  PAYMENTS_READ: "payments:read",
  PAYMENTS_WRITE: "payments:write",

  /* =======================================================
     REPORTS
  ======================================================= */

  REPORTS_READ: "reports:read",

  /* =======================================================
     SETTINGS
  ======================================================= */

  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",

  /* =======================================================
     SOCIAL CONNECTIONS
  ======================================================= */

  SOCIAL_READ: "social:read",
  SOCIAL_WRITE: "social:write",
  SOCIAL_DELETE: "social:delete",

  /* =======================================================
     REALTIME TWIN
  ======================================================= */

  REALTIME_READ: "realtime:read",
  REALTIME_CREATE: "realtime:create",
  REALTIME_CLOSE: "realtime:close",

  /* =======================================================
     LIVE STREAMING
  ======================================================= */

  LIVE_READ: "live:read",
  LIVE_CREATE: "live:create",
  LIVE_UPDATE: "live:update",
  LIVE_STOP: "live:stop",
  LIVE_ADMIN: "live:admin",

  /* =======================================================
     LIVE SCHEDULES
  ======================================================= */

  SCHEDULE_READ: "schedule:read",
  SCHEDULE_CREATE: "schedule:create",
  SCHEDULE_UPDATE: "schedule:update",
  SCHEDULE_DELETE: "schedule:delete",

  /* =======================================================
     AVATARS
  ======================================================= */

  AVATAR_READ: "avatar:read",
  AVATAR_CREATE: "avatar:create",
  AVATAR_UPDATE: "avatar:update",
  AVATAR_DELETE: "avatar:delete",
  AVATAR_UNLOCK: "avatar:unlock",

  /* =======================================================
     CREDITS
  ======================================================= */

  CREDITS_READ: "credits:read",
  CREDITS_WRITE: "credits:write",

  /* =======================================================
     ANALYTICS
  ======================================================= */

  ANALYTICS_READ: "analytics:read",

  /* =======================================================
     MARKETPLACE
  ======================================================= */

  MARKETPLACE_READ: "marketplace:read",
});

/* =========================================================
   ALL PERMISSIONS
========================================================= */

const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSIONS)
);

/* =========================================================
   ROLE PERMISSIONS
========================================================= */

const ROLE_PERMISSIONS = Object.freeze({
  /* =======================================================
     STANDARD CUSTOMER
  ======================================================= */

  user: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,

    PERMISSIONS.SOCIAL_READ,

    PERMISSIONS.LIVE_READ,

    PERMISSIONS.AVATAR_READ,

    PERMISSIONS.MARKETPLACE_READ,

    PERMISSIONS.CREDITS_READ,

    PERMISSIONS.SETTINGS_READ,
  ]),

  /* =======================================================
     CONTENT CREATOR

     Read-only access to creator dashboard data.
  ======================================================= */

  contentcreator: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,

    PERMISSIONS.TWINS_READ,

    PERMISSIONS.SOCIAL_READ,

    PERMISSIONS.LIVE_READ,

    PERMISSIONS.SCHEDULE_READ,

    PERMISSIONS.AVATAR_READ,

    PERMISSIONS.ANALYTICS_READ,

    PERMISSIONS.MARKETPLACE_READ,

    PERMISSIONS.CREDITS_READ,

    PERMISSIONS.SETTINGS_READ,
  ]),

  /* =======================================================
     BRAND CREATOR
  ======================================================= */

 brandcreator: Object.freeze([
  /* Products */

  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_WRITE,
  PERMISSIONS.PRODUCTS_DELETE,

  /* Twins */

  PERMISSIONS.TWINS_READ,
  PERMISSIONS.TWINS_WRITE,
  PERMISSIONS.TWINS_DELETE,
  PERMISSIONS.TWINS_TRAIN,

  /* Social */

  PERMISSIONS.SOCIAL_READ,
  PERMISSIONS.SOCIAL_WRITE,
  PERMISSIONS.SOCIAL_DELETE,

  /* Realtime */

  PERMISSIONS.REALTIME_READ,
  PERMISSIONS.REALTIME_CREATE,
  PERMISSIONS.REALTIME_CLOSE,

  /* Live */

  PERMISSIONS.LIVE_READ,
  PERMISSIONS.LIVE_CREATE,
  PERMISSIONS.LIVE_UPDATE,
  PERMISSIONS.LIVE_STOP,

  /* Schedule */

  PERMISSIONS.SCHEDULE_READ,
  PERMISSIONS.SCHEDULE_CREATE,
  PERMISSIONS.SCHEDULE_UPDATE,
  PERMISSIONS.SCHEDULE_DELETE,

  /* Avatar */

  PERMISSIONS.AVATAR_READ,
  PERMISSIONS.AVATAR_CREATE,
  PERMISSIONS.AVATAR_UPDATE,
  PERMISSIONS.AVATAR_DELETE,
  PERMISSIONS.AVATAR_UNLOCK,

  /* Credits */

  PERMISSIONS.CREDITS_READ,
  PERMISSIONS.CREDITS_WRITE,

  /* Payments */

  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.PAYMENTS_WRITE,

  /* Analytics */

  PERMISSIONS.ANALYTICS_READ,

  /* Marketplace */

  PERMISSIONS.MARKETPLACE_READ,

  /* Settings */

  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.SETTINGS_WRITE,
]),

  /* =======================================================
     INTERNAL MANAGER
  ======================================================= */

  manager: Object.freeze([
    ...ALL_PERMISSIONS,
  ]),

  /* =======================================================
     ADMINISTRATOR
  ======================================================= */

  admin: Object.freeze([
    ...ALL_PERMISSIONS,
  ]),
});

/* =========================================================
   HELPERS
========================================================= */

const normalizeRole = (role) =>
  String(role || "user")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

/**
 * Returns the default permissions configured for a role.
 */
const getRolePermissions = (role) => {
  const normalizedRole = normalizeRole(role);

  return ROLE_PERMISSIONS[normalizedRole] || [];
};

/**
 * Combines role permissions with custom user permissions.
 */
const getEffectivePermissions = ({
  role,
  permissions = [],
} = {}) => {
  const rolePermissions = getRolePermissions(role);

  const customPermissions = Array.isArray(permissions)
    ? permissions.filter((permission) =>
        ALL_PERMISSIONS.includes(permission)
      )
    : [];

  return [
    ...new Set([
      ...rolePermissions,
      ...customPermissions,
    ]),
  ];
};

/**
 * Checks whether a role/user has one permission.
 */
const hasPermission = (
  user,
  permission
) => {
  if (!permission) {
    return false;
  }

  const permissions =
    getEffectivePermissions({
      role: user?.role,
      permissions:
        user?.permissions,
    });

  return permissions.includes(
    permission
  );
};

/**
 * Checks whether a user has every required permission.
 */
const hasAllPermissions = (
  user,
  requiredPermissions = []
) => {
  if (
    !Array.isArray(
      requiredPermissions
    ) ||
    requiredPermissions.length ===
      0
  ) {
    return true;
  }

  const permissions =
    getEffectivePermissions({
      role: user?.role,
      permissions:
        user?.permissions,
    });

  return requiredPermissions.every(
    (permission) =>
      permissions.includes(
        permission
      )
  );
};

/**
 * Checks whether a user has at least one required permission.
 */
const hasAnyPermission = (
  user,
  requiredPermissions = []
) => {
  if (
    !Array.isArray(
      requiredPermissions
    ) ||
    requiredPermissions.length ===
      0
  ) {
    return true;
  }

  const permissions =
    getEffectivePermissions({
      role: user?.role,
      permissions:
        user?.permissions,
    });

  return requiredPermissions.some(
    (permission) =>
      permissions.includes(
        permission
      )
  );
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,

  normalizeRole,
  getRolePermissions,
  getEffectivePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
};