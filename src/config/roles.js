const ROLES = Object.freeze({
  USER: "user",
  CONTENT_CREATOR: "contentcreator",
  BRAND_CREATOR: "brandcreator",
  MANAGER: "manager",
  ADMIN: "admin",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));
const PUBLIC_SIGNUP_ROLES = Object.freeze([ROLES.USER, ROLES.BRAND_CREATOR]);
const INTERNAL_ROLES = Object.freeze([ROLES.CONTENT_CREATOR, ROLES.MANAGER, ROLES.ADMIN]);
const normalizeRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s_-]/g, "");

module.exports = { ROLES, ALL_ROLES, PUBLIC_SIGNUP_ROLES, INTERNAL_ROLES, normalizeRole };
