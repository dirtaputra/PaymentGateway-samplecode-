const Event = use("Event");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const BK = use("App/Common/BalanceKeeper");
const finnetPlugin = use("App/Common/Supplier/FinnetPlugin");
const FormatData = use("App/Common/FinnetParsingDataFormat");
const Logger = use("Logger");
const serializeError = require("serialize-error");

class FinnetWorker {
	get concurrency() {
		return 2;
	}

	async handler(job) {
		try {
			console.log("FinnetWorker");
			console.log(job.data);
			if (job.data.state === "INQUIRY") return await this.invokeInquiry(job);
			if (job.data.state === "PAYMENT") return await this.invokePayment(job);
			if (job.data.state === "STATUS") return await this.queryStatus(job);
		} catch (e) {
			Logger.warning("FinnetWorker", serializeError(e));
			throw e;
		}
	}

	/**
   * Refund for FAILED Transaction
   */
	async refundBalance(buyerId, historyId, amount) {
		await BK.add({
			userId: buyerId,
			amount,
			trxRef: historyId,
			depositRef: null,
		});
	}

	/**
   * HANDLER for Inquiry Request
   */
	async invokeInquiry(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		//
		if (
			[ "POSTPAID NON TELCO", "PREPAID NON TELCO", "POSTPAID TELCO" ].includes(
				trxData.supply.supplier_product_id.type.toUpperCase(),
			)
		) {
			const requestData = Object.assign(
				{
					product: trxData.supply.supplier_product_id.format_code,
					bill_number: trxData.target,
				},
				trxData.supply.supplier_product_id,
			);
			// do inquiry and get data format.
			const [ billInquiry, dataFormat ] = await Promise.all([
				finnetPlugin.billInquiry(requestData),
				getDataFormat(trxData.supply.supplier_product_id.format_code),
			]);
			// inquiry data
			const { statusCode, data } = billInquiry;
			if (statusCode === 200) {
				// SUCCESS request
				// parsing data
				const { inquiryPayment, repeatedly, max_repeat } = dataFormat;
				const bit61 = data.bit61;
				const formattedData =
					trxData.target === bit61
						? {}
						: await parsingData(bit61, inquiryPayment, repeatedly, [], max_repeat);
				// put possible token and pin into reformatted data.
				const { Pin: hPin, Token: hToken } = formattedData || {};
				// reformatted the data
				const reformattedData = Object.assign(
					data,
					{
						formatted_data: formattedData,
					},
					{
						pin: hPin,
						token: hToken,
					},
				);
				// if bit39 = 0 (Successful approval/completion or that V.I.P. PIN verification is valid) &&  resultCode = 00 (Approve)
				if ([ "0", "00" ].includes(data.resultCode) && [ "0", "00" ].includes(data.bit39)) {
					// Request has been submitted. Log in History as PENDING and save supplier_trx_id.
					trxDataObj.supplier_trx_id = data.traxId;
					await Promise.all([
						TransactionHistory.create({
							trx_id: jobData.trxId,
							status: "PENDING",
							data: reformattedData,
						}),
						trxDataObj.save(),
					]);
					// fire payment
					Event.fire("FINNET::PAYMENT", {
						trxId: jobData.trxId,
						amount: Number(data.amount),
						bit61: data.bit61,
						fee: data.feeAmount,
						trax_id: data.traxId,
					});
					return reformattedData;
				} else {
					if ([ "0", "00" ].includes(data.resultCode)) {
						// error on BILLER.
						// log in History as Failed
						const failedHistory = await TransactionHistory.create({
							trx_id: jobData.trxId,
							status: "FAILED",
							remark: `Error on bit39 ${data.bit39}: ${data.bit39_desc}`,
							data: reformattedData,
						});
						// refund Balance
						await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
						Logger.info("throw on invokeInquiry:" + jobData.trxId, reformattedData);
						return reformattedData;
					} else {
						// error on FINNET.
						// log in History as Failed
						const failedHistory = await TransactionHistory.create({
							trx_id: jobData.trxId,
							status: "FAILED",
							remark: `Error on resultCode ${data.resultCode}: ${data.resultDesc}`,
							data: reformattedData,
						});
						// refund Balance
						await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
						Logger.info("throw on invokeInquiry:" + jobData.trxId, reformattedData);
						return reformattedData;
					}
				}
			} else {
				Logger.warning("throw on invokeInquiry: " + jobData.trxId, statusCode);
				// log in History as Failed
				const failedHistory = await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "FAILED",
					remark: `Purchase FAILED with status code ${statusCode}`,
				});
				// refund Balance
				await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				// notify for FAILURE
				notifyDone(trxData, failedHistory);
			}
		} else {
			// Prepaid Telco: invoke request payment directly.
			Event.fire("FINNET::PAYMENT", {
				trxId: jobData.trxId,
				amount: null,
				bit61: null,
				fee: null,
				trax_id: null,
			});
		}
	}

	/**
   * HANDLER for Payment Request
   */
	async invokePayment(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();
		//
		let statusCode = null;
		let data = {};
		//
		if (
			[ "POSTPAID NON TELCO", "PREPAID NON TELCO", "POSTPAID TELCO" ].includes(
				trxData.supply.supplier_product_id.type.toUpperCase(),
			)
		) {
			const amount =
				trxData.supply.supplier_product_id.type.toUpperCase() === "PREPAID NON TELCO"
					? trxData.denom
					: jobData.amount;
			const requestData = Object.assign(
				{
					bill_number: trxData.target,
					product: trxData.supply.supplier_product_id.format_code,
					amount: Number(amount),
					bit61: jobData.bit61,
					fee: jobData.fee,
					trax_id: jobData.trax_id,
				},
				trxData.supply.supplier_product_id,
			);
			// do payment
			const billPayment = await finnetPlugin.billPayment(requestData);
			// assign statusCode and resulted data
			statusCode = billPayment.statusCode;
			data = billPayment.data;
		} else {
			// Prepaid Telco
			const requestData = Object.assign(
				{
					bill_number: trxData.target,
					product: trxData.supply.supplier_product_id.format_code,
					amount: Number(trxData.denom),
					bit61: trxData.target,
					fee: "",
					trax_id: null,
				},
				trxData.supply.supplier_product_id,
			);
			// do payment
			const billPayment = await finnetPlugin.billPayment(requestData);
			// assign statusCode and resulted data
			statusCode = billPayment.statusCode;
			data = billPayment.data;
			// Log in History as PENDING and save supplier_trx_id.
			trxDataObj.supplier_trx_id = data.traxId;
			await Promise.all([
				TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "PENDING",
				}),
				trxDataObj.save(),
			]);
		}

		// if statusCode = 200. Then, NORMAL flow.
		if (statusCode === 200) {
			// get data format
			const { inquiryPayment, repeatedly, payment, max_repeat } = await getDataFormat(
				trxData.supply.supplier_product_id.format_code,
			);
			// parsing data
			const bit61 = data.bit61;
			const formattedData =
				trxData.target === bit61
					? {}
					: await parsingData(bit61, inquiryPayment, repeatedly, payment, max_repeat);
			// put possible token and pin into reformatted data.
			const { Pin: hPin, Token: hToken } = formattedData || {};
			// reformatted the data
			const reformattedData = Object.assign(
				data,
				{
					formatted_data: formattedData,
				},
				{
					pin: hPin,
					token: hToken,
				},
			);
			// if bit39 = 0 (Successful approval/completion or that V.I.P. PIN verification is valid) &&  resultCode = 00 (Approve)
			if ([ "0", "00" ].includes(data.resultCode) && [ "0", "00" ].includes(data.bit39)) {
				// log in History as SUCCESS.
				await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "SUCCESS",
					data: reformattedData,
				});
				return reformattedData;
			} else {
				if ([ "0", "00" ].includes(data.resultCode)) {
					// error in BILLER (bit39)
					if ([ 68, 82, 96 ].includes(data.bit39)) {
						// biller timeout, check status
						Logger.warning("FinnetWorker:invokePayment (biller timeout) " + jobData.trxId, reformattedData);
						Event.fire("FINNET::STATUS", {
							trax_id: data.traxId,
							trxId: jobData.trxId,
						});
					} else {
						// log in History as Failed
						const failedHistory = await TransactionHistory.create({
							trx_id: jobData.trxId,
							status: "FAILED",
							remark: `Error on bit39 ${data.bit39}: ${data.bit39_desc}`,
							data: reformattedData,
						});
						// refund Balance
						await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
						Logger.info("throw on invokePayment:" + jobData.trxId, reformattedData);
					}
				} else {
					// error in FINNET (resultCode)
					// log in History as Failed
					const failedHistory = await TransactionHistory.create({
						trx_id: jobData.trxId,
						status: "FAILED",
						remark: `Error on ${data.resultCode}: ${data.resultDesc}`,
						data: reformattedData,
					});
					// refund Balance
					await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
					Logger.info("throw on invokePayment:" + jobData.trxId, reformattedData);
				}
			}
		} else {
			// abnormal flow. Check status
			Logger.warning("FinnetWorker:invokePayment (abnormal flow) " + jobData.trxId, reformattedData);
			Event.fire("FINNET::STATUS", {
				trax_id: data.traxId,
				trxId: jobData.trxId,
			});
		}
	}

	/**
   * HANDLER for query Status
   */
	async queryStatus(job) {
		const jobData = job.data;
		const trxDataObj = await fetchTrxData(jobData.trxId);
		const trxData = trxDataObj.toJSON();

		// call check status
		const requestData = Object.assign(
			{
				bill_number: trxData.target,
				product: trxData.supply.supplier_product_id.format_code,
				trax_id: jobData.trax_id,
			},
			trxData.supply.supplier_product_id,
		);
		// chek status and get data format.
		const [ checkStatus, dataFormat ] = await Promise.all([
			finnetPlugin.checkStatus(requestData),
			getDataFormat(trxData.supply.supplier_product_id.format_code),
		]);
		const { statusCode, data } = checkStatus;
		// parsing data
		const { inquiryPayment, repeatedly, payment, max_repeat } = dataFormat;
		const bit61 = data.bit61;
		const formattedData =
			trxData.target === bit61 ? {} : await parsingData(bit61, inquiryPayment, repeatedly, payment, max_repeat);
		// put possible token and pin into reformatted data.
		const { Pin: hPin, Token: hToken } = formattedData || {};
		// reformatted the data
		const reformattedData = Object.assign(
			data,
			{
				formatted_data: formattedData,
			},
			{
				pin: hPin,
				token: hToken,
			},
		);
		// If statusCode = 200.
		if (statusCode === 200) {
			// if bit39 = 0 (Successful approval/completion or that V.I.P. PIN verification is valid) &&  resultCode = 00 (Approve)
			if ([ "0", "00" ].includes(data.resultCode) && [ "0", "00" ].includes(data.bit39)) {
				// log in History as SUCCESS.
				await TransactionHistory.create({
					trx_id: jobData.trxId,
					status: "SUCCESS",
					data: reformattedData,
				});
				return reformattedData;
			} else {
				if ([ "0", "00" ].includes(data.resultCode)) {
					// error in BILLER (bit39)
					if ([ 68, 82, 96 ].includes(data.bit39)) {
						// update trans history
						const recentHistory = (await TransactionHistory.query()
							.where("trx_id", jobData.trxId)
							.orderBy("created_at", "desc")
							.fetch()).first();
						if (recentHistory.status === "PENDING") {
							recentHistory.remark = job.attemptsMade;
							recentHistory.save();
							if (job.attemptsMade + 1 < job.opts.attempts) {
								Logger.info("throw on queryStatus:" + jobData.trxId, reformattedData);
								throw new Error(data.bit39 || statusCode);
							} else {
								/// kalau sudah limit dibuat FAILED dan dilakukan REFUND
								const failedHistory = await TransactionHistory.create({
									trx_id: jobData.trxId,
									status: "FAILED",
									data: reformattedData,
								});
								// refund Balance
								await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
							}
						}
					} else {
						// log in History as Failed
						const failedHistory = await TransactionHistory.create({
							trx_id: jobData.trxId,
							status: "FAILED",
							remark: `Error on bit39 ${data.bit39}: ${data.bit39_desc}`,
							data: reformattedData,
						});
						// refund Balance
						await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
					}
				} else {
					// error in FINNET
					// log in History as Failed
					const failedHistory = await TransactionHistory.create({
						trx_id: jobData.trxId,
						status: "FAILED",
						remark: `Error on ${data.resultCode}: ${data.resultDesc}`,
						data: reformattedData,
					});
					// refund Balance
					await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				}
			}
		} else {
			// update trans history
			const recentHistory = (await TransactionHistory.query()
				.where("trx_id", jobData.trxId)
				.orderBy("created_at", "desc")
				.fetch()).first();
			if (recentHistory.status === "PENDING") {
				recentHistory.remark = job.attemptsMade;
				recentHistory.save();
				if (job.attemptsMade + 1 < job.opts.attempts) {
					Logger.info("throw on queryStatus:" + jobData.trxId, reformattedData);
					throw new Error(data.resultCode || statusCode);
				} else {
					/// kalau sudah limit dibuat FAILED dan dilakukan REFUND
					const failedHistory = await TransactionHistory.create({
						trx_id: jobData.trxId,
						status: "FAILED",
						data: reformattedData,
					});
					// refund Balance
					await this.refundBalance(trxData.buyer_id, failedHistory.id, trxData.sell_price);
				}
			}
		}
	}
}

module.exports = FinnetWorker;

/**
 *  Fetch trx data and supply Info
 */
async function fetchTrxData(id) {
	return (await Transaction.query().where("id", id).with("supply").fetch()).first();
}

/**
 * 
 * @param {*} productCode 
 */
async function getDataFormat(product_code) {
	let responseData = {
		inquiryPayment: [],
		repeatedly: [],
		payment: [],
	};
	switch (product_code.toUpperCase()) {
		case "PLN":
			responseData = await FormatData.PLNPrepaid();
			break;
		case "PLNBILL":
			responseData = await FormatData.PLNPostpaid();
			break;
		case "BPJS":
			responseData = await FormatData.BPJS();
			break;
		case "XL":
			responseData = await FormatData.XLPrepaid();
			break;
		case "TSEL":
			responseData = await FormatData.TelkomselPrepaid();
			break;
		case "TSELHALO":
			responseData = await FormatData.TelkomselHalo();
			break;
		case "THREE":
			responseData = await FormatData.ThreePrepaid();
			break;
		case "SMARTFREN":
			responseData = await FormatData.SmartfrenPrepaid();
			break;
		case "INDOSAT":
			responseData = await FormatData.IndosatPrepaid();
			break;
	}

	return responseData;
}

/**
 * parsing bit61 from FINNET
 * @param {*} bit61
 * @param {*} inquiryPayment
 * @param {*} repeatedly
 * @param {*} payment
 * @param {*} max_repeat
 */
async function parsingData(bit61, inquiryPayment, repeatedly, payment, max_repeat) {
	try {
		let formattedData = {};
		const mappedInquiryPayment = await mapData(bit61, formattedData, inquiryPayment, 0, "START", "");
		formattedData = mappedInquiryPayment.data;
		const start = mappedInquiryPayment.total_count;

		const mappedPayment = await mapData(bit61, formattedData, payment.reverse(), bit61.length, "REVERSE", "");
		formattedData = mappedPayment.data;
		const end = mappedPayment.total_count;

		let status = repeatedly.length > 0 ? true : false;
		let countRepeatData = 0;
		let sign = 1;
		const repeatedData = bit61.slice(start, end);
		while (status) {
			let mappedRepeat = await mapData(
				repeatedData,
				formattedData,
				repeatedly,
				countRepeatData,
				"START",
				sign === 1 ? "" : sign,
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
			data: [],
		};
	}
}

/**
 * map data into pre-defined field
 * @param {*} bit61
 * @param {*} parent
 * @param {*} data
 * @param {*} count
 * @param {*} method
 * @param {*} sign
 */
async function mapData(bit61, parent, data, count, method, sign) {
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
			total_count: count,
		};
	} catch (error) {
		console.log(error);
		return {
			data: parent,
			total_count: 0,
		};
	}
}
