const {
  Storage,
} = require(
  "@google-cloud/storage"
);

const crypto =
  require("crypto");

const storage =
  new Storage();

const bucket =
  storage.bucket(
    process.env
      .GCS_BUCKET_NAME
  );

const uploadBuffer =
  async ({
    buffer,
    folder,
    extension,
    contentType,
  }) => {
    if (!buffer) {
      throw new Error(
        "Upload buffer is required."
      );
    }

    const id =
      crypto.randomUUID();

    const fileName =
      `${folder}/${id}.${extension}`;

    const file =
      bucket.file(
        fileName
      );

    await file.save(
      buffer,
      {
        resumable:
          false,

        metadata: {
          contentType,

          cacheControl:
            "public, max-age=31536000",
        },
      }
    );

    await file.makePublic();

    return {
      url:
        `https://storage.googleapis.com/${bucket.name}/${fileName}`,

      fileName,
    };
  };

module.exports = {
  uploadBuffer,
};