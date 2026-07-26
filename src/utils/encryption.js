const crypto =
  require("crypto");

const ALGORITHM =
  "aes-256-gcm";

const getEncryptionKey =
  () => {
    const secret =
      process.env
        .RTMP_ENCRYPTION_KEY;

    if (!secret) {
      throw new Error(
        "RTMP_ENCRYPTION_KEY is missing."
      );
    }

    return crypto
      .createHash("sha256")
      .update(String(secret))
      .digest();
  };

exports.encryptValue =
  (
    value
  ) => {
    if (!value) {
      return "";
    }

    const key =
      getEncryptionKey();

    const iv =
      crypto.randomBytes(12);

    const cipher =
      crypto.createCipheriv(
        ALGORITHM,
        key,
        iv
      );

    const encrypted =
      Buffer.concat([
        cipher.update(
          String(value),
          "utf8"
        ),
        cipher.final(),
      ]);

    const authTag =
      cipher.getAuthTag();

    return [
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted.toString("hex"),
    ].join(":");
  };

exports.decryptValue =
  (
    encryptedValue
  ) => {
    if (!encryptedValue) {
      return "";
    }

    const [
      ivHex,
      authTagHex,
      encryptedHex,
    ] =
      String(
        encryptedValue
      ).split(":");

    if (
      !ivHex ||
      !authTagHex ||
      !encryptedHex
    ) {
      throw new Error(
        "Invalid encrypted value."
      );
    }

    const key =
      getEncryptionKey();

    const decipher =
      crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(
          ivHex,
          "hex"
        )
      );

    decipher.setAuthTag(
      Buffer.from(
        authTagHex,
        "hex"
      )
    );

    const decrypted =
      Buffer.concat([
        decipher.update(
          Buffer.from(
            encryptedHex,
            "hex"
          )
        ),
        decipher.final(),
      ]);

    return decrypted.toString(
      "utf8"
    );
  };