'use strict'
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */
const Encryption = use('Encryption')
const atob = use("atob")

class AuthToken {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({
    request
  }, next) {
    // call next to advance the request
    try {
      const headers = request.headers()
      const base64Token = headers["authorization"].replace("Bearer ", "")
      const plainToken = atob(base64Token)
      const encrypted = Encryption.encrypt(plainToken)
      request.request.headers["authorization"] = "Bearer " + encrypted
    } catch (error) {}
    await next()
  }
}

module.exports = AuthToken
