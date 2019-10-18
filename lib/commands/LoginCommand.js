"use strict";

/**
 * @description 公众平台扫码登录
 */

const crypto = require("crypto");
const _ = require("lodash");
const nodeurl = require("url");
const assert = require("assert");

const Command = require("../command");

class LoginCommand extends Command {
  async exec() {
    const { account, password } = this.args;
    const md5 = crypto.createHash("md5");
    const cryptoPassword = md5.update(password).digest("hex");
    let resp;
    let content;

    this.logger.info(`${account} login...`);
    const isLogin = await this.checkLogin();

    if (isLogin) {
      return;
    }

    this.logger.info("start login", account);

    const openId = _.get(this.admin.getUser(), "openid", "");

    if (openId) {
      this.logger.info("wechat login");
      await this.fetch("https://mp.weixin.qq.com/cgi-bin/bizlogin", {
        body: `action=report&openid=${openId}&token=&lang=zh_CN&f=json&ajax=1`,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        }
      });
      resp = await this.fetch(
        "https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin",
        {
          body: `openid=${openId}&userlang=zh_CN&token=&lang=zh_CN&f=json&ajax=1`,
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          }
        }
      );
      content = await resp.json();
    } else {
      this.setCookie("");
      this.logger.info("qrcode login");
      resp = await this.fetch(
        "https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin",
        {
          body: `username=${encodeURIComponent(
            account
          )}&pwd=${cryptoPassword}&imgcode=${this.verifyCode ||
            ""}&f=json&userlang=zh_CN&redirect_url=&token=&lang=zh_CN&ajax=1`,
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          }
        }
      );
      content = await resp.json();
    }

    const cookies = resp.headers.raw()["set-cookie"];
    this.setCookie(cookies.join(";"));
    this.logger.info("cookies: ", cookies);
    this.logger.info("loginInfo: ", content);
    if (_.get(content, "base_resp.ret", -1) === 200008) {
      resp = await this.fetch(
        `https://mp.weixin.qq.com/cgi-bin/verifycode?username=${account}&r=${Date.now()}`
      );

      content = await resp.buffer();
      console.log(await this.renderQrcode(content));
      this.verifyCode = require("prompt-sync")()("please input verify code: ");
      resp = await this.exec();
      return resp;
    }

    if (_.get(content, "base_resp.ret", -1) !== 0) {
      this.setCookie("");
      throw new Error("login fail");
    }

    if (!openId) {
      resp = await this.fetch(
        `https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=getqrcode&param=4300&rd=${Math.floor(
          Math.random() * 100
        )}`
      );

      content = await resp.buffer();

      this.admin.emit("qrcode", content);

      console.log(await this.renderQrcode(content));
    }

    this.checkQrcode();

    try {
      await new Promise((resolve, reject) => {
        this.on("qrcode-success", resolve);
        this.on("qrcode-fail", reject);
      });
      resp = await this.fetch(
        "https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login",
        {
          method: "POST",
          data: {
            f: "json"
          }
        }
      );
      content = await resp.json();
      const cookies = resp.headers.raw()["set-cookie"];
      this.setCookie(cookies.join(";"));
      this.logger.info("login info", content);
      assert(content.redirect_url, "miss c");
      const redirectUrl = new nodeurl.URL(
        nodeurl.resolve("https://mp.weixin.qq.com", content.redirect_url)
      );
      this.setURLParams(redirectUrl.search.slice(1));
      const isLogin = await this.checkLogin();
      if (!isLogin) {
        await this.exec();
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.info("qrcode expired, reload....");
      await this.exec();
    }
  }

  clean() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  async checkLogin() {
    try {
      this.logger.info("check login");
      let resp = await this.fetch(
        "https://mp.weixin.qq.com/wxamp/index/index",
        {
          method: "GET"
        }
      );
      let content = await resp.text();
      let userInfo = JSON.parse(/{.+}/.exec(content));
      if (userInfo && userInfo.openid) {
        this.logger.info(`${this.args.account} login success`);
        this.admin.setUser(userInfo);
        this.admin.emit("login-success");
        this.setURLParams(`openid=${userInfo.openid}`);
        return true;
      }

      this.logger.info("userInfo", userInfo);

      return false;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }

  async checkQrcode() {
    try {
      const resp = await this.fetch(
        "https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=ask&token=&lang=zh_CN&f=json&ajax=1"
      );
      const content = await resp.json();
      const status = _.get(content, "status", 0);
      this.logger.info("qrcode check state", status, content);
      if (status === 1) {
        return this.emit("qrcode-success");
      }

      if (status === 3) {
        return this.emit("qrcode-fail");
      }
    } catch (e) {
      this.logger.error(e);
      return this.emit("qrcode-fail");
    }

    this.timer = setTimeout(this.checkQrcode.bind(this), 1000);
  }
}

module.exports = LoginCommand;
