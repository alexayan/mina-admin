"use strict";

const EventEmitter = require("events");
const fetch = require("node-fetch");
const _ = require("lodash");
const nodeurl = require("url");
const jsdom = require("jsdom");
const Jimp = require("jimp");
const chalk = require("chalk");

const Logger = require("./utils/logger");
const camelToLine = require("./utils/camelToLine");
const querystring = require("./utils/querystring");

const COMMON_HEADER = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-requested-with": "XMLHttpRequest",
  referer: "https://mp.weixin.qq.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36",
  origin: "https://mp.weixin.qq.com",
  Host: "mp.weixin.qq.com"
};

class AdminCommand extends EventEmitter {
  constructor(admin, args = {}) {
    super();
    this.admin = admin;
    this.args = args;
    this.options = args.options || {};
    this.logger = Logger.getLogger(this.commandName());
  }

  async exec() {
    throw new Error(`${this.constructor.name}.exec not implement yet...`);
  }

  clean() {}

  _clean() {
    if (this.tickerTimer) {
      clearTimeout(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  async fetch(url, options = {}) {
    const query = this.getQuery();
    if (query) {
      const params = new URLSearchParams(query);
      const _url = new nodeurl.URL(url);
      params.forEach((value, name) => {
        _url.searchParams.set(name, value);
      });
      url = _url.toString();
    }

    options.headers = _.assign(
      {
        Cookie: this.getCookie()
      },
      COMMON_HEADER,
      options.headers || {}
    );
    options.method = options.method || "GET";
    url = nodeurl.resolve("https://mp.weixin.qq.com", url);
    const resp = await fetch(url, options);

    if (resp.headers.get("content-type").indexOf("application/json") > -1) {
      const cloneResp = await resp.clone();
      const content = await cloneResp.json();
      if (_.get(content, "ret") === 200003) {
        this.admin.emit("login-expired");
      }
    }

    return resp;
  }

  async getTicket(params = {}) {
    this.logger.info("start get ticket...", params);
    params.action = "getticket";
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwaqrcode&random=${Math.random()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: querystring.encode(params)
      }
    );
    let content = await resp.json();
    this.logger.info(content);
    const ticket = content.qrcheck_ticket;
    if (!ticket) {
      throw new Error("get ticket fail");
    }

    resp = await this.fetch(
      `https://mp.weixin.qq.com/wxopen/waqrcode?action=getqrcode&qrcheck_ticket=${ticket}&size165`
    );

    content = await resp.buffer();
    this.admin.emit("qrcode", content);
    console.log(await this.renderQrcode(content));
    this.checkTicketQrcode(ticket);
    await new Promise((resolve, reject) => {
      this.on("ticket-qrcode-success", resolve);
      this.on("ticket-qrcode-fail", reject);
    });
    this.logger.info("ticket ok", ticket);
    return ticket;
  }

  getQuery() {
    return _.get(this.admin.getStorage(), "query", "");
  }

  getCookie() {
    return _.get(this.admin.getStorage(), "cookie", "");
  }

  setCookie(cookie) {
    _.set(this.admin.getStorage(), "cookie", cookie);
    this.admin.saveStorage();
  }

  setURLParams(query) {
    const old = this.getQuery();
    _.set(
      this.admin.getStorage(),
      "query",
      querystring.encode(
        _.assign({}, querystring.decode(old), querystring.decode(query))
      )
    );
    this.admin.saveStorage();
  }

  dom(html) {
    return new jsdom.JSDOM(html);
  }

  commandName() {
    return camelToLine(this.constructor.name.replace(/Command$/, ""));
  }

  async checkTicketQrcode(ticket) {
    try {
      const resp = await this.fetch(
        `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwaqrcode%3F%252Fwxopen%252Fwaqrcode%3D%26f%3Djson%26action%3Dask%26qrcheck_ticket%3D${ticket}%26appid%3D%26token%3D1200866444%26lang%3Dzh_CN&lang=zh_CN&random=${Math.random()}`
      );
      const content = await resp.json();
      const status = _.get(content, "status", 0);
      this.logger.info("ticket qrcode check state", ticket, status, content);
      if (status === 1) {
        return this.emit("ticket-qrcode-success");
      }

      if (status === 3) {
        return this.emit("ticket-qrcode-fail");
      }
    } catch (e) {
      this.logger.error(e);
      return this.emit("ticket-qrcode-fail");
    }

    this.tickerTimer = setTimeout(() => {
      this.checkTicketQrcode(ticket);
    }, 1000);
  }

  // https://github.com/sindresorhus/terminal-image/blob/master/index.js
  async renderQrcode(buffer) {
    const PIXEL = "\u2584";
    const image = await Jimp.read(buffer);
    const columns = 114;
    const rows = 41;
    if (image.bitmap.width > columns || image.bitmap.height / 2 > rows) {
      image.scaleToFit(columns, rows * 2);
    }

    let result = "";
    for (let y = 0; y < image.bitmap.height - 1; y += 2) {
      for (let x = 0; x < image.bitmap.width; x++) {
        const { r, g, b, a } = Jimp.intToRGBA(image.getPixelColor(x, y));
        const { r: r2, g: g2, b: b2 } = Jimp.intToRGBA(
          image.getPixelColor(x, y + 1)
        );

        if (a === 0) {
          result += chalk.reset(" ");
        } else {
          result += chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(PIXEL);
        }
      }

      result += "\n";
    }

    return result;
  }
}

module.exports = AdminCommand;
