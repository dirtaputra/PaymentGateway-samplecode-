"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Event = use("Event");
class ApiBuyerOnly {
	/**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
	async handle({ request, auth, response }, next) {
		// call next to advance the request
		request.buyerAccount = await auth.getUser();
		if (request.buyerAccount.type !== "BUYER") {
			return response.send({
				status: "FAIL",
				error: "E002: Invalid account privilege"
			});
		}
		Event.fire("GEOLOCATION::STORE", {
			location: request.header("x-location"),
			appversion: request.header("x-appversion"),
			platform: request.header("x-platform"),
			user_id: request.buyerAccount.id
		});
		await next();
		//
		response.removeHeader("Set-Cookie");
	}
}

module.exports = ApiBuyerOnly;
