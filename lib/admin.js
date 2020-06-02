"use strict";

const assert = require("assert");
const _ = require("lodash");
const path = require("path");
const fs = require("fs");
const EventEmitter = require("events");
const Logger = require("./utils/logger");
const camelToLine = require("./utils/camelToLine");
const crypto = require("./utils/crypto");

const logger = Logger.getLogger("MinaAdmin");

const DEFAULT_STORAGE_PATH =
  process.env.STORAGE_FILE || path.resolve(__dirname, "./.storage");

let STORAGE = {};
try {
  let text = fs.readFileSync(DEFAULT_STORAGE_PATH, "utf8");
  if (process.env.CRYPTO_KEY) {
    text = crypto.decrypt(text, process.env.CRYPTO_KEY);
  }

  STORAGE = JSON.parse(text);
  logger.info("load storage success");
} catch (e) {}

const DEFAULT_COMMANDS = [];
fs.readdirSync(path.resolve(__dirname, "./commands")).forEach(file => {
  if (file.replace(/\.js$/, "").slice(-7) === "Command") {
    DEFAULT_COMMANDS.push(require(path.resolve(__dirname, "./commands", file)));
  }
});

class MinaAdmin extends EventEmitter {
  constructor(cfg) {
    super();
    this.account = _.get(cfg, "account", "");
    this.password = _.get(cfg, "password", "");
    this.options = _.get(cfg, "options", {});
    assert(this.account, "miss cfg.account");
    assert(this.password, "miss cfg.password");
    this.COMMANDS = {};
    this.STORAGE = STORAGE;
    this.penddingCommands = [];
    this.isLogin = false;
    this.logger = Logger.getLogger("MinaAdmin");
    this.on("login-expired", () => {
      this.isLogin = false;
    });
  }

  async init() {
    DEFAULT_COMMANDS.forEach(cmd => {
      this.registerCommand(cmd);
    });
  }

  async login() {
    try {
      await this.exec("login", {
        account: this.account,
        password: this.password
      });
      this.isLogin = true;
    } catch (e) {
      this.isLogin = false;
      throw e;
    }
  }

  registerCommand(cmd) {
    try {
      const cmdName = camelToLine(cmd.name.replace(/Command$/, ""));
      if (this.COMMANDS[cmdName]) {
        return this.logger.warn(`command [${cmdName}] exist`);
      }

      this.COMMANDS[cmdName] = cmd;
      this.logger.info(`command [${cmdName}] register`);
    } catch (e) {
      this.logger.warn(`command register fail`, cmd);
      this.logger.error(e);
    }
  }

  command(cmd) {
    return async args => {
      return this.exec(cmd, args);
    };
  }

  async exec(cmd, args) {
    let command;
    try {
      this.logger.info(`exec command [${cmd}]`, args);
      const Command = this.COMMANDS[cmd];
      assert(Command, `command [${cmd}] not registered`);
      const options = _.get(this.options, cmd, {});
      _.set(args, "options", _.assign({}, options, _.get(args, "options", {})));
      command = new Command(this, args);
      if (cmd !== "login") {
        assert(this.isLogin, "not login yet");
      }

      try {
        const resp = await command.exec();
        this.logger.info(`exec command [${cmd}] success`, args);
        return resp;
      } finally {
        command._clean();
        command.clean();
      }
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  setUser(userInfo) {
    _.set(this.getStorage(), "user", userInfo);
    this.saveStorage();
  }

  getUser() {
    return this.getStorage().user;
  }

  getStorage() {
    let storage = STORAGE[this.account];
    if (!storage) {
      storage = {};
      STORAGE[this.account] = storage;
    }

    return storage;
  }

  saveStorage() {
    let text = JSON.stringify(STORAGE);
    if (process.env.CRYPTO_KEY) {
      text = crypto.encrypt(text, process.env.CRYPTO_KEY);
    }

    fs.writeFile(DEFAULT_STORAGE_PATH, text, () => {});
  }
}

module.exports = MinaAdmin;
