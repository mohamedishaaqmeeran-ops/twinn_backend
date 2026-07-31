const express =
  require("express");

const router =
  express.Router();

/* =========================================================
   ROUTE IMPORTS
========================================================= */

const authRoutes =
  require(
    "../modules/auth/auth.routes"
  );

const paymentRoutes =
  require(
    "../modules/payment/payment.routes"
  );

const productRoutes =
  require(
    "../modules/products/product.routes"
  );

const socialRoutes =
  require(
    "../modules/social/social.routes"
  );

const realtimeRoutes =
  require(
    "../modules/realtime/realtime.routes"
  );

const waitlistRoutes =
  require(
    "../modules/waitlist/waitlist.routes"
  );

const liveRoutes =
  require(
    "../modules/live/live.routes"
  );

const blogRoutes =
  require(
    "../modules/blog/blog.routes"
  );

const twinRoutes =
  require(
    "../modules/twins/twin.routes"
  );

const avatarRoutes =
  require(
    "../modules/avatar/avatar.routes"
  );

const creditsRoutes =
  require(
    "../modules/credits/credits.routes"
  );

const adminRoutes =
  require(
    "../modules/admin/admin.routes"
  );

const scheduleRoutes =
  require(
    "../modules/schedule/schedule.routes"
  );

/* =========================================================
   API INFORMATION
========================================================= */

router.get(
  "/",
  (
    req,
    res
  ) => {
    return res
      .status(200)
      .json({
        success: true,

        message:
          "Twinn API",

        version:
          process.env
            .API_VERSION ||
          "1.0.0",

        endpoints: {
          auth:
            "/api/auth",

          payments:
            "/api/payments",

          products:
            "/api/products",

          social:
            "/api/social",

          realtime:
            "/api/realtime",

          waitlist:
            "/api/waitlist",

          live:
            "/api/live",

          blogs:
            "/api/blogs",

          twin:
            "/api/twin",

          avatar:
            "/api/avatar",

          credits:
            "/api/credits",

          admin:
            "/api/admin",

          schedules:
            "/api/schedules",
        },
      });
  }
);

/* =========================================================
   ROUTE REGISTRATION
========================================================= */

router.use(
  "/auth",
  authRoutes
);

router.use(
  "/payments",
  paymentRoutes
);

router.use(
  "/products",
  productRoutes
);

router.use(
  "/social",
  socialRoutes
);

router.use(
  "/realtime",
  realtimeRoutes
);

router.use(
  "/waitlist",
  waitlistRoutes
);

router.use(
  "/live",
  liveRoutes
);

router.use(
  "/blogs",
  blogRoutes
);

router.use(
  "/twin",
  twinRoutes
);

router.use(
  "/avatar",
  avatarRoutes
);

router.use(
  "/credits",
  creditsRoutes
);

router.use(
  "/admin",
  adminRoutes
);

router.use(
  "/schedules",
  scheduleRoutes
);

module.exports =
  router;