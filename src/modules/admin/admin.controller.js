const User = require("../../models/User");
const Waitlist = require("../../models/Waitlist");
const Product = require("../../models/Product");

const csv = require("csv-parser");

const {
  Readable,
} = require("stream");

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
};

const normalizeEmail = (
  value
) => {
  return normalizeText(
    value
  ).toLowerCase();
};

const normalizeHeader = (
  value
) => {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]/g, "");
};

const getRowValue = (
  row,
  possibleKeys
) => {
  const normalizedRow =
    Object.entries(
      row
    ).reduce(
      (
        accumulator,
        [key, value]
      ) => {
        accumulator[
          normalizeHeader(key)
        ] = value;

        return accumulator;
      },
      {}
    );

  for (
    const key of possibleKeys
  ) {
    const value =
      normalizedRow[
        normalizeHeader(key)
      ];

    if (
      value !== undefined &&
      normalizeText(value) !==
        ""
    ) {
      return normalizeText(
        value
      );
    }
  }

  return "";
};

const parseBoolean = (
  value,
  defaultValue = false
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return defaultValue;
  }

  const normalized =
    normalizeText(
      value
    ).toLowerCase();

  if (
    [
      "true",
      "yes",
      "1",
      "verified",
      "active",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "false",
      "no",
      "0",
      "unverified",
      "inactive",
    ].includes(normalized)
  ) {
    return false;
  }

  return defaultValue;
};

const parseDate = (
  value
) => {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return null;
  }

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};

const sanitizeUser = (
  user
) => {
  if (!user) {
    return user;
  }

  const userObject =
    typeof user.toObject ===
    "function"
      ? user.toObject()
      : { ...user };

  delete userObject.password;
  delete userObject.passwordHash;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpiresAt;
  delete userObject.resetToken;
  delete userObject.resetTokenExpiresAt;

  return userObject;
};

/* =========================================================
   GET ALL USERS
========================================================= */

/* =========================================================
   GET ALL USERS WITH PRODUCT DETAILS
========================================================= */


/* =========================================================
   GET ALL USERS WITH PRODUCTS
========================================================= */

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(
        "-passwordHash -password -verificationToken " +
          "-verificationTokenExpiresAt -resetToken " +
          "-resetTokenExpiresAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((user) => user._id);

    const products = await Product.find({
      userId: {
        $in: userIds,
      },
    })
      .select(
        "userId name description category price currency " +
          "stock image status createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const productsByUser = products.reduce(
      (result, product) => {
        const ownerId = String(product.userId);

        if (!result[ownerId]) {
          result[ownerId] = [];
        }

        result[ownerId].push(product);

        return result;
      },
      {}
    );

    const usersWithProducts = users.map((user) => {
      const userProducts =
        productsByUser[String(user._id)] || [];

      return {
        ...user,
        products: userProducts,
        productsCount: userProducts.length,
        productCount: userProducts.length,

        activeProductsCount: userProducts.filter(
          (product) => product.status === "active"
        ).length,

        inactiveProductsCount: userProducts.filter(
          (product) => product.status === "inactive"
        ).length,
      };
    });

    return res.status(200).json({
      success: true,
      count: usersWithProducts.length,
      users: usersWithProducts,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to fetch users",
    });
  }
};

/* =========================================================
   IMPORT USERS FROM CSV
========================================================= */

exports.importUsers = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Please select a CSV file.",
        });
    }

    const isCsvFile =
      req.file.originalname
        ?.toLowerCase()
        .endsWith(".csv");

    if (!isCsvFile) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Only CSV files are allowed.",
        });
    }

    const rows = [];

    await new Promise(
      (
        resolve,
        reject
      ) => {
        const stream =
          Readable.from([
            req.file.buffer,
          ]);

        stream
          .pipe(
            csv({
              mapHeaders: ({
                header,
              }) =>
                normalizeText(
                  header
                ).replace(
                  /^\uFEFF/,
                  ""
                ),
              skipLines: 0,
            })
          )
          .on(
            "data",
            (row) => {
              rows.push(row);
            }
          )
          .on(
            "end",
            resolve
          )
          .on(
            "error",
            reject
          );
      }
    );

    if (!rows.length) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "The selected CSV file is empty.",
        });
    }

    const allowedPlans = [
  "free",
  "starter",
  "pro",
  "business",
  "agency",
];

   const allowedRoles = [
    "user",
    "admin",
    "manager",
    "contentcreator",
    "brandcreator",
];

    const seenEmails =
      new Set();

    const results = {
      totalRows:
        rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (
      let index = 0;
      index < rows.length;
      index += 1
    ) {
      const row =
        rows[index];

      const rowNumber =
        index + 2;

      try {
        const email =
          normalizeEmail(
            getRowValue(
              row,
              [
                "Email",
                "Email Address",
                "User Email",
              ]
            )
          );

        if (!email) {
          results.failed +=
            1;

          results.errors.push({
            row: rowNumber,
            email: "",
            message:
              "Email is required.",
          });

          continue;
        }

        const emailPattern =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
          !emailPattern.test(
            email
          )
        ) {
          results.failed +=
            1;

          results.errors.push({
            row: rowNumber,
            email,
            message:
              "Invalid email address.",
          });

          continue;
        }

        if (
          seenEmails.has(
            email
          )
        ) {
          results.skipped +=
            1;

          results.errors.push({
            row: rowNumber,
            email,
            message:
              "Duplicate email inside the CSV file.",
          });

          continue;
        }

        seenEmails.add(
          email
        );

        const name =
          getRowValue(
            row,
            [
              "Name",
              "Full Name",
              "FullName",
              "Username",
            ]
          );

        const phone =
          getRowValue(
            row,
            [
              "Phone",
              "Mobile",
              "Phone Number",
              "Mobile Number",
            ]
          );

        const brand =
          getRowValue(
            row,
            [
              "Brand",
              "Brand Name",
              "Company",
              "Company Name",
            ]
          );

        const requestedPlan =
          getRowValue(
            row,
            ["Plan"]
          ).toLowerCase();

        const requestedRole =
          getRowValue(
            row,
            ["Role"]
          ).toLowerCase();

        const requestedStatus =
          getRowValue(
            row,
            [
              "Status",
              "Account Status",
            ]
          ).toLowerCase();

        const verifiedValue =
          getRowValue(
            row,
            [
              "Verified",
              "Is Verified",
              "Email Verified",
            ]
          );

        const creditsValue =
          getRowValue(
            row,
            ["Credits"]
          );

        const lastLoginValue =
          getRowValue(
            row,
            [
              "Last Login",
              "LastLogin",
            ]
          );

        if (
          requestedPlan &&
          !allowedPlans.includes(
            requestedPlan
          )
        ) {
          results.failed +=
            1;

          results.errors.push({
            row: rowNumber,
            email,
            message:
              "Plan must be free, starter, pro, business or agency.",
          });

          continue;
        }

        if (
          requestedRole &&
          !allowedRoles.includes(
            requestedRole
          )
        ) {
          results.failed +=
            1;

          results.errors.push({
            row: rowNumber,
            email,
            message:
              "Role must be one of: user, admin, manager, contentcreator or brandcreator.",
          });

          continue;
        }

        if (
          requestedStatus &&
          ![
            "active",
            "blocked",
          ].includes(
            requestedStatus
          )
        ) {
          results.failed +=
            1;

          results.errors.push({
            row: rowNumber,
            email,
            message:
              "Status must be Active or Blocked.",
          });

          continue;
        }

        let credits;

        if (creditsValue) {
          credits =
            Number(
              creditsValue
            );

          if (
            Number.isNaN(
              credits
            ) ||
            credits < 0
          ) {
            results.failed +=
              1;

            results.errors.push({
              row: rowNumber,
              email,
              message:
                "Credits must be a non-negative number.",
            });

            continue;
          }
        }

        const existingUser =
          await User.findOne({
            email,
          });

        if (existingUser) {
          if (name) {
            if (
              existingUser.schema.path(
                "name"
              )
            ) {
              existingUser.name =
                name;
            }

            if (
              existingUser.schema.path(
                "fullName"
              )
            ) {
              existingUser.fullName =
                name;
            }
          }

          if (
            phone &&
            existingUser.schema.path(
              "phone"
            )
          ) {
            existingUser.phone =
              phone;
          }

          if (
            phone &&
            existingUser.schema.path(
              "mobile"
            )
          ) {
            existingUser.mobile =
              phone;
          }

          if (
            brand &&
            existingUser.schema.path(
              "brand"
            )
          ) {
            existingUser.brand =
              brand;
          }

          if (
            brand &&
            existingUser.schema.path(
              "brandName"
            )
          ) {
            existingUser.brandName =
              brand;
          }

          if (
            requestedPlan
          ) {
            existingUser.plan =
              requestedPlan;
          }

          if (
            requestedRole
          ) {
            existingUser.role =
              requestedRole;
          }

          if (
            requestedStatus
          ) {
            if (
              existingUser.schema.path(
                "status"
              )
            ) {
              existingUser.status =
                requestedStatus ===
                "blocked"
                  ? "Blocked"
                  : "Active";
            }

            if (
              existingUser.schema.path(
                "isBlocked"
              )
            ) {
              existingUser.isBlocked =
                requestedStatus ===
                "blocked";
            }
          }

          if (
            verifiedValue !==
            ""
          ) {
            existingUser.isVerified =
              parseBoolean(
                verifiedValue,
                existingUser.isVerified
              );
          }

          if (
            credits !==
            undefined
          ) {
            existingUser.credits =
              credits;
          }

          const lastLogin =
            parseDate(
              lastLoginValue
            );

          if (lastLogin) {
            existingUser.lastLogin =
              lastLogin;
          }

          await existingUser.save();

          results.updated +=
            1;

          continue;
        }

        const newUserData = {
          email,
          role:
            requestedRole ||
            "user",
          plan:
            requestedPlan ||
            "free",
          isVerified:
            verifiedValue !==
            ""
              ? parseBoolean(
                  verifiedValue,
                  true
                )
              : true,
          credits:
            credits !==
            undefined
              ? credits
              : 0,
        };

        const userSchema =
          User.schema;

        if (
          name &&
          userSchema.path(
            "name"
          )
        ) {
          newUserData.name =
            name;
        }

        if (
          name &&
          userSchema.path(
            "fullName"
          )
        ) {
          newUserData.fullName =
            name;
        }

        if (
          phone &&
          userSchema.path(
            "phone"
          )
        ) {
          newUserData.phone =
            phone;
        }

        if (
          phone &&
          userSchema.path(
            "mobile"
          )
        ) {
          newUserData.mobile =
            phone;
        }

        if (
          brand &&
          userSchema.path(
            "brand"
          )
        ) {
          newUserData.brand =
            brand;
        }

        if (
          brand &&
          userSchema.path(
            "brandName"
          )
        ) {
          newUserData.brandName =
            brand;
        }

        if (
          requestedStatus
        ) {
          if (
            userSchema.path(
              "status"
            )
          ) {
            newUserData.status =
              requestedStatus ===
              "blocked"
                ? "Blocked"
                : "Active";
          }

          if (
            userSchema.path(
              "isBlocked"
            )
          ) {
            newUserData.isBlocked =
              requestedStatus ===
              "blocked";
          }
        }

        const lastLogin =
          parseDate(
            lastLoginValue
          );

        if (lastLogin) {
          newUserData.lastLogin =
            lastLogin;
        }

        await User.create(
          newUserData
        );

        results.imported +=
          1;
      } catch (rowError) {
        results.failed +=
          1;

        results.errors.push({
          row: rowNumber,
          email:
            getRowValue(
              row,
              ["Email"]
            ) || "",
          message:
            rowError.message ||
            "Unable to import this row.",
        });
      }
    }

    return res
      .status(200)
      .json({
        success: true,
        message: `Import completed. ${results.imported} created, ${results.updated} updated, ${results.skipped} skipped, and ${results.failed} failed.`,
        ...results,
        errors:
          results.errors.slice(
            0,
            100
          ),
      });
  } catch (error) {
    console.error(
      "IMPORT USERS ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to import users.",
      });
  }
};

/* =========================================================
   GET WAITLIST
========================================================= */

exports.getWaitlist = async (
  req,
  res
) => {
  try {
    const waitlist =
      await Waitlist.find().sort({
        createdAt: -1,
      });

    return res
      .status(200)
      .json({
        success: true,
        count:
          waitlist.length,
        waitlist,
      });
  } catch (error) {
    console.error(
      "GET WAITLIST ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to fetch waitlist",
      });
  }
};

/* =========================================================
   TOGGLE USER STATUS
========================================================= */

exports.toggleUserStatus =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      const currentAdminId =
        req.user?._id ||
        req.user?.id;

      if (
        String(user._id) ===
        String(
          currentAdminId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "You cannot block your own admin account",
          });
      }

      let isBlocked;

      if (
        user.schema.path(
          "isBlocked"
        )
      ) {
        user.isBlocked =
          !Boolean(
            user.isBlocked
          );

        isBlocked =
          user.isBlocked;
      } else {
        isBlocked =
          String(
            user.status
          ).toLowerCase() !==
          "blocked";
      }

      if (
        user.schema.path(
          "status"
        )
      ) {
        user.status =
          isBlocked
            ? "Blocked"
            : "Active";
      }

      await user.save();

      return res
        .status(200)
        .json({
          success: true,
          message: isBlocked
            ? "User blocked successfully"
            : "User unblocked successfully",
          user:
            sanitizeUser(
              user
            ),
        });
    } catch (error) {
      console.error(
        "TOGGLE USER STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Unable to update user status",
        });
    }
  };

/* =========================================================
   UPDATE USER PLAN
========================================================= */

exports.updateUserPlan = async (req, res) => {
  try {
    const plan = normalizeText(
      req.body.plan
    ).toLowerCase();

    const allowedPlans = [
      "free",
      "starter",
      "pro",
      "business",
      "agency",
    ];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message:
          "Plan must be free, starter, pro, business or agency.",
      });
    }

    const updateData = {
      plan,
    };

    if (req.body.billingCycle) {
      updateData.billingCycle =
        req.body.billingCycle;
    }

    if (req.body.planStartedAt) {
      updateData.planStartedAt =
        new Date(req.body.planStartedAt);
    }

    if (req.body.planExpiresAt) {
      updateData.planExpiresAt =
        new Date(req.body.planExpiresAt);
    }

    if (req.body.subscriptionStatus) {
      updateData.subscriptionStatus =
        req.body.subscriptionStatus;
    }

    const user =
      await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "-passwordHash -password -verificationToken -verificationTokenExpiresAt -resetToken -resetTokenExpiresAt"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "User plan updated successfully",
      user,
    });
  } catch (error) {
    console.error(
      "UPDATE USER PLAN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to update user plan",
    });
  }
};

/* =========================================================
   GENERAL USER UPDATE
========================================================= */

exports.updateUser = async (
  req,
  res
) => {
  try {
    const allowedFields = [
      "name",
      "fullName",
      "phone",
      "mobile",
      "brand",
      "brandName",
      "role",
      "status",
      "plan",
      "isVerified",
      "credits",
    ];

    const updates = {};

    allowedFields.forEach(
      (field) => {
        if (
          req.body[field] !==
          undefined
        ) {
          updates[field] =
            req.body[field];
        }
      }
    );

    if (
      updates.plan !==
      undefined
    ) {
      updates.plan =
        normalizeText(
          updates.plan
        ).toLowerCase();

      if (
        ![
          
    "free",
    "starter",
    "pro",
    "business",
    "agency",

        ].includes(
          updates.plan
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid user plan",
          });
      }
    }

    if (
      updates.role !==
      undefined
    ) {
      updates.role =
        normalizeText(
          updates.role
        ).toLowerCase();

      if (
        ![
    "user",
    "admin",
    "manager",
    "contentcreator",
    "brandcreator",
].includes(
          updates.role
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid user role",
          });
      }
    }

    const user =
      await User.findByIdAndUpdate(
        req.params.id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "-passwordHash -password -verificationToken -verificationTokenExpiresAt -resetToken -resetTokenExpiresAt"
      );

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "User not found",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        message:
          "User updated successfully",
        user,
      });
  } catch (error) {
    console.error(
      "UPDATE USER ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update user",
      });
  }
};

/* =========================================================
   DELETE USER
========================================================= */

exports.deleteUser = async (
  req,
  res
) => {
  try {
    const currentAdminId =
      req.user?._id ||
      req.user?.id;

    if (
      String(
        req.params.id
      ) ===
      String(
        currentAdminId
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "You cannot delete your own admin account",
        });
    }

    const user =
      await User.findByIdAndDelete(
        req.params.id
      );

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "User not found",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        message:
          "User deleted successfully",
      });
  } catch (error) {
    console.error(
      "DELETE USER ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to delete user",
      });
  }
};


exports.updateUserRole = async (req, res) => {
  try {
    const role = normalizeText(req.body.role).toLowerCase();

    const allowedRoles = [
      "user",
      "admin",
      "manager",
      "contentcreator",
      "brandcreator",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user role.",
      });
    }

    const user =
      await User.findByIdAndUpdate(
        req.params.id,
        { role },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message:
        "User role updated successfully.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   GET ADMIN DASHBOARD STATS
========================================================= */

exports.getDashboardStats = async (
  req,
  res
) => {
  try {
    const [
      totalUsers,
      totalWaitlist,
      totalProducts,
      activeUsers,
      blockedUsers,
      freeUsers,
      starterUsers,
      proUsers,
      businessUsers,
      agencyUsers,
      adminUsers,
      managerUsers,
      brandCreators,
      contentCreators,
      regularUsers,
    ] = await Promise.all([
      User.countDocuments(),

      Waitlist.countDocuments(),

      Product.countDocuments(),

      User.countDocuments({
        $or: [
          { status: "Active" },
          { status: "active" },
          {
            isBlocked: {
              $ne: true,
            },
          },
        ],
      }),

      User.countDocuments({
        $or: [
          { status: "Blocked" },
          { status: "blocked" },
          { isBlocked: true },
        ],
      }),

      User.countDocuments({
        plan: "free",
      }),

      User.countDocuments({
        plan: "starter",
      }),

      User.countDocuments({
        plan: "pro",
      }),

      User.countDocuments({
        plan: "business",
      }),

      User.countDocuments({
        plan: "agency",
      }),

      User.countDocuments({
        role: "admin",
      }),

      User.countDocuments({
        role: "manager",
      }),

      User.countDocuments({
        role: "brandcreator",
      }),

      User.countDocuments({
        role: "contentcreator",
      }),

      User.countDocuments({
        role: "user",
      }),
    ]);

    const recentUsers = await User.find()
      .select(
        "-passwordHash -password " +
          "-verificationToken " +
          "-verificationTokenExpiresAt " +
          "-resetToken " +
          "-resetTokenExpiresAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();

    const recentProducts =
      await Product.find()
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean();

    return res.status(200).json({
      success: true,

      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          blocked: blockedUsers,
        },

        plans: {
          free: freeUsers,
          starter: starterUsers,
          pro: proUsers,
          business: businessUsers,
          agency: agencyUsers,
        },

        roles: {
          admin: adminUsers,
          manager: managerUsers,
          brandcreator:
            brandCreators,
          contentcreator:
            contentCreators,
          user: regularUsers,
        },

        products: {
          total: totalProducts,
        },

        waitlist: {
          total: totalWaitlist,
        },
      },

      recentUsers,
      recentProducts,
    });
  } catch (error) {
    console.error(
      "GET DASHBOARD STATS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load dashboard statistics",
    });
  }
};

/* =========================================================
   GET SINGLE USER
========================================================= */

exports.getUserById = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.params.id
    )
      .select(
        "-passwordHash -password " +
          "-verificationToken " +
          "-verificationTokenExpiresAt " +
          "-resetToken " +
          "-resetTokenExpiresAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const products =
      await Product.find({
        userId: user._id,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,

      user: {
        ...user,
        products,
        productsCount:
          products.length,
      },
    });
  } catch (error) {
    console.error(
      "GET USER BY ID ERROR:",
      error
    );

    if (
      error.name ===
      "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user ID",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch user",
    });
  }
};

/* =========================================================
   EXPORT USERS TO CSV
========================================================= */

const escapeCsvValue = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
};

exports.exportUsers = async (
  req,
  res
) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role =
        normalizeText(
          req.query.role
        ).toLowerCase();
    }

    if (req.query.plan) {
      filter.plan =
        normalizeText(
          req.query.plan
        ).toLowerCase();
    }

    if (req.query.status) {
      const status =
        normalizeText(
          req.query.status
        ).toLowerCase();

      if (
        status === "blocked"
      ) {
        filter.$or = [
          { status: "Blocked" },
          { status: "blocked" },
          { isBlocked: true },
        ];
      }

      if (
        status === "active"
      ) {
        filter.$and = [
          {
            $or: [
              { status: "Active" },
              { status: "active" },
              {
                status: {
                  $exists: false,
                },
              },
            ],
          },
          {
            isBlocked: {
              $ne: true,
            },
          },
        ];
      }
    }

    const users =
      await User.find(filter)
        .select(
          "-passwordHash -password " +
            "-verificationToken " +
            "-verificationTokenExpiresAt " +
            "-resetToken " +
            "-resetTokenExpiresAt"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Brand",
      "Role",
      "Plan",
      "Status",
      "Verified",
      "Credits",
      "Last Login",
      "Created At",
    ];

    const rows = users.map(
      (user) => {
        const name =
          user.name ||
          user.fullName ||
          "";

        const phone =
          user.phone ||
          user.mobile ||
          "";

        const brand =
          user.brand ||
          user.brandName ||
          "";

        const status =
          user.isBlocked === true ||
          String(
            user.status || ""
          ).toLowerCase() ===
            "blocked"
            ? "Blocked"
            : "Active";

        return [
          user._id,
          name,
          user.email || "",
          phone,
          brand,
          user.role || "user",
          user.plan || "free",
          status,
          user.isVerified
            ? "Yes"
            : "No",
          user.credits ?? 0,
          user.lastLogin
            ? new Date(
                user.lastLogin
              ).toISOString()
            : "",
          user.createdAt
            ? new Date(
                user.createdAt
              ).toISOString()
            : "",
        ]
          .map(escapeCsvValue)
          .join(",");
      }
    );

    const csvContent = [
      headers.join(","),
      ...rows,
    ].join("\n");

    const fileName =
      `users-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    return res.status(200).send(
      `\uFEFF${csvContent}`
    );
  } catch (error) {
    console.error(
      "EXPORT USERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to export users",
    });
  }
};

/* =========================================================
   UPDATE USER CREDITS
========================================================= */

exports.updateUserCredits =
  async (req, res) => {
    try {
      const operation =
        normalizeText(
          req.body.operation
        ).toLowerCase();

      const credits =
        Number(
          req.body.credits
        );

      const allowedOperations = [
        "add",
        "subtract",
        "set",
      ];

      if (
        !allowedOperations.includes(
          operation
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Operation must be add, subtract or set",
          });
      }

      if (
        Number.isNaN(credits) ||
        credits < 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Credits must be a non-negative number",
          });
      }

      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      const currentCredits =
        Number(
          user.credits || 0
        );

      if (
        operation === "add"
      ) {
        user.credits =
          currentCredits +
          credits;
      }

      if (
        operation ===
        "subtract"
      ) {
        if (
          credits >
          currentCredits
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "User does not have enough credits",
            });
        }

        user.credits =
          currentCredits -
          credits;
      }

      if (
        operation === "set"
      ) {
        user.credits =
          credits;
      }

      await user.save();

      return res
        .status(200)
        .json({
          success: true,
          message:
            "User credits updated successfully",
          credits:
            user.credits,
          user:
            sanitizeUser(
              user
            ),
        });
    } catch (error) {
      console.error(
        "UPDATE USER CREDITS ERROR:",
        error
      );

      if (
        error.name ===
        "CastError"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid user ID",
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Unable to update user credits",
        });
    }
  };

/* =========================================================
   RESET USER TRIAL
========================================================= */

exports.resetUserTrial =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      const now =
        new Date();

      const trialDays =
        Number(
          req.body.trialDays ||
            process.env
              .FREE_TRIAL_DAYS ||
            14
        );

      if (
        Number.isNaN(
          trialDays
        ) ||
        trialDays <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Trial days must be greater than zero",
          });
      }

      const trialEndsAt =
        new Date(now);

      trialEndsAt.setDate(
        trialEndsAt.getDate() +
          trialDays
      );

      const schema =
        user.schema;

      if (
        schema.path(
          "trialStartedAt"
        )
      ) {
        user.trialStartedAt =
          now;
      }

      if (
        schema.path(
          "trialEndsAt"
        )
      ) {
        user.trialEndsAt =
          trialEndsAt;
      }

      if (
        schema.path(
          "trialEndDate"
        )
      ) {
        user.trialEndDate =
          trialEndsAt;
      }

      if (
        schema.path(
          "isTrialActive"
        )
      ) {
        user.isTrialActive =
          true;
      }

      if (
        schema.path(
          "trialUsed"
        )
      ) {
        user.trialUsed =
          false;
      }

      if (
        schema.path(
          "trialExpired"
        )
      ) {
        user.trialExpired =
          false;
      }

      if (
        schema.path(
          "subscriptionStatus"
        )
      ) {
        user.subscriptionStatus =
          "trial";
      }

      await user.save();

      return res
        .status(200)
        .json({
          success: true,
          message:
            `User trial reset for ${trialDays} days`,
          trial: {
            startedAt:
              now,
            endsAt:
              trialEndsAt,
            days:
              trialDays,
          },
          user:
            sanitizeUser(
              user
            ),
        });
    } catch (error) {
      console.error(
        "RESET USER TRIAL ERROR:",
        error
      );

      if (
        error.name ===
        "CastError"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid user ID",
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message ||
            "Unable to reset user trial",
        });
    }
  };