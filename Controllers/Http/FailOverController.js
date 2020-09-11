"use strict";

const fs = require("fs");
const Helpers = use("Helpers");

class FailOverController {
	async index({ auth, view, response }) {
		// check user auth
		if (auth.user.email !== "hello@hash.id") response.redirect("/");
		// fetch from .yaml
		const yamlString = fs.readFileSync(Helpers.resourcesPath("Prepaid.yaml"), "utf8");
		return view.render("pages.failOver", { yaml: yamlString });
	}

	async updateYAML({ auth, request, view, response }) {
		try {
			// check user auth
			if (auth.user.email !== "hello@hash.id") response.redirect("/");
			// update .yaml
			const { config } = request.all();
			fs.writeFileSync(Helpers.resourcesPath("Prepaid.yaml"), config);
			// render view
			return view.render("pages.failOver", { yaml: config });
		} catch (error) {
			console.log(error.message);
		}
	}
}

module.exports = new FailOverController();
