const Env = use("Env");
const Event = use("Event");
const Logger = use("Logger");
const serializeError = require("serialize-error");
//
const UpayPlugin = use("App/Common/Payment/UpayPlugin");
const DepositLog = use("App/Models/DepositLog");
//
const moment = require("moment");

class DepositPaymentController {
	async generateURL({ request, response }) {
		try {
			const { amount, payment_method: method, redirect_url, fee: amountFee } = request.post();
			const knownUser = request.buyerAccount;
			const emailDest = Env.get("UPAY_EMAIL_DEST");
			const ip = request.ip();
			const req_data = await UpayPlugin.generateTWData({
				amount,
				custName: knownUser.fullname,
				emailDest,
				ip,
				method,
			});
			//
			const fee = amountFee > 0 ? amountFee : 0;
			await DepositLog.create({
				user_id: knownUser.id,
				payment_id: req_data.payment_id,
				amount: amount,
				status: "QUOTE",
				data: Object.assign(req_data, {
					fee: fee,
				}),
			});

			return response.send({
				status: "OK",
				data: {
					url: `${Env.get("DEPOSIT_PAY_URL")}/${req_data.payment_id}`,
					payment_id: req_data.payment_id,
				},
			});
		} catch (e) {
			Logger.warning("account::deposit", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}

	async showTW({ params, view }) {
		try {
			const { paymentID } = params;
			const [ paymentData, recentLog ] = await Promise.all([
				DepositLog.query().where("payment_id", paymentID).where("status", "QUOTE").first(),
				DepositLog.query().where("payment_id", paymentID).orderBy("created_at", "desc").first(),
			]);
			//
			if (paymentData) {
				// check URL expiry date
				if (moment().isBefore(moment(paymentData.data.expiry))) {
					// check payment final status
					if (recentLog.status === "PAID") {
						// check payment status
						return view.render("pages.payment.warning_page", {
							title: `${paymentID} has been PAID`,
							content: "Thank you for using our service",
							content2: "You may close this window",
						});
					} else {
						// save into db with a pending status
						if (recentLog.status !== "UNPAID") {
							await DepositLog.create({
								user_id: paymentData.user_id,
								payment_id: paymentID,
								amount: paymentData.amount,
								status: "UNPAID",
								data: paymentData.data,
							});
						}
						//
						Event.fire("DEPOSIT::CHECK", {
							payId: paymentID,
							fee: paymentData.data.fee,
						});
						//
						return view.render("pages.payment.redirect_url", {
							data: paymentData.data,
						});
					}
				} else {
					return view.render("pages.payment.warning_page", {
						title: "The URL is expired",
						content: "Please kindly generate a new payment URL!",
					});
				}
			} else {
				return view.render("pages.payment.warning_page", {
					title: "Invalid URL",
					content: "Please kindly generate a new payment URL!",
				});
			}
		} catch (e) {
			Logger.warning("DepositPaymentController::showTW", serializeError(e));
			return view.render("pages.payment.warning_page", {
				title: "Internal Error",
				content: "Please kindly generate a new payment URL!",
			});
		}
	}

	async callback({ request, response, view }) {
		try {
			const data = request.post();
			/**
             * data = { STATUS_CODE: 'U53',
             *  STATUS_DESC:
             *  'You have entered CREDIT card number, Please provide your cc card number.',
             *  ORDER_ID: '1562316060',
             *  TXN_ID: '0',
             *  PAY_TYPE: 'CC',
             *  AMOUNT: '1000.00',
             *  TXN_TIMESTAMP: '2019-07-05 16:41:30',
             *  SOURCE_FROM: 'WEB',
             *  IS_TEST: 'null',
             *  STATUS_INFO: 'RPG',
             *  REDIRECT_URL: 'http://127.0.0.1:3333/api/deposit/cb',
             *  MERCHANT_NAME: 'null',
             *  TXN_STATUS: 'FAILED',
             *  RESPONSE_SIGNATURE: 'null',
             *  FPX_Txn_ID: 'null' }
             */
			const recentLog = await DepositLog.query()
				.whereRaw("data -> 'order_id' = ?", [ data.ORDER_ID ])
				.orderBy("created_at", "desc")
				.first();

			console.log(recentLog.payment_id);
			const recentStatus = await DepositLog.query()
				.where("payment_id", recentLog.payment_id)
				.orderBy("created_at", "desc")
				.first();
			console.log(recentStatus.status);
			//
			const finalStatus = [ "0", "00" ].includes(data.STATUS_CODE) ? "PAID" : "UNPAID";
			if (finalStatus === "PAID") {
				if (recentStatus.status !== "PAID") {
					// add PAID status into Deposit Log
					const recentDeposit = await DepositLog.create({
						user_id: recentLog.user_id,
						payment_id: recentLog.payment_id,
						amount: recentLog.amount,
						status: finalStatus,
						data: data,
					});
					//
					const fee = recentLog.data.fee;
					//
					Event.fire("DEPOSIT::ADD", {
						userId: recentLog.user_id,
						amount: recentLog.amount,
						fee: fee,
						ref: recentDeposit.id,
						payId: recentLog.payment_id,
					});
					// insert processing fee into ledger if fee > 0
					if (fee > 0) {
						Event.fire("DEPOSIT::ADD_PROCESSING_FEE", {
							userId: recentLog.user_id,
							amount: fee,
							payId: recentLog.payment_id,
						});
					}
					// propagate info via Email
					Event.fire("DEPOSIT::EMAIL", {
						userId: recentLog.user_id,
						amount: recentLog.amount,
						payId: recentLog.payment_id,
					});
				}
				//
				return view.render("pages.payment.warning_page", {
					title: "SUCCESS",
					content: "Thank you for using our service",
					content2: "You may close this window",
				});
			} else {
				// update recentLog
				if (recentStatus.status === "UNPAID") {
					recentStatus.data = data;
					await recentStatus.save();
				}
				//
				Logger.info("DepositPaymentController::callback", data);
				//
				return view.render("pages.payment.warning_page", {
					title: `${recentLog.payment_id} is UNPAID`,
					content: "",
				});
			}
		} catch (e) {
			console.log(e);
			Logger.warning("DepositPaymentController::callback", serializeError(e));
			return view.render("pages.payment.warning_page", {
				title: `${recentLog.payment_id} is UNPAID`,
				content: "",
			});
		}
	}
}

module.exports = new DepositPaymentController();
