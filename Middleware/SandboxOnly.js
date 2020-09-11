"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Env = use("Env");
const sandboxEnv = Env.get("NODE_ENV", "development") === "sandbox";

class SandboxOnly {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, response }, next) {
    // call next to advance the request
    if (sandboxEnv === false) {
      return response.send({
        status: "FAIL",
        error: "E995: Sandbox is not available"
      });
    }
    await next();
  }
}

module.exports = SandboxOnly;
