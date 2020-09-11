"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const soapRequest = require("easy-soap-request");
const convert = require("xml-js");
const crypto = require("crypto");
const moment = require("moment");
const Logger = use("Logger");
const rn = require("random-number");
const FinnetStub = use("App/Common/Supplier/FinnetStub");

const options = {
	min: 100000000000000,
	max: 999999999999999,
	integer: true,
};

const url_pulsa = Env.get("FINNET_URI_PULSA", "https://demos.finnet.co.id/devofc/FinChannelServices/routeX2.php?wsdl");
const url_kaiBpjsPln = Env.get(
	"FINNET_URI_BPJS_KAI_PLN",
	"https://demos.finnet.co.id/devofc/FinChannelServices/routeX2Temp.php?wsdl",
);
const headers = {
	"user-agent": "easy-soap-request-test",
	"Content-Type": "text/xml;charset=UTF-8",
};

const bit39Desc = {
	"0": "Successful approval/completion or that V.I.P. PIN verification is valid",
	"1": "Refer to card issuer",
	"2": "Refer to card issuer",
	"3": "Invalid merchant or service provider",
	"4": "Pickup card",
	"5": "Do not honor",
	"6": "Error",
	"7": "Pickup card",
	"10": "Partial Approval",
	"12": "Invalid transaction",
	"13": "Invalid amount (currency conversion field overflow)",
	"14": "WRONG CUSTOMER NUMBER",
	"15": "WRONG METER NUMBER",
	"17": "Customer cancellation",
	"19": "Re-enter transaction",
	"20": "Invalid response",
	"21": "No action taken (unable to back out prior transaction)",
	"22": "Suspected Malfunction",
	"25": "Unable to locate record in file",
	"28": "File is temporarily unavailable",
	"30": "Format Error",
	"41": "Pickup card (lost card)",
	"43": "Pickup card (stolen card)",
	"51": "Insufficient funds",
	"52": "No checking account",
	"53": "No savings account",
	"54": "Expired card",
	"55": "Incorrect PIN",
	"57": "Transaction not permitted to cardholder",
	"58": "Transaction not allowed at terminal",
	"59": "Suspected fraud",
	"61": "Activity amount limit exceeded",
	"62": "Restricted card (for example",
	"63": "Security violation",
	"65": "Activity count limit exceeded",
	"68": "Response received too late",
	"75": "Allowable number of PIN-entry tries exceeded",
	"76": "Unable to locate previous message (no match on Retrieval Reference number)",
	"77": "Previous message located for a repeat or reversal",
	"78": "’Blocked",
	"80": "Visa transactions: credit issuer unavailable. Private label and check acceptance: Invalid date",
	"81": "PIN cryptographic error found (error found by VIC security module during PIN decryption)",
	"82": "Negative CAM",
	"83": "Unable to verify PIN",
	"85": "No reason to decline a request for account number verification",
	"91": "Issuer unavailable or switch inoperative (STIP not applicable or available for this transaction)",
	"92": "Destination cannot be found for routing",
	"93": "Transaction cannot be completed",
	"94": "Duplicate Transmission",
	"95": "Reconcile error",
	"96": "System malfunction",
	B1: "Surcharge amount not permitted on Visa cards (U.S. acquirers only)",
	N0: "Force STIP",
	N3: "Cash service not available",
	N4: "Cashback request exceeds issuer limit",
	N7: "Decline for CVV2 failure",
	P2: "Invalid biller information",
	P5: "PIN Change/Unblock request declined",
	P6: "Unsafe PIN",
	Q1: "Card Authentication failed",
	R0: "Stop Payment Order",
	R1: "Revocation of Authorization Order",
	R3: "Revocation of All Authorizations Order",
	XA: "Forward to issuer",
	XD: "Forward to issuer",
	Z3: "Unable to go online",
};

class FinnetPlugin {
	constructor() {
		/// on Sandbox, turn on Stub
		const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
		if (sandboxEnv) new FinnetStub(this);
	}

	/**
   * Example of request from Mr. Andre (FINNET)
   * <soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:routeDx2"></soapenv>
   *   <soapenv:Header/>
   *   <soapenv:Body>
   *       <urn:saldoCheck soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
   *         <inputSaldo xsi:type="urn:inputSaldo">
   *             <!--You may enter the following 12 items in any order-->
   *             <userName xsi:type="xsd:string">devlunari</userName>
   *             <signature xsi:type="xsd:string">0743cbb7a944e946660a88f0dfbe84bc09abec6a</signature>
   *             <productCode xsi:type="xsd:string">000001</productCode>
   *             <merchantCode xsi:type="xsd:string">FNN778</merchantCode>
   *             <terminal xsi:type="xsd:string">bogelcoba</terminal>
   *             <merchantNumber xsi:type="xsd:string">+6281000111001</merchantNumber>
   *             <transactionType xsi:type="xsd:string">61</transactionType>
   *             <mcNoHP xsi:type="xsd:string"></mcNoHP>
   *             <mcNoeVA xsi:type="xsd:string"></mcNoeVA>
   *             <pin xsi:type="xsd:string"></pin>
   *             <traxId xsi:type="xsd:string">924000000010076790</traxId>
   *             <timeStamp xsi:type="xsd:string">10-05-2019 13:24:02:0061</timeStamp>
   *         </inputSaldo>
   *       </urn:saldoCheck>
   *   </soapenv:Body>
   * </soapenv:Envelope>
   */
	async checkBalance() {
		try {
			const terminal = "RPG_HASH";
			const trax_id = "921" + rn(options);
			const product_id = "000001";
			const transaction_type = "61";
			const timeStamp = moment().format("DD-MM-YYYY HH:mm:SS:SSSSSS");
			const md5Pass = crypto.createHash("md5").update(Env.get("FINNET_PASSWORD")).digest("hex");
			const stringSignature =
				Env.get("FINNET_USERNAME") +
				md5Pass +
				product_id +
				Env.get("FINNET_MERCHANT_CODE") +
				terminal +
				Env.get("FINNET_MERCHANT_NUMBER") +
				transaction_type +
				trax_id +
				timeStamp;
			const signature = crypto.createHash("sha1").update(stringSignature).digest("hex");
			let xml = `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:routeDx2">
                    <soapenv:Header/>              
                    <soapenv:Body>
                        <urn:saldoCheck soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                          <inputSaldo xsi:type="urn:inputSaldo">
                            <userName xsi:type="xsd:string">${Env.get("FINNET_USERNAME")}</userName>
                            <signature xsi:type="xsd:string">${signature}</signature>
                            <productCode xsi:type="xsd:string">${product_id}</productCode>
                            <merchantCode xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_CODE")}</merchantCode>
                            <terminal xsi:type="xsd:string">${terminal}</terminal>
                            <merchantNumber xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_NUMBER")}</merchantNumber>
                            <transactionType xsi:type="xsd:string">${transaction_type}</transactionType>
                            <traxId xsi:type="xsd:string">${trax_id}</traxId>
                            <timeStamp xsi:type="xsd:string">${timeStamp}</timeStamp>
                          </inputSaldo>
                        </urn:saldoCheck>
                    </soapenv:Body>
                </soapenv:Envelope>`;

			const { response } = await soapRequest(url_kaiBpjsPln, headers, xml, 60 * 1000);
			const { body, statusCode } = response;
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4,
				}),
			);

			responseInJSON =
				responseInJSON["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]["ns1:saldoCheckResponse"]["outputTransaction"];
			let responseData = {};
			for (var attr in responseInJSON) responseData[attr] = responseInJSON[attr]["_text"];

			Logger.info("FINNET:checkBalanceIn");
			Logger.info(xml);
			Logger.info("FINNET:checkBalanceOut", responseData);

			return {
				statusCode: statusCode,
				data: responseData,
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   */
	async billInquiry(inputData) {
		try {
			const { product_id, bill_number, product } = inputData;
			// product id of PLN postpaid: 070007
			const url = [ "BPJS", "PLN", "PLNBILL", "KAI" ].includes(product.toUpperCase())
				? url_kaiBpjsPln
				: url_pulsa;
			const bit61 = bill_number;
			const terminal = "RPG_HASH";
			const trax_id = "921" + rn(options);
			const transaction_type = "38";
			const timeStamp = moment().format("DD-MM-YYYY HH:mm:SS:SSSSSS");
			const md5Pass = crypto.createHash("md5").update(Env.get("FINNET_PASSWORD")).digest("hex");
			const stringSignature =
				Env.get("FINNET_USERNAME") +
				md5Pass +
				product_id +
				Env.get("FINNET_MERCHANT_CODE") +
				terminal +
				Env.get("FINNET_MERCHANT_NUMBER") +
				transaction_type +
				bill_number +
				bit61 +
				trax_id +
				timeStamp;
			const signature = crypto.createHash("sha1").update(stringSignature).digest("hex");
			let xml = `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:routeDx2">
                    <soapenv:Header/> 
                    <soapenv:Body>
                      <urn:billpayment soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                        <inputBillPayment xsi:type="urn:inputBillPayment">
                            <userName xsi:type="xsd:string">${Env.get("FINNET_USERNAME")}</userName>
                            <signature xsi:type="xsd:string">${signature}</signature>
                            <productCode xsi:type="xsd:string">${product_id}</productCode>
                            <merchantCode xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_CODE")}</merchantCode>
                            <terminal xsi:type="xsd:string">${terminal}</terminal>
                            <merchantNumber xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_NUMBER")}</merchantNumber>
                            <transactionType xsi:type="xsd:string">${transaction_type}</transactionType>
                            <billNumber xsi:type="xsd:string">${bill_number}</billNumber>
                            <bit61 xsi:type="xsd:string">${bit61}</bit61>
                            <traxId xsi:type="xsd:string">${trax_id}</traxId>
                            <timeStamp xsi:type="xsd:string">${timeStamp}</timeStamp>
                        </inputBillPayment>
                      </urn:billpayment>
                    </soapenv:Body>
                  </soapenv:Envelope>`;

			Logger.info("FINNET:billInquiryIn", inputData);
			Logger.info(xml);

			const { response } = await soapRequest(url, headers, xml, 60 * 1000);
			const { body, statusCode } = response;
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4,
				}),
			);

			responseInJSON =
				responseInJSON["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]["ns1:billpaymentResponse"]["outputTransaction"];
			let responseData = {};
			for (var attr in responseInJSON) responseData[attr] = responseInJSON[attr]["_text"];
			// add description for bit39
			responseData["bit39_desc"] = bit39Desc[responseData["bit39"]];

			Logger.info("FINNET:billInquiryOut", responseData);

			return {
				statusCode: statusCode,
				data: responseData,
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   */
	async billPayment(inputData) {
		try {
			let { product_id, bill_number, product, amount, bit61, trax_id, fee } = inputData;
			console.log(inputData);
			fee = fee === null ? "" : fee;
			trax_id = trax_id === null ? "921" + rn(options) : trax_id;
			amount = amount === null ? "" : amount;
			const url = [ "BPJS", "PLN", "PLNBILL", "KAI" ].includes(product.toUpperCase())
				? url_kaiBpjsPln
				: url_pulsa;
			const terminal = "RPG_HASH";
			const transaction_type = "50";
			const timeStamp = moment().format("DD-MM-YYYY HH:mm:SS:SSSSSS");
			const md5Pass = crypto.createHash("md5").update(Env.get("FINNET_PASSWORD")).digest("hex");
			const stringSignature =
				Env.get("FINNET_USERNAME") +
				md5Pass +
				product_id +
				Env.get("FINNET_MERCHANT_CODE") +
				terminal +
				Env.get("FINNET_MERCHANT_NUMBER") +
				transaction_type +
				bill_number +
				amount +
				fee +
				bit61 +
				trax_id +
				timeStamp;
			const signature = crypto.createHash("sha1").update(stringSignature).digest("hex");
			let xml = `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:routeDx2">
                    <soapenv:Header/> 
                    <soapenv:Body>
                      <urn:billpayment soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                        <inputBillPayment xsi:type="urn:inputBillPayment">
                          <userName xsi:type="xsd:string">${Env.get("FINNET_USERNAME")}</userName>
                          <signature xsi:type="xsd:string">${signature}</signature>
                          <productCode xsi:type="xsd:string">${product_id}</productCode>
                          <merchantCode xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_CODE")}</merchantCode>
                          <terminal xsi:type="xsd:string">${terminal}</terminal>
                          <merchantNumber xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_NUMBER")}</merchantNumber>
                          <transactionType xsi:type="xsd:string">${transaction_type}</transactionType>
                          <billNumber xsi:type="xsd:string">${bill_number}</billNumber>
                          <amount xsi:type="xsd:string">${amount}</amount>
                          <feeAmount xsi:type="xsd:string">${fee}</feeAmount>
                          <bit61 xsi:type="xsd:string">${bit61}</bit61>
                          <traxId xsi:type="xsd:string">${trax_id}</traxId>
                          <timeStamp xsi:type="xsd:string">${timeStamp}</timeStamp>
                        </inputBillPayment>
                      </urn:billpayment>
                    </soapenv:Body>
                </soapenv:Envelope>`;

			Logger.info("FINNET:billPaymentIn", inputData);
			Logger.info(xml);

			const { response } = await soapRequest(url, headers, xml, 60 * 1000);
			const { body, statusCode } = response;
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4,
				}),
			);

			responseInJSON =
				responseInJSON["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]["ns1:billpaymentResponse"]["outputTransaction"];
			let responseData = {};
			for (var attr in responseInJSON) responseData[attr] = responseInJSON[attr]["_text"];
			// add description for bit39
			responseData["bit39_desc"] = bit39Desc[responseData["bit39"]];

			Logger.info("FINNET:billPaymentOut", responseData);

			return {
				statusCode: statusCode,
				data: responseData,
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	/**
   */
	async checkStatus(inputData) {
		try {
			const { product_id, bill_number, product, trax_id } = inputData;
			const url = [ "BPJS", "PLN", "PLNBILL", "KAI" ].includes(product.toUpperCase())
				? url_kaiBpjsPln
				: url_pulsa;
			const terminal = "RPG_HASH";
			const transaction_type = "77";
			const timeStamp = moment().format("DD-MM-YYYY HH:mm:SS:SSSSSS");
			const md5Pass = crypto.createHash("md5").update(Env.get("FINNET_PASSWORD")).digest("hex");
			const stringSignature =
				Env.get("FINNET_USERNAME") +
				md5Pass +
				product_id +
				Env.get("FINNET_MERCHANT_CODE") +
				terminal +
				Env.get("FINNET_MERCHANT_NUMBER") +
				transaction_type +
				bill_number +
				trax_id +
				timeStamp;
			const signature = crypto.createHash("sha1").update(stringSignature).digest("hex");
			let xml = `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:routeDx2">
                    <soapenv:Header/> 
                    <soapenv:Body>
                      <urn:billpayment soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                        <inputBillPayment xsi:type="urn:inputBillPayment">
                            <userName xsi:type="xsd:string">${Env.get("FINNET_USERNAME")}</userName>
                            <signature xsi:type="xsd:string">${signature}</signature>
                            <productCode xsi:type="xsd:string">${product_id}</productCode>
                            <merchantCode xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_CODE")}</merchantCode>
                            <terminal xsi:type="xsd:string">${terminal}</terminal>
                            <merchantNumber xsi:type="xsd:string">${Env.get("FINNET_MERCHANT_NUMBER")}</merchantNumber>
                            <transactionType xsi:type="xsd:string">${transaction_type}</transactionType>
                            <billNumber xsi:type="xsd:string">${bill_number}</billNumber>
                            <traxId xsi:type="xsd:string">${trax_id}</traxId>
                            <timeStamp xsi:type="xsd:string">${timeStamp}</timeStamp>
                          </inputBillPayment>
                        </urn:billpayment>
                      </soapenv:Body>
                  </soapenv:Envelope>`;

			Logger.info("FINNET:checkStatusIn", inputData);
			Logger.info(xml);

			const { response } = await soapRequest(url, headers, xml, 60 * 1000);
			const { body, statusCode } = response;
			let responseInJSON = JSON.parse(
				convert.xml2json(body, {
					compact: true,
					ignoreDeclaration: true,
					ignoreAttributes: true,
					spaces: 4,
				}),
			);

			responseInJSON =
				responseInJSON["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]["ns1:billpaymentResponse"]["outputTransaction"];
			let responseData = {};
			for (var attr in responseInJSON) responseData[attr] = responseInJSON[attr]["_text"];
			// add description for bit39
			responseData["bit39_desc"] = bit39Desc[responseData["bit39"]];

			Logger.info("FINNET:checkStatusOut", responseData);

			return {
				statusCode: statusCode,
				data: responseData,
			};
		} catch (e) {
			console.log(e);
			return e;
		}
	}
}

module.exports = new FinnetPlugin();
