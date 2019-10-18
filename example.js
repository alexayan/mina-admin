const _ = require("lodash");
const MinaAdmin = require("./lib/index.js");

const admin = new MinaAdmin.Admin({
  account: "",
  password: ""
});

async function main() {
  await admin.init();
  await admin.login();
  const users = await admin.command("mina_expr_users")({
    type: "list"
  });
  const user = _.find(users, u => {
    return u.nickname === "musk";
  });
  await admin.exec("mina_expr_users", {
    type: "remove",
    users: [
      {
        openid: user.openid,
        authority: 0
      }
    ]
  });
  await admin.command("mina_expr_users")({
    type: "add",
    users: [
      {
        username: "musk",
        authority: 8
      }
    ]
  });
  const codes = await admin.command("mina_code")({
    type: "list"
  });

  const targtCode = _.find(codes.dev, code => {
    return !code.is_exper;
  });

  if (targtCode) {
    const result = await admin.exec("mina_code", {
      type: "expr",
      code: targtCode
    });
    console.log(result);
  }

  const experCode = codes.exper;

  if (experCode.status === MinaAdmin.MINA_CODE_REVIEW_PASS) {
    await admin.exec("mina_code", {
      type: "publish",
      code: experCode
    });
  }
}

main();
