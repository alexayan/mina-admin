"use strict";
const REG = /([A-Z])/g;

module.exports = function(str) {
  return str
    .replace(REG, "_$1")
    .replace(/^_/, "")
    .toLowerCase();
};
