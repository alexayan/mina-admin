"use strict";

/**
 * @description  小程序码生成服务
 */

const querystring = require("../utils/querystring");
const Command = require("../command");

class MinaQrcodeCommand extends Command {
  async exec() {
    const opt = this.args.type;
    switch (opt) {
      case "gen":
        return this.genQrcode();
      default:
        throw new Error(`${opt} not support`);
    }
  }

  async genQrcode() {
    this.logger.info("gen mina qrcode...");
    let appId = this.args.appId;
    const appPath = this.args.appPath;
    if (!appId) {
      throw new Error(
        "请输入正确的小程序的名称/AppID/账号原始ID，并确保小程序允许被搜索"
      );
    }

    if (!appPath) {
      throw new Error("请输入正确的小程序路径");
    }

    if (!/^wx.{16}$/.test(appId)) {
      appId = await this.getAppidByAppName(appId);
    }

    const userInfo = this.admin.getUser();
    const params = {
      path: `/wxopen/wxaqrcode?action=getqrcode&f=json&appid=${appId}&path=${encodeURIComponent(
        appPath
      )}&token=${userInfo.token}&lang=zh_CN`,
      token: userInfo.token,
      random: String(Math.random())
    };
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`
    );
    let content = await resp.json();
    console.log(content)
    if (!content.base64img) {
      throw new Error(`小程序码生成失败`);
    }

    return content.base64img;
  }

  /**
   * 根据名称/AppID/账号原始ID获取 appId
   * @param {string} appName 名称/AppID/账号原始ID
   */
  async getAppidByAppName(appName) {
    this.logger.info("getAppidByAppName...", appName);
    const userInfo = this.admin.getUser();
    const params = {
      path: `/wxopen/wxaqrcode?action=search`,
      token: userInfo.token,
      random: String(Math.random())
    };
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`,
      {
        body: `appid=${encodeURIComponent(appName)}`,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        }
      }
    );
    let content = await resp.json();
    if (!content.appid) {
      throw new Error(
        `请输入正确的小程序的名称/AppID/账号原始ID，并确保小程序允许被搜索`
      );
    }

    return content.appid;
  }
}

module.exports = MinaQrcodeCommand;
