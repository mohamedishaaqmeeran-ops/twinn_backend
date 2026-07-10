require("dotenv").config();
const mongoose = require("mongoose");

const MarketplaceAvatar = require("../models/MarketplaceAvatar");

const avatars = [
  {
    name: "Ariana Sales Host",
    slug: "ariana-sales-host",
    image: "https://twinn.live/images/vijay.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/vijay.mp4",
    description:
      "Elegant live-commerce presenter for beauty, fashion and lifestyle products.",
    category: "Fashion",
    credits: 500,
    voice: "Warm Female",
    featured: true,
    premium: true,
    active: true,
    licenseType: "original",
  },
   /*{
    name: "Daniel Business Coach",
    slug: "daniel-business-coach",
    image: "https://twinn.live/images/avatars/daniel.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/daniel-preview.mp4",
    description:
      "Professional corporate presenter for SaaS, finance and business products.",
    category: "Business",
    credits: 750,
    voice: "Professional Male",
    featured: true,
    premium: true,
    active: true,
    licenseType: "original",
  },
 {
    name: "Maya Fitness Trainer",
    slug: "maya-fitness-trainer",
    image: "https://twinn.live/images/avatars/maya.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/maya-preview.mp4",
    description:
      "High-energy fitness presenter for wellness and sports campaigns.",
    category: "Fitness",
    credits: 400,
    voice: "Energetic Female",
    featured: true,
    premium: false,
    active: true,
    licenseType: "original",
  },
  {
    name: "Leo Tech Creator",
    slug: "leo-tech-creator",
    image: "https://twinn.live/images/avatars/leo.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/leo-preview.mp4",
    description:
      "Modern technology presenter for gadgets, apps and electronics.",
    category: "Technology",
    credits: 650,
    voice: "Confident Male",
    featured: true,
    premium: true,
    active: true,
    licenseType: "original",
  },
  {
    name: "Sophia Luxury Host",
    slug: "sophia-luxury-host",
    image: "https://twinn.live/images/avatars/sophia.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/sophia-preview.mp4",
    description:
      "Premium presenter for jewellery, luxury fashion and beauty products.",
    category: "Luxury",
    credits: 1000,
    voice: "Luxury Female",
    featured: true,
    premium: true,
    active: true,
    licenseType: "original",
  },
  {
    name: "Ryan Gaming Host",
    slug: "ryan-gaming-host",
    image: "https://twinn.live/images/avatars/ryan.webp",
    previewVideo:
      "https://twinn.live/videos/avatars/ryan-preview.mp4",
    description:
      "Engaging gaming creator for streams, accessories and entertainment.",
    category: "Gaming",
    credits: 550,
    voice: "Energetic Male",
    featured: false,
    premium: false,
    active: true,
    licenseType: "original",
  },*/
];

async function seedAvatars() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    for (const avatar of avatars) {
      await MarketplaceAvatar.findOneAndUpdate(
        { slug: avatar.slug },
        { $set: avatar },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      console.log(`Seeded: ${avatar.name}`);
    }

    const count = await MarketplaceAvatar.countDocuments({
      active: true,
    });

    console.log(`Active marketplace avatars: ${count}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("SEED AVATARS ERROR:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seedAvatars();