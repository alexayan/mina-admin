"use strict";
const log4js = require("log4js");

log4js.configure({
  appenders: {
    out: { type: "stdout" }
  },
  categories: {
    default: { appenders: ["out"], level: "all" }
  }
});

module.exports = log4js;
