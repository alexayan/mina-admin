"use strict";

module.exports = {
  decode(query) {
    try {
      const parts = query.split("&");
      const rtn = {};
      parts.forEach(part => {
        const items = part.split("=");
        if (items.length === 2) {
          rtn[items[0]] = items[1];
        }
      });
      return rtn;
    } catch (e) {
      return {};
    }
  },
  encode(query) {
    const pairs = [];
    for (const key in query) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        pairs.push(`${key}=${encodeURIComponent(query[key])}`);
      }
    }

    return pairs.join("&");
  }
};
