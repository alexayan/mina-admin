"use strict";

/**
 * @description  小程序版本管理（获取所有版本列表，版本设为体验版，版本提审，撤回提审，版本发布）
 */

const assert = require("assert");
const moment = require("moment");
const _ = require("lodash");
const querystring = require("../utils/querystring");
const Command = require("../command");

class MinaCodeCommand extends Command {
  async exec() {
    const opt = this.args.type;
    switch (opt) {
      case "list":
        return this.listCodes();
      case "expr":
        return this.setCodeToExpr();
      case "review":
        return this.setCodeToReview();
      case "cancel_review":
        return this.cancelReview();
      case "publish":
        return this.publishCode();
      default:
        throw new Error(`${opt} not support`);
    }
  }

  async listCodes() {
    this.logger.info("list all codes...");
    const params = {
      path: `/wxopen/wacodepage?action=getcodepage&f=json&lang=zh_CN`,
      random: String(Math.random())
    };
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`
    );
    let content = await resp.json();

    if (content.ret) {
      this.logger.info("resp", content);
      throw new Error("list code fail");
    }

    const codeData = JSON.parse(content.code_data);

    const rtn = {
      dev: codeData.develop_info.info_list.map(item => {
        const code = item.basic_info;
        code.is_exper = item.is_exper;
        return code;
      }),
      exper: codeData.experience_info.basic_info,
      online: codeData.online_info.basic_info
    };

    return rtn;
  }

  async setCodeToExpr() {
    this.logger.info("set code to expr...", this.args.code);
    const openid = _.get(this.args.code, "open_id", "");
    const version = _.get(this.args.code, "version", "");
    let resp;
    let content;
    assert(openid, "miss code.openid");
    assert(version, "miss code.version");
    const codes = await this.listCodes();
    const devCodes = codes.dev;
    const exprCode = _.find(devCodes, item => {
      return item.is_exper;
    });
    const code = _.find(devCodes, item => {
      return item.open_id === openid && version === item.version;
    });
    if (!code) {
      throw new Error("code not found", openid, version);
    }

    if (exprCode) {
      if (exprCode.open_id === openid) {
        this.logger.info(`expr has exist`);
        return true;
      }

      this.logger.info("delete exper", exprCode);
      resp = await this.fetch(
        `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwadevelopcode%3Faction%3Ddelete_exper&random=${Math.random()}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          },
          body: `openid=${exprCode.open_id}&version=${exprCode.version}`
        }
      );
      content = await resp.json();
      this.logger.info(content);
      if (content.ret) {
        throw new Error("delete fail");
      }
    }

    this.logger.info("submit exper", code);
    resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwadevelopcode%3Faction%3Dsumit_exper&random=${Math.random()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `openid=${code.open_id}&version=${code.version}`
      }
    );
    content = await resp.json();
    this.logger.info(content);
    if (content.ret) {
      throw new Error("submit fail");
    }

    return true;
  }

  async setCodeToReview() {
    this.logger.info("set code to review...", this.args.code);
    const openid = _.get(this.args.code, "open_id", "");
    const version = _.get(this.args.code, "version", "");
    const desc = _.get(this.args.code, "describe", "");
    let resp;
    let content;
    assert(openid, "miss code.openid");
    assert(version, "miss code.version");
    const codes = await this.listCodes();
    const devCodes = codes.dev;
    const code = _.find(devCodes, item => {
      return item.open_id === openid && version === item.version;
    });
    assert(code, "code not exist");
    resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwadevelopcode%3Faction%3Dsubmit_check&random=${Math.random()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `ticket=qrcheckTicket&openid=${openid}&auto_id=30&version_desc=${encodeURIComponent(
          desc
        )}&speedup_audit=0&speedup_type=&speedup_desc=&encrypted_username=&encrypted_password=&remark=&feedback_info=&feedbackList=`
      }
    );
    content = await resp.json();
    this.logger.info(content);
    if (content.ret) {
      throw new Error("submit code to review fail");
    }

    return true;
  }

  async cancelReview() {
    this.logger.info("cancel review...");
    let resp;
    let content;
    resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwacodepage%3Faction%3Dundo_expr&random=${Math.random()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: ""
      }
    );
    content = await resp.json();
    this.logger.info(content);
    if (content.ret) {
      throw new Error("cancel review fail");
    }

    return true;
  }

  async publishCode() {
    this.logger.info("publish code...", this.args.code);
    const code = this.args.code;
    const openid = _.get(code, "open_id", "");
    const version = _.get(code, "version", "");
    let resp;
    let content;
    assert(openid, "miss code.openid");
    assert(version, "miss code.version");
    const ticket = await this.getTicket({
      scene: 0,
      auth_type: 5,
      appid: "",
      extra: "",
      data: "",
      info: {
        version: version,
        username: code.nick_name,
        time: code.time,
        describe: code.describe,
        weapp_alias: this.admin.getUser().nickName,
        timestr: moment(code.time).format("YYYY-MM-DD HH:mm:ss")
      }
    });
    resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fwaexperiencecode%3Faction%3Drelease&random=${Math.random()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `openid=${openid}&ticket=${ticket}&version=${version}`
      }
    );
    content = await resp.json();
    this.logger.info(content);
    if (content.ret) {
      throw new Error("publish review fail");
    }

    return true;
  }
}

module.exports = MinaCodeCommand;
