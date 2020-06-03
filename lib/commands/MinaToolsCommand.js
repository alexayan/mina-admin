"use strict";

/**
 * @description  小程序码生成服务
 */

const querystring = require("../utils/querystring");
const Command = require("../command");

class MinaToolsCommand extends Command {
  async exec() {
    const opt = this.args.type;
    switch (opt) {
      case "copy-path":
        return this.enableCopyMinaPath();
      case "appid":
        return this.queryAppId();
      default:
        throw new Error(`${opt} not support`);
    }
  }

  /**
   * 开启小程序路径复制
   */
  async enableCopyMinaPath() {
    this.logger.info("enable copy mina path...");
    let appId = this.args.appId;
    const userName = this.args.userName;
    if (!appId) {
      throw new Error(
        "请输入正确的小程序的名称/AppID/账号原始ID，并确保小程序允许被搜索"
      );
    }

    if (!userName) {
      throw new Error("请输入项目成员的微信号");
    }

    if (!/^wx.{16}$/.test(appId)) {
      appId = await this.getAppidByAppName(appId);
    }

    const userInfo = this.admin.getUser();
    const params = {
      path: `/wxopen/wxaqrcode?action=copy_wxa_path`,
      token: userInfo.token,
      random: String(Math.random())
    };
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`,
      {
        body: `appid=${appId}&username=${userName}`,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        }
      }
    );
    let content = await resp.json();
    return !content.ret;
  }

  async queryAppId() {
    this.logger.info("query appid...");
    let appName = this.args.appName;
    if (!appName) {
      throw new Error(
        "请输入正确的小程序的名称/AppID/账号原始ID，并确保小程序允许被搜索"
      );
    }

    const appId = await this.getAppidByAppName(appName);
    return appId;
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

module.exports = MinaToolsCommand;
