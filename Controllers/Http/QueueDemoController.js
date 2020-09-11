"use strict";

const Bull = use("Bull");

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

/**
 * Resourceful controller for interacting with suppliers
 */
class QueueDemoController {
  /**
   * Show a list of all suppliers.
   * GET suppliers
   *
   * @param {object} ctx
   * @param {Response} ctx.response
   */
  async insert({ response }) {
    ///
    Bull.withQueue("SampleJob").add({ demo: "hello world demo" });
    response.send("hello");
  }
}

module.exports = QueueDemoController;
