'use strict'
const Env = use("Env")
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class JompayWhitelist {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({
    request,
    response
  }, next) {
    // call next to advance the request 
    const whitelist = Env.get("JOMPAY_IP")
    const whitelistData = whitelist.split(":");
    const ip = request.ip()
    if (whitelistData.includes(ip) == true) {
      return await next()
    } else {
      return response.status(403).send(
        "IP is not whitelisted"
      )
    }
  }
}

module.exports = JompayWhitelist
