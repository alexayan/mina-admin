"use strict";

/**
 * @description  小程序码生成服务
 */

const querystring = require("../utils/querystring");
const Command = require("../command");

class MinaVisitOfficialSourceCommand extends Command {
  async exec() {
    const { page = 1, pageCount = 500 } = this.args;
    const userInfo = this.admin.getUser();
    const endTime = Date.now();
    const beginTime = endTime - 1000 * 60 * 60 * 24 * 30;
    const params = {
      path: `/wxopen/sourceanalysis?action=get_sub_scene_top&page=${page}&page_count=${pageCount}&scene=18&sub_scene=-1&begin_timestamp=${Math.floor(
        beginTime / 1000
      )}&end_timestamp=${Math.floor(endTime / 1000)}&index_id=1`,
      token: userInfo.token,
      random: String(Math.random())
    };
    console.log(`https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`)
    let resp = await this.fetch(
      `https://mp.weixin.qq.com/wxamp/cgi/route?${querystring.encode(params)}`
    );
    let content = await resp.json();
    return content;
  }
}

module.exports = MinaVisitOfficialSourceCommand;
