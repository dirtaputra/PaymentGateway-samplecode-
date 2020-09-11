"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const axios = require("axios");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const As2in1MobileStub = use("App/Common/Supplier/As2in1MobileStub");

class As2in1MobilePlugin {
	constructor() {
		this._uri = Env.get("AS2IN1MOBILE_URL", "http://180.240.135.44:3000");
		/// on Sandbox, turn on Stub
		const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
		if (sandboxEnv) new As2in1MobileStub(this);
	}

	async checkBalance() {
		try {
			const { target } = inputData;
			const { status, data } = await axios.post(`${this._uri}/checkBalance`, {
				checkBalance: {
					callerID: target,
				},
			});

			Logger.info("As2in1Mobile:checkBalance", data);

			return {
				status: status,
				data: data,
			};
		} catch (e) {
			Logger.warning("As2in1Mobile:checkBalance", serializeError(e));
			return e;
		}
	}

	async checkWalletBalance() {
		try {
			const { status, data } = await axios.post(`${this._uri}/checkTopupWalletBalance`, {
				walletPin: "malaysia mygrapari",
			});

			Logger.info("As2in1Mobile:checkWalletBalance", data);

			return {
				status: status,
				data: data,
			};
		} catch (e) {
			Logger.warning("As2in1Mobile:checkWalletBalance", serializeError(e));
			return e;
		}
	}

	async updateBalance(inputData) {
		try {
			const { currency, target, amount } = inputData;
			const { status, data } = await axios.post(`${this._uri}/tl_topup`, {
				action: "payment",
				calling: target,
				amount: amount,
				method: "P",
				currency: currency,
				remark: "malaysia mygrapari",
			});

			Logger.info("As2in1Mobile:UpdateBalance", data);

			return {
				status: status,
				data: data,
			};
		} catch (e) {
			Logger.warning("As2in1Mobile:UpdateBalance", serializeError(e));
			return e;
		}
	}
}

module.exports = new As2in1MobilePlugin();
