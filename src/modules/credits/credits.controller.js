const Razorpay = require("razorpay");
const crypto = require("crypto");

const User = require("../../models/User");
const CreditOrder = require("../../models/CreditOrder");
const CreditTransaction = require("../../models/CreditTransaction");

const CREDIT_PACKAGES = {
  starter: {
    id: "starter",
    name: "Starter Credits",
    credits: 500,
    amount: 499,
    currency: "INR",
  },

  creator: {
    id: "creator",
    name: "Creator Credits",
    credits: 2500,
    amount: 1999,
    currency: "INR",
  },

  business: {
    id: "business",
    name: "Business Credits",
    credits: 10000,
    amount: 6999,
    currency: "INR",
  },
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


exports.getPackages = async (req, res) => {
  res.json({
    success: true,
    packages: Object.values(CREDIT_PACKAGES),
  });
};

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { packageId } = req.body;

    console.log("CREATE CREDIT ORDER:", {
      userId,
      packageId,
    });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: "Package ID is required",
      });
    }

    const creditPackage = CREDIT_PACKAGES[packageId];

    if (!creditPackage) {
      return res.status(400).json({
        success: false,
        message: `Invalid credit package: ${packageId}`,
      });
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      console.error("Razorpay environment variables are missing");

      return res.status(500).json({
        success: false,
        message: "Razorpay configuration is missing",
      });
    }

    // Keep the receipt short
    const receipt = `cr_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: Math.round(creditPackage.amount * 100),
      currency: creditPackage.currency,
      receipt,
      notes: {
        userId: String(userId),
        packageId: String(creditPackage.id),
        credits: String(creditPackage.credits),
      },
    });

    console.log("RAZORPAY ORDER CREATED:", order.id);

    const savedOrder = await CreditOrder.create({
      userId,
      packageId: creditPackage.id,
      credits: creditPackage.credits,
      amount: creditPackage.amount,
      currency: creditPackage.currency,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.status(201).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      package: creditPackage,
      creditOrderId: savedOrder._id,
    });
  } catch (error) {
    console.error("CREATE CREDIT ORDER ERROR:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      razorpayError: error.error,
      mongoErrors: error.errors,
    });

    return res.status(500).json({
      success: false,
      message:
        error.error?.description ||
        error.error?.reason ||
        error.message ||
        "Unable to create credit order",
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details are required",
      });
    }

    const order = await CreditOrder.findOne({
      razorpayOrderId: razorpay_order_id,
      userId: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Credit order not found",
      });
    }

    if (order.status === "success") {
      const user = await User.findById(req.user.id).select("credits");

      return res.json({
        success: true,
        message: "Credits already added",
        credits: user?.credits || 0,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      order.status = "failed";
      await order.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: {
          credits: order.credits,
        },
      },
      {
        new: true,
      }
    ).select("credits");

    order.status = "success";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    await CreditTransaction.create({
      userId: req.user.id,
      type: "purchase",
      credits: order.credits,
      balanceAfter: user.credits,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      description: `Purchased ${order.credits} credits`,
    });

    res.json({
      success: true,
      message: `${order.credits} credits added successfully`,
      credits: user.credits,
    });
  } catch (error) {
    console.error("VERIFY CREDIT PAYMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Unable to verify credit payment",
    });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("credits");

    res.json({
      success: true,
      credits: user?.credits || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch credit balance",
    });
  }
};