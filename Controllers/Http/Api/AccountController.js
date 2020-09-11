"use strict";

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */
/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const PG = use("App/Common/PaymentGatewayPlugin");
const BK = use("App/Common/BalanceKeeper");
const SK = use("App/Common/StorageKeeper");
const DepositLog = use("App/Models/DepositLog");
const Ledger = use("App/Models/Ledger");
const User = use("App/Models/User");
const crypto = require("crypto");
const Event = use("Event");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Cache = use("Cache");
const moment = use("moment");
const Transaction = use("App/Models/Transaction");
const Poin = use("App/Models/Poin");
const Database = use("Database");

/**
 * Resourceful controller for interacting with accounts
 */
class AccountController {
	/**
   * query balance
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
	async balance({ request, response, auth }) {
		try {
			const knownUser = request.buyerAccount;
			const balance = await BK.balance(knownUser.id);
			const poinData = await this.POIN(knownUser.id);
			response.send({
				status: "OK",
				data: {
					balance: Number(balance || "0.00").toFixed(2),
					email: knownUser.email,
					poin: poinData.balance_poins,
					poin_exp: poinData.exp_poins,
				},
			});
		} catch (e) {
			Logger.warning("account::balance", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}

	async POIN(user_id) {
		/**
		 * select (select (sum("poin") - sum("consumed")) as "exp_poins" from "poins" where "expiry" <= '2019-08-01T15:59:59.999Z' and "user_id" = 'cfb796c1-d611-427f-b1bf-9238faeb05da'), 
			(sum("poin") - sum("consumed")) as "balance_poins" 
			from "poins" 
			where "expiry" >= '2019-07-16T03:01:12.170Z' and "user_id" = 'cfb796c1-d611-427f-b1bf-9238faeb05da'
		 */
		const exp_date = moment().add(1, "month").startOf("month").endOf("day").toISOString();
		const subquery = Database.raw(
			"(select (sum(poin) - sum(consumed)) as exp_poins from poins where expiry <= ? and user_id = ?)",
			[ exp_date, user_id ],
		);
		const poin = await Poin.query()
			.select(subquery)
			.select(Database.raw("(sum(poin) - sum(consumed)) as balance_poins"))
			.where("expiry", ">=", moment().toISOString())
			.where("user_id", user_id)
			.first();
		return {
			exp_poins: poin.exp_poins === null ? 0 : Math.floor(poin.exp_poins),
			balance_poins: poin.balance_poins === null ? 0 : Math.floor(poin.balance_poins),
		};
	}

	/**
   * Retrieve account statement
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
	async statement({ request, response, auth }) {
		try {
			const knownUser = request.buyerAccount;
			if (await Cache.has("statement_" + knownUser.id)) {
				const obj_cache = await Cache.get("statement_" + knownUser.id);
				return response.send(obj_cache);
			}
			const responseData = await BK.statement(knownUser.id);
			//console.log(responseData);
			const res_data = {
				status: "OK",
				data: responseData,
			};
			await Cache.add("statement_" + knownUser.id, res_data, 1); //1 minutes
			response.send(res_data);
		} catch (e) {
			Logger.warning("account::statement", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}

	/**
   * Retrieve account DEPOSIT statement
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
	async deposit_statement({ params, response, view }) {
		try {
			const { email, key } = params;
			const extractedEmail = email.replace(/\W|\d/gm, "");
			const validKey = crypto.createHash("md5").update(extractedEmail).digest("hex");

			if (validKey === key) {
				// valid request
				const dataUser = await User.findBy("email", email);
				if (dataUser === null) {
					return view.render("pages.viewbalance", {
						error: "User cannot be found!",
					});
				} else {
					const responseData = await BK.deposit_statement(dataUser.id);
					return view.render("pages.viewbalance", {
						data: responseData,
					});
				}
			} else {
				return view.render("pages.viewbalance", {
					error: "Invalid account privilege!",
				});
			}
		} catch (e) {
			Logger.warning("account::statement", serializeError(e));
			return view.render("pages.viewbalance", {
				error: e.message,
			});
		}
	}

	/**
   * Request for topup deposit
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
	async deposit({ request, response, auth }) {
		try {
			/// parse input
			const knownUser = request.buyerAccount;
			let { amount, payment_method, redirect_url, fee } = request.post();
			const inputData = {
				AMOUNT: amount,
				PAYMENT_METHOD: payment_method, // DC,CC,FPX, ALL
				REDIRECT_URL: redirect_url || "",
				CALLBACK_URL: Env.get("PG_CALLBACK_URL"), // optional
			};
			const data = await PG.generateTW(inputData);
			if (data.response_code === "ss") {
				const deposit = new DepositLog();
				deposit.user_id = knownUser.id;
				deposit.payment_id = data.data.payment_id;
				deposit.amount = amount;
				deposit.status = "UNPAID";
				deposit.data = data;
				await deposit.save();
				/// fire event for deposit check
				fee = fee > 0 ? fee : 0;
				Event.fire("DEPOSIT::CHECK", {
					payId: deposit.payment_id,
					fee: fee,
				});
				return response.send({
					status: "OK",
					data: data.data,
				});
			} else {
				return response.send({
					status: "FAIL",
					error: `E061: ${data.error}`,
				});
			}
		} catch (e) {
			Logger.warning("account::deposit", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}

	/**
   * Callbakc for topup deposit
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
	async depositCallback({ request, response, auth }) {
		try {
			// check the bearer token. the value should be
			// if (request.headers().authorization.split(" ")[1] !== Env.get('PG_TOKEN')) { // invalid token
			//   response.send({
			//     status: "FAIL",
			//     error: "Invalid API Token"
			//   });
			// } else {
			const { PAYMENT_ID, STATUS_CODE, STATUS_DESC } = request.post();
			console.log("======================== received deposit callback ========================");
			console.log(request.post());
			Logger.info("AccountController:depositCallback", request.post());
			return response.send({
				status: "OK",
				data: request.post(),
			});
			// const dataDeposit = await DepositLog.query()
			//   .where("payment_id", PAYMENT_ID)
			//   .orderBy("updated_at", "desc")
			//   .first();
			// if (dataDeposit !== null) {
			//   // check wether the status is paid or not.
			//   if (dataDeposit.toJSON().status === "PAID") {
			//     return response.send({
			//       status: "OK",
			//       data: "Can't update the database. The last status was paid!"
			//     });
			//   }
			//   // STATUS FROM PG: SS => SUCCESS, QT => QUOTES, UP => UNPAID, FL = > FAILED
			//   let status = "";
			//   switch (STATUS_DESC) {
			//     case "SUCCESS":
			//       status = "PAID";
			//       break;
			//     case "FAILED":
			//       status = "FAILED";
			//       break;
			//     default:
			//       status = "UNPAID";
			//       break;
			//   }
			//   // save to deposit logs
			//   const deposit = new DepositLog();
			//   deposit.user_id = dataDeposit.toJSON().user_id;
			//   deposit.payment_id = PAYMENT_ID;
			//   deposit.amount = dataDeposit.toJSON().amount;
			//   deposit.status = status;
			//   deposit.data = request.post();
			//   await deposit.save();
			//   // if the status is success. update ledgers
			//   if (status === "PAID") {
			//     BK.add({
			//       userId: dataDeposit.toJSON().user_id,
			//       amount: parseFloat(dataDeposit.toJSON().amount),
			//       depositRef: deposit.id
			//     });
			//   }

			//   return response.send({
			//     status: "OK",
			//     data: ""
			//   });
			// } else {
			//   return response.send({
			//     status: "FAIL",
			//     data: `E062: The record with payment_id: ${PAYMENT_ID} can not be found in the database!`
			//   });
			// }
			// }
		} catch (e) {
			Logger.warning("account::depositCallback", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}

	async generateUploadURL({ request, response }) {
		try {
			const { extension } = request.post();
			const { filename, url, expiry_date } = await SK.generateUploadURL(extension);
			response.send({
				status: "OK",
				data: { filename, url, expiry_date },
			});
		} catch (error) {
			Logger.warning("account::depositCallback", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}
}

module.exports = AccountController;
