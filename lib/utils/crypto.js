const crypto = require("crypto");

function encrypt(data, key) {
  let cipher = crypto.createCipher("aes-256-cbc", key);
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function decrypt(encrypt, key) {
  let decipher = crypto.createDecipher("aes-256-cbc", key);
  let decrypted = decipher.update(encrypt, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
