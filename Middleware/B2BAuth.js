'use strict'
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class B2BAuth {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({
    request,
    response,
    auth
  }, next) {
    request.buyerAccount = await auth.getUser();
    console.log(request.ips())
    console.log(request.ip())
    const whitelist = request.buyerAccount.whitelist
    const whitelistData = whitelist.split(":");
    let white;
    const ip = request.ip();
    console.log("IP:", ip)
    if (whitelist === "*") {
      return await next()
    } else if (whitelistData.includes(ip) == true) {
      return await next()
    } else {
      return response.status(403).send(
        "IP is not whitelisted"
      );
    }
    // if (whitelistData.includes(ip) == false) {
    //   return response.status(403).send(
    //     "IP is not whitelisted"
    //   );
    // } else if (whitelist === "*") {
    //   await next();
    // }
    //await next();
    //
    response.removeHeader("Set-Cookie");
  }
}

module.exports = B2BAuth
