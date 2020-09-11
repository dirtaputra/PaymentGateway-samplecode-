"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */
/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
class MygrapariOnly {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, auth, response }, next) {
    // get User Object
    request.buyerAccount = await auth.getUser();
    const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
    if (!sandboxEnv){ // bypass if the env is sandbox
      // it should be BUYER and MYGRAPARI-INTERNAL email (mygrapari@telin.com.my)
      if (
        request.buyerAccount.type !== "BUYER" ||
        request.buyerAccount.email !== "mygrapari@telin.com.my"
      ) {
        return response.send({
          status: "FAIL",
          error: "E002: Invalid account privilege"
        });
      }
    }
    // call next to advance the request
    await next();
  }
}

module.exports = MygrapariOnly;
