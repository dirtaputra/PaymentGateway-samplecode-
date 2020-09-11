"use strict";

const SRS = use("App/Common/Supplier/SrsPlugin");
const PG = use("App/Common/PaymentGatewayPlugin");
const MKIOS = use("App/Common/Supplier/MkiosPlugin");
const FINNET = use("App/Common/Supplier/FinnetPlugin");
const SEPULSA = use("App/Common/Supplier/AlterraPlugin");
const FailOver = use("App/FailOver/Prepaid");
const FormatData = use("App/Common/FinnetParsingDataFormat");
const moment = require("moment");
const numeral = require("numeral");
// const Encryption = use('Encryption');
const Mail = use("Mail");
const Env = use("Env");

class TestController {
	// fail over
	async failOver({ request, response }) {
		try {
			const data = await FailOver.checkRules(request.all());
			response.send(data);
		} catch (e) {
			console.log(e);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	// sepulsa
	async balanceSepulsa({ response }) {
		try {
			const data = await SEPULSA.balance();
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getProductsSepulsa({ request, response }) {
		try {
			const data = await SEPULSA.getProducts();
			response.send(data);
		} catch (error) {
			console.log(error.message);
			response.send({
				status: "FAIL",
				error: error.message
			});
		}
	}

	async inquirySepulsa({ request, response }) {
		try {
			const data = await SEPULSA.inquiry(request.all());
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async transSepulsa({ request, response }) {
		try {
			const data = await SEPULSA.transaction(request.all());
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async statusSepulsa({ request, response }) {
		try {
			const data = await SEPULSA.transDetail(request.all());
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}
	// finnet
	async balanceFinnet({ request, auth, response }) {
		try {
			const data = await FINNET.checkBalance();
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async billInquiryFinnet({ request, auth, response }) {
		try {
			const { statusCode, data } = await FINNET.billInquiry(request.all());

			const { product } = request.all();

			let responseData = {};
			console.log(product);
			switch (product) {
				case "pln_prepaid":
					responseData = await FormatData.PLNPrepaid();
					break;

				case "pln_postpaid":
					responseData = await FormatData.PLNPostpaid();
					break;

				case "bpjs":
					responseData = await FormatData.BPJS();
					break;
			}

			const { inquiryPayment, repeatedly, max_repeat } = responseData;
			const bit61 = data.bit61;
			const formattedData = await this.parsingData(bit61, inquiryPayment, repeatedly, [], max_repeat);

			response.send({
				statusCode,
				data,
				formattedData
			});
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async billPaymentFinnet({ request, auth, response }) {
		try {
			const { statusCode, data } = await FINNET.billPayment(request.all());

			const { product, bill_number, type } = request.all();

			let responseData = {};
			switch (product) {
				case "pln_prepaid":
					responseData = await FormatData.PLNPrepaid();
					break;

				case "pln_postpaid":
					responseData = await FormatData.PLNPostpaid();
					break;

				case "bpjs":
					responseData = await FormatData.BPJS();
					break;

				case "pulsa":
					responseData = await FormatData.XLPrepaid();
					break;
			}

			console.log(responseData);

			const { inquiryPayment, repeatedly, payment, max_repeat } = responseData;
			const bit61 = data.bit61;
			const formattedData = await await this.mapData(bit61, {}, payment, 0, "START", "");

			response.send({
				statusCode,
				data,
				formattedData
			});
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async billStatusFinnet({ request, auth, response }) {
		try {
			const { statusCode, data } = await FINNET.checkStatus(request.all());

			const { product_code, bill_number, type } = request.all();

			let responseData = {};
			switch (type) {
				case "pln_prepaid":
					responseData = await FormatData.PLNPrepaid();
					break;

				case "pln_postpaid":
					responseData = await FormatData.PLNPostpaid();
					break;

				case "bpjs":
					responseData = await FormatData.BPJS();
					break;
			}

			const { inquiryPayment, repeatedly, payment, max_repeat } = responseData;
			const bit61 = data.bit61;
			const formattedData = await await this.mapData(bit61, formattedData, payment, 0, "START", "");

			response.send({
				statusCode,
				data,
				formattedData
			});
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async parsingData(bit61, inquiryPayment, repeatedly, payment, max_repeat) {
		try {
			let formattedData = {};
			const mappedInquiryPayment = await this.mapData(bit61, formattedData, inquiryPayment, 0, "START", "");
			formattedData = mappedInquiryPayment.data;
			const start = mappedInquiryPayment.total_count;

			const mappedPayment = await this.mapData(
				bit61,
				formattedData,
				payment.reverse(),
				bit61.length,
				"REVERSE",
				""
			);
			formattedData = mappedPayment.data;
			const end = mappedPayment.total_count;

			let status = repeatedly.length > 0 ? true : false;
			let countRepeatData = 0;
			let sign = 1;
			const repeatedData = bit61.slice(start, end);
			while (status) {
				let mappedRepeat = await this.mapData(
					repeatedData,
					formattedData,
					repeatedly,
					countRepeatData,
					"START",
					sign === 1 ? "" : sign
				);
				formattedData = mappedRepeat.data;
				countRepeatData += mappedRepeat.total_count / sign;
				if (countRepeatData >= repeatedData.length || max_repeat === sign) status = false;
				sign++;
			}
			return formattedData;
		} catch (error) {
			console.log(error);
			return {
				data: []
			};
		}
	}

	async mapData(bit61, parent, data, count, method, sign) {
		try {
			await data.map((x) => {
				if (method === "START") {
					let start = count;
					count += x.length;
					parent[x.field + sign] = bit61.slice(start, count).trim();
				} else {
					let end = count;
					count -= x.length;
					parent[x.field + sign] = bit61.slice(count, end).trim();
				}
			});

			return {
				data: parent,
				total_count: count
			};
		} catch (error) {
			console.log(error);
			return {
				data: parent,
				total_count: 0
			};
		}
	}

	// Mkios
	async queryBalance({ request, auth, response }) {
		try {
			const data = await MKIOS.queryBalance();
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async requestTransactionRM({ request, auth, response }) {
		try {
			const { denom, target } = request.post();
			// check balance
			const { status, balanceRM } = await MKIOS.queryBalance();
			if (status === "OK") {
				if (Number(balanceRM) >= Number(denom)) {
					// sufficient balance
					// request transaction
					const data = await MKIOS.requestTransactionRM(denom, target);
					response.send(data);
				} else {
					// insufficient balance
					return {
						status: "FAIL",
						error: "E004: Insufficient balance!"
					};
				}
			}
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async queryStatusRM({ request, auth, response }) {
		try {
			const { req_id, denom, target } = request.post();
			const data = await MKIOS.queryStatusRM(req_id, denom, target);
			if (!data.error) response.send(JSON.stringify(data));
			else
				response.send({
					status: "FAIL",
					error: data.error
				});
		} catch (e) {
			response.send({
				status: "FAIL",
				error: e
			});
		}
	}

	// PG
	async generateTW({ response, auth }) {
		try {
			const inputData = {
				AMOUNT: "400",
				PAYMENT_METHOD: "CC",
				REDIRECT_URL: "gokil.in",
				CALLBACK_URL: "tmy-rpg-adonis/deposit/update" // optional
			};
			const data = await PG.generateTW(inputData);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async checkStatusByTrxId({ response, auth }) {
		try {
			const payment_id = "XE4LKK34U2";
			const data = await PG.checkStatusByTrxId(payment_id);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getAllTransactions({ response, auth }) {
		try {
			const data = await PG.getAllTransactions();
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getTrxByTrxId({ response, auth }) {
		try {
			const payment_id = "XE4ELDAU8K";
			const data = await PG.getTrxByTrxId(payment_id);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getTrxByOrderId({ response, auth }) {
		try {
			const order_id = "124";
			const data = await PG.getTrxByOrderId(order_id);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getLiveStatusFromPaymentChannel({ response, auth }) {
		try {
			const payment_id = "XE4ELDAU8K";
			const data = await PG.getLiveStatusFromPaymentChannel(payment_id);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async balance({ response, auth }) {
		try {
			let data = await SRS.checkBalance();
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async requestTopup({ response, auth }) {
		try {
			const inputData = {
				// optional: dealer_mobile_number, remark, other_parameter.
				product_id: "8",
				product_price: "5",
				customer_account_number: "0123456789",
				customer_mobile_number: "60197822927"
			};
			let data = await SRS.requestTopup(inputData);
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async checkTransactionStatus({ request, response, auth }) {
		try {
			// const transaction_id = "20190403111642414141";
			let data = await SRS.checkTransactionStatus(request.all());
			response.send(data);
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async customerTxStatus({ request, response, auth }) {
		try {
			// const inputData = {
			// 	// optional: customer_account.
			// 	start_date: "2019/03/30",
			// 	end_date: "2019/04/2",
			// };
			let data = await SRS.customerTxStatus(request.all());
			response.send({
				status: "OK",
				data: data
			});
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async getReloadPINImmediate({ response, auth }) {
		try {
			const local_MO_ID = "20190403120211424242"; // sResponseID from RequestTopup.
			let data = await SRS.getReloadPINImmediate(local_MO_ID);
			response.send({
				status: "OK",
				data: data
			});
		} catch (e) {
			console.log(e.message);
			response.send({
				status: "FAIL",
				error: e.message
			});
		}
	}

	async sendEmail({ response }) {
		const mail = Env.get("MAIL_NOTIFICATION");
		const targetEmail = mail;
		const emailrp = await Mail.send(
			"emails.deposit",
			{
				email: targetEmail,
				fullname: "some_hello_name",
				datetime: moment().utcOffset("+08:00").format("DD-MMM-YYYY HH:mm:ss ZZ"),
				amount: numeral(60000).format("0,0.00"),
				payId: "PAY56789X2"
			},
			(message) => {
				message.subject(`RPG Deposit - ${targetEmail}`);
				message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
				message.to(mail);
			}
		);
		response.send({
			data: emailrp
		});
	}
}

module.exports = TestController;
