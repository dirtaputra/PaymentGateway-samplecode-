"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const { Config, General, Mobile, PlnPrepaid, PlnPostpaid, BpjsKesehatan } = require("sepulsa-nodejs-client");
const Logger = use("Logger");
const Transaction = use("App/Models/Transaction");

const AlterraStub = use("App/Common/Supplier/AlterraStub");

class AlterraPlugin {
	constructor() {
		/// on Sandbox, turn on Stub
		const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
		if (sandboxEnv) new AlterraStub(this);
		// set config
		this._url = Env.get("ALTERRA_URL", "https://horven-api.sumpahpalapa.com/api");
		this._user = Env.get("ALTERRA_USER", "TelinMYKedai");
		this._password = Env.get("ALTERRA_PASS", "rtKOzhnoPIusOLkYd1ARYmSg8VBrm0coLPsFxYbC5_k");
		const config = new Config(this._url, this._user, this._password, this._user);
		// config.debug = true; // use true for debugging

		this._general = new General(config);
		this._mobile = new Mobile(config);
		this._pln_repaid = new PlnPrepaid(config);
		this._pln_postpaid = new PlnPostpaid(config);
		this._bpjs_kesehatan = new BpjsKesehatan(config);
	}

	async balance() {
		const { balance, error } = await this._general.getBalance();
		if (!error)
			return {
				data: balance
			};
		else
			return {
				error: error
			};
	}

	async getProducts() {
		const result = await this._general.getProduct();

		return result;
	}

	async inquiry(inputData) {
		Logger.info("AlterraPlugin::inquiry", inputData);
		const { product, target, product_id, payment_period = "01" } = inputData;
		// check product
		if (![ "PLN", "PLNBILL", "BPJS" ].includes(product.toUpperCase()))
			return {
				error: `E033: Product is not available for transaction. Your parameter is ${product}`
			};

		// product is correct
		let result = {};
		switch (product.toUpperCase()) {
			case "PLN":
				result = await this._pln_repaid.inquiry({
					customer_number: target,
					product_id: product_id
				});
				break;
			case "PLNBILL":
				result = await this._pln_postpaid.inquiry({
					customer_number: target,
					product_id: product_id
				});
				break;
			case "BPJS":
				result = await this._bpjs_kesehatan.inquiry({
					customer_number: target,
					product_id: product_id,
					payment_period: payment_period
				});
				break;
		}

		return {
			status: result.status,
			data: result
		};
	}

	async transaction(inputData) {
		const { product, phone, target, product_id, order_id, payment_period = "01" } = inputData;
		// check product
		if (![ "MOBILE", "PLN", "PLNBILL", "BPJS" ].includes(product.toUpperCase()))
			return {
				error: `E033: Product is not available for transaction. Your parameter is ${product}`
			};

		// product is correct
		let result = {};
		switch (product.toUpperCase()) {
			case "MOBILE":
				result = await this._mobile.createTransaction({
					customer_number: target,
					product_id: product_id,
					order_id: order_id
				});
				break;
			case "PLN":
				result = await this._pln_repaid.createTransaction({
					customer_number: phone,
					meter_number: target,
					product_id: product_id,
					order_id: order_id
				});
				break;
			case "PLNBILL":
				result = await this._pln_postpaid.createTransaction({
					customer_number: target,
					product_id: product_id,
					order_id: order_id
				});
				break;
			case "BPJS":
				result = await this._bpjs_kesehatan.createTransaction({
					customer_number: target,
					payment_period: payment_period,
					product_id: product_id,
					order_id: order_id
				});
				break;
		}

		return {
			status: result.status,
			data: result
		};
	}

	async transDetail(inputData) {
		const { product, trx_id } = inputData;
		let result = {};
		switch (product.toUpperCase()) {
			case "MOBILE":
				result = await this._mobile.queryTransactionDetail(trx_id);
				break;
			case "PLN":
				result = await this._pln_repaid.queryTransactionDetail(trx_id);
				break;
			case "PLNBILL":
				result = await this._pln_postpaid.queryTransactionDetail(trx_id);
				break;
			case "BPJS":
				result = await this._bpjs_kesehatan.queryTransactionDetail(trx_id);
				break;
		}

		return {
			status: result.status,
			data: result
		};
	}

	async originPrice(id, price) {
		const trans = await Transaction.find(id);
		trans.origin_price = price;
		await trans.save();
	}
}

module.exports = new AlterraPlugin();
