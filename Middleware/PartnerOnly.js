'use strict'
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class PartnerOnly {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({
    request,
    auth,
    response
  }, next) {
    // call next to advance the request
    request.buyerAccount = await auth.getUser();
    if (request.buyerAccount.type === "BUYER" && request.buyerAccount.is_partner === "0") {
      return response.send({
        status: "FAIL",
        error: "E002: Invalid account privilege"
      });
    }
    await next();
    //
    response.removeHeader("Set-Cookie");
  }
}

module.exports = PartnerOnly
