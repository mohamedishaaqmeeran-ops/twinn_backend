const Product = require(
  "../../models/Product"
);

const embeddingService =
  require(
    "../twins/embedding.service"
  );

exports.searchKnowledge =
  async ({
    userId,
    twinId,
    query,
  }) => {
    const chunks =
      await embeddingService
        .searchKnowledge({
          userId,
          twinId,
          query,
          limit: 5,
        });

    return chunks.map(
      (chunk) => ({
        title:
          chunk.sourceTitle,

        sourceType:
          chunk.sourceType,

        content:
          chunk.content,

        similarity:
          chunk.similarity,
      })
    );
  };

exports.getProduct =
  async ({
    userId,
    productId,
  }) => {
    const product =
      await Product.findOne({
        _id: productId,
        userId,
      }).lean();

    if (!product) {
      throw new Error(
        "Product not found."
      );
    }

    return {
      id: product._id,
      name: product.name,
      description:
        product.description || "",
      price:
        product.price ?? null,
      stock:
        product.stock ?? null,
      status:
        product.status || "",
    };
  };