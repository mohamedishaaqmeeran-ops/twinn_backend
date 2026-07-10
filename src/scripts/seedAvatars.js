require("dotenv").config();
const mongoose = require("mongoose");

const MarketplaceAvatar = require("../models/MarketplaceAvatar");

const avatars = [
  {
    name: "Ariana Sales Host",
    slug: "ariana-sales-host",
    image: "/images/avatars/ariana.webp",
    previewVideo: "/videos/avatars/ariana-preview.mp4",
    description:
      "Elegant live-commerce presenter for beauty, fashion and lifestyle products.",
    category: "Fashion",
    credits: 500,
    voice: "Warm Female",
    featured: true,
    premium: true,
    licenseType: "original",
  },
  {
    name: "Daniel Business Coach",
    slug: "daniel-business-coach",
    image: "/images/avatars/daniel.webp",
    previewVideo: "/videos/avatars/daniel-preview.mp4",
    description:
      "Professional corporate presenter for SaaS, finance and business products.",
    category: "Business",
    credits: 750,
    voice: "Professional Male",
    featured: true,
    premium: true,
    licenseType: "original",
  },
  {
    name: "Maya Fitness Trainer",
    slug: "maya-fitness-trainer",
    image: "/images/avatars/maya.webp",
    previewVideo: "/videos/avatars/maya-preview.mp4",
    description:
      "High-energy fitness presenter for wellness and sports campaigns.",
    category: "Fitness",
    credits: 400,
    voice: "Energetic Female",
    featured: true,
    premium: false,
    licenseType: "original",
  },
  {
    name: "Leo Tech Creator",
    slug: "leo-tech-creator",
    image: "/images/avatars/leo.webp",
    previewVideo: "/videos/avatars/leo-preview.mp4",
    description:
      "Modern technology creator for gadgets, apps and electronics.",
    category: "Technology",
    credits: 650,
    voice: "Confident Male",
    featured: true,
    premium: true,
    licenseType: "original",
  },
  {
    name: "Sophia Luxury Host",
    slug: "sophia-luxury-host",
    image: "/images/avatars/sophia.webp",
    previewVideo: "/videos/avatars/sophia-preview.mp4",
    description:
      "Premium presenter for jewellery, luxury fashion and beauty products.",
    category: "Luxury",
    credits: 1000,
    voice: "Luxury Female",
    featured: true,
    premium: true,
    licenseType: "original",
  },
  {
    name: "Ryan Gaming Host",
    slug: "ryan-gaming-host",
    image: "/images/avatars/ryan.webp",
    previewVideo: "/videos/avatars/ryan-preview.mp4",
    description:
      "Engaging gaming creator for streams, accessories and entertainment.",
    category: "Gaming",
    credits: 550,
    voice: "Energetic Male",
    featured: false,
    premium: false,
    licenseType: "original",
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    for (const avatar of avatars) {
      await MarketplaceAvatar.findOneAndUpdate(
        { slug: avatar.slug },
        avatar,
        {
          upsert: true,
          new: true,
        }
      );
    }

    console.log("Marketplace avatars seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("SEED AVATAR ERROR:", error);
    process.exit(1);
  }
};

seed();