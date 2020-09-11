"use strict";

class CheckAuth {
	async handle({ response, auth }, next) {
		try {
			await auth.check();
		} catch (error) {
			return response.route("login");
		}

		await next();
	}
}

module.exports = CheckAuth;
