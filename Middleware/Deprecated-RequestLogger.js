"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Logger = use("Logger");
const prettyMs = require("pretty-ms");

const normalCode = ["200", "201", "202", "301", "302", "303", "304"];

class RequestLogger {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Function} next
   */
  async handle({ request, response }, next) {
    // basic info
    const reqLabel = Date.now()
      .toString(32)
      .toUpperCase();
    const url = request.url();
    const method = request.method();
    const ip = request.ip();
    const beginTime = process.hrtime();
    // log incoming
    Logger.info(`${reqLabel} <-- ${method} ${url} ${ip}`, request.post());
    // await for request handling to be done
    await next();
    // request handled
    // listen on finish event
    response.response.on("finish", () => {
      // calc diffTIme in ms
      const diffTime = process.hrtime(beginTime);
      const elapsedMs = prettyMs((diffTime[0] * 1e9 + diffTime[1]) / 1e6);
      const statusCode = response.response.statusCode;
      const { content } = response.lazyBody;
      const isContentJSON = typeof content === "string" ? false : true;
      // select logger
      let loggerMethod = Logger.info;
      /// if statusCode is NOT Normal
      if (
        normalCode.includes(statusCode) ||
        (content && isContentJSON && content.status === "FAIL")
      ) {
        loggerMethod = Logger.warning;
      }
      //// write logger
      if (isContentJSON)
        loggerMethod(
          `${reqLabel} --> ${method} ${url} -- [${statusCode}] in ${elapsedMs}`,
          content
        );
      else loggerMethod(`${reqLabel} --> ${method} ${url} -- [${statusCode}] in ${elapsedMs}`);
    });
  }
}

module.exports = RequestLogger;
