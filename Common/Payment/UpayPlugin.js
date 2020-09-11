const serializeError = require("serialize-error");
const Logger = use("Logger");

const DepositLog = use("App/Models/DepositLog");

const Env = use("Env");
const moment = require("moment");
const crypto = require("crypto");
const axios = require("axios");
const _ = require("lodash");
const shortId = require("shortid");
const querystring = require("querystring");

class UpayPlugin {
	async generateTWData(data) {
		try {
			const { amount, custName, emailDest, ip, method } = data;
			const payment_method =
				method.toUpperCase() === "CC" ? "CREDIT" : method.toUpperCase() === "DB" ? "DEBIT" : "FPX";
			const identifier = Env.get("UPAY_MERCHANT_IDENTIFIER");
			const custID = Env.get("UPAY_CUST_ID");
			const orderID = moment().unix();
			const paymentID = await this.generateID();
			//
			const secretKey = Env.get("UPAY_SECRET_KEY");
			const stringSign = `${secretKey}${identifier}${parseFloat(amount).toFixed(2)}${custID}${orderID}`;
			const signature = crypto.createHash("sha512").update(stringSign).digest("hex");

			return {
				url: Env.get("UPAY_REQUEST_URL"),
				expiry: moment().add("1", "days").toISOString(),
				merchant_identifier: identifier,
				amount: parseFloat(amount).toFixed(2),
				currency: "MYR",
				txn_desc: `RPG deposit a.n. ${custName}`,
				callback_url: Env.get("UPAY_CALLBACK_URL"),
				customer_id: custID,
				order_id: orderID,
				payment_id: paymentID,
				customer_name: custName,
				customer_email: emailDest,
				customer_mobile: Env.get("UPAY_CUST_MOBILE"),
				customer_ip: ip,
				string_sign: stringSign,
				txn_signature: signature,
				payment_method: payment_method,
				is_test: Env.get("UPAY_IS_TEST"),
			};
		} catch (error) {
			console.log(error);
			Logger.info("UpayPlugin:generateTWData", serializeError(error));
			return error;
		}
	}

	async checkStatus(paymentID) {
		try {
			const depositData = await DepositLog.query()
				.where("payment_id", paymentID)
				.where("status", "QUOTE")
				.first();
			//
			const signature = depositData.data.txn_signature;
			//
			const result = await axios.post(
				Env.get("UPAY_QUERY_STATUS_URL"),
				querystring.stringify({
					MERCHANT_IDENTIFIER: depositData.data.merchant_identifier,
					ORDER_ID: depositData.data.order_id,
					TXN_SIGNATURE: signature,
				}),
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				},
			);
			const { status, data } = result;
			//
			return { status: status, data: data };
		} catch (error) {
			console.log(error);
			Logger.info("UpayPlugin:generateTWData", serializeError(error));
			return error;
		}
	}

	async generateID() {
		// ~ generate pay_id
		let x = moment().diff(moment("2017-07-01"), "hours").toString(16);
		// ~ last 4 string is random char
		let y = shortId.generate().replace(/[-_]/gi, "0").slice(0, 6);
		let id = (x + y).toUpperCase();
		id = "UPAY" + _.padStart(id, 13, "X");
		return id;
	}
}

module.exports = new UpayPlugin();
