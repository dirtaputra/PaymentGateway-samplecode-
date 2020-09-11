"use strict";

/** @type {import('@adonisjs/framework/src/Env')} */
const Env = use("Env");
const soapRequest = require("easy-soap-request");
const convert = require("xml-js");
const crypto = require("crypto");
const moment = require("moment");
const Logger = use("Logger");
// const TRANGLO_ID = Env.get("TRANGLO_ID");
// const TRANGLO_PWD = Env.get("TRANGLO_PWD");
// const TRANGLO_KEY = Env.get("TRANGLO_KEY");
const MD5 = use("md5");

let TRANGLO_ID;
let TRANGLO_PWD;
let TRANGLO_KEY;
const TrangloStub = use("App/Common/Supplier/TrangloStub");

let wsdl = Env.get("TRANGLO_WSDL");
const url_topup_pin = Env.get("SRS_URI_TOPUP_PIN", "http://reload.dyndns.org:8020/stagingapi/connect.asmx");
const headers = {
  "user-agent": "easy-soap-request-test",
  "Content-Type": "text/xml;charset=UTF-8",
  soapAction: "http://tempuri.org/IGloTransfer/Ping",
};

class TrangloPlugin {
  constructor() {
    /// on Sandbox, turn on Stub
    const sandboxEnv = Env.get("NODE_ENV") === "sandbox";
    if (sandboxEnv) new TrangloStub(this);
    if (Env.get("NODE_ENV") === "production") {
      TRANGLO_ID = Env.get("TRANGLO_ID");
      TRANGLO_PWD = Env.get("TRANGLO_PWD");
      TRANGLO_KEY = Env.get("TRANGLO_KEY");
      wsdl = Env.get("TRANGLO_WSDL");
    } else {
      TRANGLO_ID = "jimtesting_apimwtc";
      TRANGLO_PWD = "MVH9(TYyqaphigx!";
      TRANGLO_KEY = "iy5VGtE@H4O]UcxZ";
      wsdl = "http://project.tranglo.com:88/API/GloReload.svc?wsdl";
      // TRANGLO_ID = Env.get("TRANGLO_ID");
      // TRANGLO_PWD = Env.get("TRANGLO_PWD");
      // TRANGLO_KEY = Env.get("TRANGLO_KEY");
      // wsdl = Env.get("TRANGLO_WSDL");
    }
  }

  async pingTranglo() {
    try {
      const command = "CheckBalance";
      let xml = `<soap:Envelope xmlns:xsi="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <Ping xmlns="http://tempuri.org/"/>
                </soap:Body>
            </soap:Envelope>`;
      const {
        response
      } = await soapRequest(wsdl, headers, xml, 120 * 1000);
      const {
        body
      } = response;
      let responseInJSON = JSON.parse(
        convert.xml2json(body, {
          compact: true,
          ignoreDeclaration: true,
          ignoreAttributes: true,
          spaces: 4,
        }),
      );
      const init = responseInJSON["s:Envelope"]["s:Body"].PingResponse;
      return {
        //statusCode: statusCode,
        PingResult: init.PingResult._text,
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  }
  async checkBalance() {
    const command = "EWallet_Enquiry";
    const TransactionID = "45623";
    const signature = MD5(TransactionID + TRANGLO_ID + TRANGLO_KEY);
    console.log(TRANGLO_KEY);
    const kepala = {
      "user-agent": "easy-soap-request-test",
      "Content-Type": "text/xml;charset=UTF-8",
      soapAction: "http://tempuri.org/IGloTransfer/EWallet_Enquiry",
    };
    try {
      let xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
                    <Body>
                        <EWallet_Enquiry xmlns="http://tempuri.org/">
                            <!-- Optional -->
                            <req>
                                <credential xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">
                                    <UID xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_ID}</UID>
                                    
                                    <PWD xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_PWD}</PWD>
                                    <Signature xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${signature}</Signature>
                                </credential>
                                <DealerTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${TransactionID}</DealerTransactionId>
                            </req>
                        </EWallet_Enquiry>
                    </Body>
                </Envelope>`;
      const {
        response
      } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
      const {
        body
      } = response;
      let responseInJSON = JSON.parse(
        convert.xml2json(body, {
          compact: true,
          ignoreDeclaration: true,
          ignoreAttributes: true,
          spaces: 4,
        }),
      );
      console.log(response)
      const init = responseInJSON["s:Envelope"]["s:Body"].EWallet_EnquiryResponse.EWallet_EnquiryResult;
      return {
        LastBalance: init["a:LastBalance"]._text,
        Status: {
          Code: init["a:Status"]["b:Code"]._text,
          Description: init["a:Status"]["b:Description"]._text,
          Type: init["a:Status"]["b:Type"]._text,
        },
        WalletCurrency: init["a:WalletCurrency"]._text,
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  async requestTopup(inputData) {
    const kepala = {
      "user-agent": "easy-soap-request-test",
      "Content-Type": "text/xml;charset=UTF-8",
      soapAction: "http://tempuri.org/IGloTransfer/Request_Reload",
    };
    const signature = MD5(
      inputData.TrxID +
      inputData.SourceNo +
      inputData.DestNo +
      inputData.product_code +
      inputData.denom +
      TRANGLO_ID +
      TRANGLO_KEY,
    );
    try {
      let xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
                <Body>
                    <Request_Reload xmlns="http://tempuri.org/">
                        <!-- Optional -->
                        <epinReq>
                            <DealerTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.TrxID}</DealerTransactionId>
                            <SourceNo xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.SourceNo}</SourceNo>
                            <DestNo xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.DestNo}</DestNo>
                            <OperatorCode xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.product_code}</OperatorCode>
                            <Denomination xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.denom}</Denomination>
                            <ByAmount xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">false</ByAmount>
                            <Credentials xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">
                                <UID xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_ID}</UID>
                                <PWD xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_PWD}</PWD>
                                <Signature xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${signature}</Signature>
                            </Credentials>
                        </epinReq>
                    </Request_Reload>
                </Body>
            </Envelope>`;
      const {
        response
      } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
      const {
        body
      } = response;
      let responseInJSON = JSON.parse(
        convert.xml2json(body, {
          compact: true,
          ignoreDeclaration: true,
          ignoreAttributes: true,
          spaces: 4,
        }),
      );
      // console.log(xml)
      const init = responseInJSON["s:Envelope"]["s:Body"].Request_ReloadResponse.Request_ReloadResult;
      return {
        Status: {
          Code: init["a:Status"]["b:Code"]._text,
          Description: init["a:Status"]["b:Description"]._text,
          Type: init["a:Status"]["b:Type"]._text,
        },
        WalletCurrency: init["a:WalletCurrency"]._text,
        ProductPrice: init["a:ProductPrice"]._text,
        AmountCurrency: init["a:AmountCurrency"]._text,
        AmountAfterTax: init["a:AmountAfterTax"]._text,
        // DealerTransactionID: init['a:DealerTransactionId']._text,
        TrangloTransactionId: init["a:TrangloTransactionId"]._text,
        OperatorCode: init["a:OperatorCode"]._text,
        Denomination: init["a:Denomination"]._text,
        OperatorTransactionID: init["a:OperatorTransactionID"],
        reason: init["a:Status"]["b:Description"]._text,
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  async checkTransactionStatus(inputData) {
    const kepala = {
      "user-agent": "easy-soap-request-test",
      "Content-Type": "text/xml;charset=UTF-8",
      soapAction: "http://tempuri.org/IGloTransfer/Transaction_Enquiry",
    };
    //DealerTransactionID + TrangloTransactionID + Credentials.UID + Security Key
    const signature = MD5(
      inputData.DealerTransactionID + inputData.TrangloTransactionID + TRANGLO_ID + TRANGLO_KEY,
    );
    try {
      let xml = ` 
      <Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
        <Body>
            <Transaction_Enquiry xmlns="http://tempuri.org/">
                <!-- Optional -->
                <req>
                    <credential xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">
                        <UID xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_ID}</UID>

                        <PWD xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_PWD}</PWD>
                        <Signature xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${signature}</Signature>
                    </credential>
                    <TrangloTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.TrangloTransactionID}</TrangloTransactionId>
                    <DealerTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.DealerTransactionID}</DealerTransactionId>
                </req>
            </Transaction_Enquiry>
        </Body>
      </Envelope>`;
      const {
        response
      } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
      const {
        body
      } = response;
      let responseInJSON = JSON.parse(
        convert.xml2json(body, {
          compact: true,
          ignoreDeclaration: true,
          ignoreAttributes: true,
          spaces: 4,
        }),
      );
      const init = responseInJSON["s:Envelope"]["s:Body"].Transaction_EnquiryResponse.Transaction_EnquiryResult;
      console.log(init["a:TrangloTransactionId"]._text);
      return {
        TrangloTransactionId: init["a:TrangloTransactionId"]._text,
        DealerTransactionId: init["a:DealerTransactionId"]._text,
        DealerTransactionStatus: {
          Code: init["a:DealerTransactionStatus"]["b:Code"]._text,
          Description: init["a:DealerTransactionStatus"]["b:Description"]._text,
          Type: init["a:DealerTransactionStatus"]["b:Type"]._text,
        },
        reason: init["a:DealerTransactionStatus"]["b:Description"]._text,
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  async checkTransactionStatusDetails(inputData) {
    const kepala = {
      "user-agent": "easy-soap-request-test",
      "Content-Type": "text/xml;charset=UTF-8",
      soapAction: "http://tempuri.org/IGloTransfer/Transaction_Enquiry_Details",
    };
    const production = Env.get("NODE_ENV");
    //DealerTransactionID + TrangloTransactionID + Credentials.UID + Security Key
    const signature = MD5(
      inputData.DealerTransactionID + inputData.TrangloTransactionID + TRANGLO_ID + TRANGLO_KEY,
    );
    try {
      let xml = `      
            <Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">
              <Body>
                  <Transaction_Enquiry_Details xmlns="http://tempuri.org/">
                      <!-- Optional -->
                      <req>
                          <credential xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">
                              <UID xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_ID}</UID>
                              <PWD xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${TRANGLO_PWD}</PWD>
                              <Signature xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Common.Entity">${signature}</Signature>
                          </credential>
                          <TrangloTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.TrangloTransactionID}</TrangloTransactionId>
                          <DealerTransactionId xmlns="http://schemas.datacontract.org/2004/07/Tranglo20.Business.Processor">${inputData.DealerTransactionID}</DealerTransactionId>
                      </req>
                  </Transaction_Enquiry_Details>
              </Body>
            </Envelope>`;
      const {
        response
      } = await soapRequest(wsdl, kepala, xml, 120 * 1000);
      const {
        body
      } = response;
      Logger.info("TrangloCheckStatus:response", response);
      let responseInJSON = JSON.parse(
        convert.xml2json(body, {
          compact: true,
          ignoreDeclaration: true,
          ignoreAttributes: true,
          spaces: 4,
        }),
      );
      const init =
        responseInJSON["s:Envelope"]["s:Body"].Transaction_Enquiry_DetailsResponse
        .Transaction_Enquiry_DetailsResult;
      // console.log(init["a:TrangloTransactionId"]._text);
      if (production === "production") {
        const voucherCode = init["a:SerialNo"] ?
          init["a:SerialNo"]._text :
          init["a:OperatorTransactionID"]._text;
        return {
          TrangloTransactionId: init["a:TrangloTransactionId"]._text,
          DealerTransactionId: init["a:DealerTransactionId"]._text,
          DealerTransactionStatus: {
            Code: init["a:DealerTransactionStatus"]["b:Code"]._text,
            Description: init["a:DealerTransactionStatus"]["b:Description"]._text,
            Type: init["a:DealerTransactionStatus"]["b:Type"]._text,
          },
          OperatorTransactionID: init["a:OperatorTransactionID"]._text,
          DestNo: init["a:DestNo"]._text,
          ProdCode: init["a:ProdCode"]._text,
          serialNo: voucherCode,
          WalletCurrency: init["a:WalletCurrency"]._text,
          ProductPrice: init["a:ProductPrice"]._text,
          AmountCurrency: init["a:AmountCurrency"]._text,
          AmountAfterTax: init["a:AmountAfterTax"]._text,
          reason: init["a:DealerTransactionStatus"]["b:Description"]._text,
        };
      } else {
        // const voucherCode = init["a:SerialNo"] ?
        //   init["a:SerialNo"]._text :
        //   init["a:OperatorTransactionID"]._text;
        return {
          TrangloTransactionId: init["a:TrangloTransactionId"]._text,
          DealerTransactionId: init["a:DealerTransactionId"]._text,
          DealerTransactionStatus: {
            Code: init["a:DealerTransactionStatus"]["b:Code"]._text,
            Description: init["a:DealerTransactionStatus"]["b:Description"]._text,
            Type: init["a:DealerTransactionStatus"]["b:Type"]._text,
          },
          OperatorTransactionID: init["a:OperatorTransactionID"]._text,
          DestNo: init["a:DestNo"]._text,
          ProdCode: init["a:ProdCode"]._text,
          //serialNo: init["a:SerialNo"]._text,
          WalletCurrency: init["a:WalletCurrency"]._text,
          ProductPrice: init["a:ProductPrice"]._text,
          AmountCurrency: init["a:AmountCurrency"]._text,
          AmountAfterTax: init["a:AmountAfterTax"]._text,
          reason: init["a:DealerTransactionStatus"]["b:Description"]._text,
        };
      }
    } catch (e) {
      console.log(e);
      return e;
    }
  }
}

module.exports = new TrangloPlugin();
