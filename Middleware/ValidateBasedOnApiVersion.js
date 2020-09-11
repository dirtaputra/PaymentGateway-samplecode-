"use strict";
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const { validate } = use("Validator");

class ValidateBasedOnApiVersion {
	/**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
	async handle({ request, params, response }, next) {
		// get API versioning and URL
		const headers = request.headers();
		const version = headers["accept-version"] ? headers["accept-version"] : "1";
		const url = request.url();
		// get rules
		const rules = await this.getRules(version, url);
		// console.log(rules);
		if (rules) {
			const validation = await validate(request.all(), rules);
			if (validation.fails()) {
				return response.send({
					status: "FAIL",
					error: `E003: ${validation.messages()[0].message}`,
				});
			}
		}
		// call next to advance the request
		await next();
	}

	async getRules(version, url) {
		if (url === "/api/trx/purchase") {
			switch (version) {
				case "1":
					return {
						product: "required",
						target: "required",
						amount: "required|number",
					};

				case "2":
				case "3":
				case "4":
					return {
						itemID: "required",
						target: "required",
						amount: "required|number",
					};
			}
		} else if (url === "/api/trx/inquiry/final") {
			return {
				itemID: "required",
				denom: "required|number",
				target: "required",
			};
		}

		return false;
	}
}

module.exports = ValidateBasedOnApiVersion;
