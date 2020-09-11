"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const crypto = require("crypto");
const basicAuth = require("basic-auth");
const Logger = use("Logger");
const allowedSubdomains = ["resale-gateway", "resale-gateway-testing", "resale-gateway-sandbox"];
const refCred = "8879F7E97D2D15FDF494C929F72FC981860F71782DEDCAC369F8246448A02E4D";

class OnlyForDebug {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, subdomains, response }, next) {
    Logger.info(`Debug request incoming from ${subdomains.subd || request.hostname()}`);
    /// check if subdomain is allowed
    if (subdomains.subd && allowedSubdomains.includes(subdomains.subd) === false) {
      return response.status(404).send("HttpException: E_ROUTE_NOT_FOUND: Route not found");
    }
    /// ensure authentication is valid
    const authHeader = request.header("authorization") || null;
    if (!authHeader) {
      return response.status(403).send("Missing: Access Forbidden");
    }
    /// parse Auth Header Basic XXXXX
    const credentials = basicAuth.parse(authHeader);
    /// build the hash
    let hash = crypto
      .createHash("sha256")
      .update(`${credentials.name}:${credentials.pass}`)
      .digest("hex")
      .toUpperCase();
    /// comparre with reference --> send 403 if not valid
    if (refCred !== hash) {
      return response.status(403).send("Invalid: Access Forbidden");
    }
    // call next to advance the request
    await next();
  }
}

module.exports = OnlyForDebug;
