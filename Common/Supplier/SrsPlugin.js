"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const soapRequest = require("easy-soap-request");
const convert = require("xml-js");
const crypto = require("crypto");
const moment = require("moment");
const Logger = use("Logger");

const SrsStub = use("App/Common/Supplier/SrsStub");

const url_balance_status = Env.get("SRS_URI_BALANCE_STATUS", "http://reload.dyndns.org:8020/stagingapi/connect.asmx");
const url_topup_pin = Env.get("SRS_URI_TOPUP_PIN", "http://reload.dyndns.org:8020/stagingapi/connect.asmx");
const headers = {
	"user-agent": "easy-soap-request-test",
	"Content-Type": "text/xml;charset=UTF-8"
};

class SrsPlugin {
	constructor() {
		/// on Sandbox, turn on Stub
		const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
		if (sandboxEnv) new SrsStub(this);
	}

	/**
   * inputData = {
   *      sClientUserName : "60165491128",
   *      sClientPassword : "richtech"
   * }
   */
	async checkBalance() {
		try {
			const command = "CheckBalance";
			let xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <${command} xmlns="http://tempuri.org/">
                        <sClientUserName>${Env.get("SRS_USERNAME")}</sClientUserName>
                        <sClientPassword>${Env.get("SRS_CLIENT_PASSWORD")}</sClientPassword>
                    </${command}>
                </soap:Body>
            </soap:Envelope>`;

			const { response } = await soapRequest(url_balance_status, headers, xml);
			const { body, statusCode } = response;
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			responseInJSON = responseInJSON["soap:Envelope"]["soap:Body"]["CheckBalanceResponse"];
			let dataObject = {};
			if (typeof responseInJSON["CheckBalanceResult"] !== "undefined")
				dataObject["result"] = responseInJSON["CheckBalanceResult"]["_text"];
			if (typeof responseInJSON["sResponseID"] !== "undefined")
				dataObject["response_id"] = responseInJSON["sResponseID"]["_text"];
			if (typeof responseInJSON["sResponseStatus"] !== "undefined")
				dataObject["status"] = responseInJSON["sResponseStatus"]["_text"];
			if (typeof responseInJSON["dBalance"] !== "undefined")
				dataObject["balance"] = responseInJSON["dBalance"]["_text"];
			return {
				statusCode: statusCode,
				data: dataObject
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   * inputData = {
   *      sClientUserName : "60165491128",
   *      sClientPassword : "richtech",
   *      sProductID = "8",
   *      dProductPrice = "5",
   *      sCustomerAccountNumber = "0123456789",
   *      sCustomerMobileNumber = "60197822927",
   *      sDealerMobileNumber = "",
   *      sRemark = "",
   *      sOtherParameter = ""
   * }
   */
	async requestTopup(inputData) {
		try {
			// const timestamp = moment().format("YYYYMMDDHHmmssMSMSMS");
			const timestamp = `${moment().format("YYYYMMDDHHmmssSSS")}${Math.floor(100 + Math.random() * 999)}`;
			const key = Env.get("NODE_ENV") === "production" ? "8Q25a$aa4qse!1" : "95586318D1S&!u6";
			let internalData = {
				sClientTxID: timestamp,
				sTS: timestamp,
				sEncKey: crypto.createHash("md5").update(Env.get("SRS_USERNAME") + key + timestamp).digest("hex"),
				command: "RequestTopup"
			};

			let xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <${internalData.command} xmlns="http://tempuri.org/">
                        <sClientUserName>${Env.get("SRS_USERNAME")}</sClientUserName>
                        <sClientPassword>${Env.get("SRS_CLIENT_PASSWORD")}</sClientPassword>
                        <sClientTxID>${internalData.sClientTxID}</sClientTxID>
                        <sProductID>${inputData.product_id}</sProductID>
                        <dProductPrice>${inputData.product_price}</dProductPrice>
                        <sCustomerAccountNumber>${inputData.customer_account_number.replace(
							/^(60|\+60)/gi,
							"0"
						)}</sCustomerAccountNumber>
                        <sCustomerMobileNumber>${inputData.customer_mobile_number.replace(
							/^(60|\+60)/gi,
							"0"
						)}</sCustomerMobileNumber>
                        <sDealerMobileNumber>${Env.get("SRS_USERNAME")}</sDealerMobileNumber>
                        <sRemark>${inputData.remark || "Telin"}</sRemark>
                        <sOtherParameter>${inputData.other_parameter || "Telin"}</sOtherParameter>
                        <sTS>${internalData.sTS}</sTS>
                        <sEncKey>${internalData.sEncKey}</sEncKey>
                    </${internalData.command}>
                </soap:Body>
            </soap:Envelope>`;

			Logger.info(xml);
			// usage of module
			const { response } = await soapRequest(url_topup_pin, headers, xml);
			const { body, statusCode } = response;

			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			responseInJSON = responseInJSON["soap:Envelope"]["soap:Body"]["RequestTopupResponse"];
			let dataObject = {};
			if (typeof responseInJSON["RequestTopupResult"] !== "undefined")
				dataObject["result"] = responseInJSON["RequestTopupResult"]["_text"];
			if (typeof responseInJSON["sResponseID"] !== "undefined")
				dataObject["response_id"] = responseInJSON["sResponseID"]["_text"];
			if (typeof responseInJSON["sResponseStatus"] !== "undefined")
				dataObject["status"] = responseInJSON["sResponseStatus"]["_text"];
			return {
				statusCode: statusCode,
				data: dataObject
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   * inputData = {
   *      sClientUserName : "60165491128",
   *      sClientPassword : "richtech",
   *      sClientTxID : "20190402073315444444"
   * }
   */
	async checkTransactionStatus(transaction_id) {
		try {
			const command = "CheckTransactionStatus";
			let xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <${command} xmlns="http://tempuri.org/">
                        <sClientUserName>${Env.get("SRS_USERNAME")}</sClientUserName>
                        <sClientPassword>${Env.get("SRS_CLIENT_PASSWORD")}</sClientPassword>
                        <sClientTxID>${transaction_id}</sClientTxID>
                    </${command}>
                </soap:Body>
            </soap:Envelope>`;

			const { response } = await soapRequest(url_balance_status, headers, xml);
			const { body, statusCode } = response;

			// console.log(xml);
			// console.log(response);
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			/// verbose
			Logger.info("SRS-checkTransactionStatus: " + transaction_id, {
				raw: [ body, statusCode ],
				responseInJSON
			});
			responseInJSON = responseInJSON["soap:Envelope"]["soap:Body"]["CheckTransactionStatusResponse"];
			let dataObject = {};
			if (typeof responseInJSON["CheckTransactionStatusResult"] !== "undefined")
				dataObject["result"] = responseInJSON["CheckTransactionStatusResult"]["_text"];
			if (typeof responseInJSON["sTransactionErrorCode"] !== "undefined")
				dataObject["error_code"] = responseInJSON["sTransactionErrorCode"]["_text"];
			if (typeof responseInJSON["sTransactionStatus"] !== "undefined")
				dataObject["status"] = responseInJSON["sTransactionStatus"]["_text"];
			if (typeof responseInJSON["sTransactionDNReceivedID"] !== "undefined")
				dataObject["DN_received_id"] = responseInJSON["sTransactionDNReceivedID"]["_text"];
			if (responseInJSON["sTransactionStatus"]["_text"] === "REFUNDED") Logger.warning("Refunded", body);
			return {
				statusCode: statusCode,
				data: dataObject
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   * inputData = {
   *      sClientUserName : "60165491128",
   *      sClientPassword : "richtech",
   *      sCustomerAccount : "",
   *      sSDate : "2019/03/2",
   *      sEDate : "2019/04/2"
   * }
   */
	async customerTxStatus(inputData) {
		try {
			const command = "CheckCustomerTxStatus";
			let xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <${command} xmlns="http://tempuri.org/">
                        <sClientUserName>${Env.get("SRS_USERNAME")}</sClientUserName>
                        <sClientPassword>${Env.get("SRS_CLIENT_PASSWORD")}</sClientPassword>
                        <sCustomerAccount>${inputData.customer_account || ""}</sCustomerAccount>
                        <sSDate>${inputData.start_date}</sSDate>
                        <sEDate>${inputData.end_date}</sEDate>
                    </${command}>
                </soap:Body>
            </soap:Envelope>`;

			// usage of module
			const { response } = await soapRequest(url_balance_status, headers, xml);
			const { body, statusCode } = response;

			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);
			responseInJSON =
				responseInJSON["soap:Envelope"]["soap:Body"]["CheckCustomerTxStatusResponse"][
					"CheckCustomerTxStatusResult"
				];
			let responseData = new Array();
			if (typeof responseInJSON !== "undefined") {
				responseInJSON = responseInJSON["CustomerTxStatus"];
				for (let i = 0; i < responseInJSON.length; i++) {
					responseData.push({
						LocalMOID: responseInJSON[i]["LocalMOID"]["_text"],
						Amount: responseInJSON[i]["Amount"]["_text"],
						DateTime: responseInJSON[i]["DateTime"]["_text"],
						MessageIn: responseInJSON[i]["MessageIn"]["_text"],
						Product: responseInJSON[i]["Product"]["_text"],
						RetailPrice: responseInJSON[i]["RetailPrice"]["_text"],
						Retry: responseInJSON[i]["Retry"]["_text"],
						Status: responseInJSON[i]["Status"]["_text"],
						sReloadMSISDN: responseInJSON[i]["sReloadMSISDN"]["_text"]
					});
				}
			}
			return {
				statusCode: statusCode,
				data: responseData
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   * inputData = {
   *      sClientUserName : "60165491128",
   *      sClientPassword : "richtech",
   *      sLocalMOID : "20190402073315444444"
   * }
   */
	async getReloadPINImmediate(local_MO_ID) {
		try {
			const command = "GetReloadPINImmediate";
			let xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <${command} xmlns="http://tempuri.org/">
                        <sClientUserName>${Env.get("SRS_USERNAME")}</sClientUserName>
                        <sClientPassword>${Env.get("SRS_CLIENT_PASSWORD")}</sClientPassword>
                        <sLocalMOID>${local_MO_ID}</sLocalMOID>
                    </${command}>
                </soap:Body>
            </soap:Envelope>`;

			//console.log(xml);
			// usage of module
			const { response } = await soapRequest(url_topup_pin, headers, xml);
			const { body, statusCode } = response;

			//console.log(response);

			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4
				})
			);

			responseInJSON = responseInJSON["soap:Envelope"]["soap:Body"]["GetReloadPINImmediateResponse"];
			// console.log(responseInJSON);
			Logger.info("SRS:getReloadPINImmediate " + local_MO_ID, responseInJSON);

			let dataObject = {};
			if (typeof responseInJSON["GetReloadPINImmediateResult"] !== "undefined")
				dataObject["result"] = responseInJSON["GetReloadPINImmediateResult"]["_text"];
			if (typeof responseInJSON["sSerialNumber"] !== "undefined")
				dataObject["serial_number"] = responseInJSON["sSerialNumber"]["_text"];
			if (typeof responseInJSON["sReloadPin"] !== "undefined")
				dataObject["pin"] = responseInJSON["sReloadPin"]["_text"];
			if (typeof responseInJSON["sExpiryDate"] !== "undefined")
				dataObject["expiry_date"] = responseInJSON["sExpiryDate"];
			if (typeof responseInJSON["sReloadTelco"] !== "undefined")
				dataObject["reload_telco"] = responseInJSON["sReloadTelco"]["_text"];
			if (typeof responseInJSON["sAmount"] !== "undefined")
				dataObject["amount"] = responseInJSON["sAmount"]["_text"];
			if (typeof responseInJSON["sDNReceivedID"] !== "undefined")
				dataObject["DN_received_id"] = responseInJSON["sDNReceivedID"]["_text"];
			if (typeof responseInJSON["sInstruction"] !== "undefined")
				dataObject["instruction"] = responseInJSON["sInstruction"]["_text"];
			if (typeof responseInJSON["sDescription"] !== "undefined")
				dataObject["description"] = responseInJSON["sDescription"]["_text"];
			if (typeof responseInJSON["sBatchID"] !== "undefined")
				dataObject["batch_id"] = responseInJSON["sBatchID"]["_text"];
			return {
				statusCode: statusCode,
				data: dataObject
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}
}

module.exports = new SrsPlugin();
