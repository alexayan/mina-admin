"use strict";

/**
 * @description  小程序体验成员管理（获取所有体验成员列表，添加体验成员，删除体验成员）
 */

const querystring = require("../utils/querystring");
const Command = require("../command");

const PAGE_LIMIT = 90;

class MinaExprUsersCommand extends Command {
  async exec() {
    const opt = this.args.type;
    switch (opt) {
      case "list":
        return this.listExprUsers();
      case "add":
        return this.addExprUser();
      case "remove":
        return this.removeExprUser();
      default:
        throw new Error(`${opt} not support`);
    }
  }

  async listExprUsers() {
    this.logger.info("get all expr users...");
    const userInfo = this.admin.getUser();
    const params = {
      path: `/wxopen/authprofile?action=get_auth_list&use_role=1&is_expr=1&f=json&offset_of_expr=0&limit_of_expr=${PAGE_LIMIT}&token=${userInfo.token}&lang=zh_CN`,
      token: "",
      random: String(Math.random())
    };
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`
    );
    let content = await resp.json();
    let users = JSON.parse(content.auth_list_of_expr).items;
    if (content.biz_expr_limit > PAGE_LIMIT) {
      params.path = `/wxopen/authprofile?action=get_auth_list&use_role=1&is_expr=1&f=json&offset_of_expr=${PAGE_LIMIT}&limit_of_expr=${content.biz_expr_limit -
        PAGE_LIMIT}&token=${userInfo.token}&lang=zh_CN`;
      resp = await this.fetch(
        `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`
      );
      content = await resp.json();
      users = users.concat(JSON.parse(content.auth_list_of_expr).items);
    }

    return users;
  }

  async addExprUser() {
    this.logger.info("add expr users...");
    const resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fauthprofile%3Faction%3Dadd_user%26use_role%3D1%26is_expr%3D1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `check_ticket=1&auth_list=${encodeURIComponent(
          JSON.stringify({
            items: this.args.users
          })
        )}`
      }
    );
    const content = await resp.json();
    this.logger.info("result", content);
    if (content.ret === 0) {
      return true;
    }

    return false;
  }

  async removeExprUser() {
    this.logger.info("remove expr users...");
    const resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?path=%2Fwxopen%2Fauthprofile%3Faction%3Dsave_auth`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: `check_ticket=1&use_role=1&is_expr=1&auth_list=${encodeURIComponent(
          JSON.stringify({
            items: this.args.users
          })
        )}`
      }
    );
    const content = await resp.json();
    this.logger.info("result", content);
    if (content.ret === 0) {
      return true;
    }

    return false;
  }
}

module.exports = MinaExprUsersCommand;
