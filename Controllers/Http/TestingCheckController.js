"use strict";
const check = use("App/Common/Supplier/AutoCheck");
const supply = use("App/Models/Supply");
const JsonFind = require("json-find");
const convert = require("xml-js");
const meReload = use("App/Common/Supplier/MeReloadPlugin");
const moment = require("moment");
const CatalogKeeper = use("App/Common/CatalogKeeper");
const numeral = require("numeral");
const Env = use("Env");
const Cache = use("Cache");
const curTime = use("App/Common/CurrencyKeeper");
const catalogDetail = use("App/Models/CatalogDetail");
const TrangloPlugin = use("App/Common/Supplier/TrangloPlugin");
const crypto = require("crypto");

class TestingCheckController {
  async Testing({
    request,
    response,
    auth
  }) {
    try {
      const alterraData = await check.alterraProduct();
      const supplyData = await supply
        .query()
        .where("supplier_code", "ALTERRA")
        .where("is_check", true)
        .fetch();
      const tmp = supplyData.toJSON().map(x => {
        return {
          id: x.id,
          supply_id: x.supplier_product_id.product_id
        };
      });
      const panjangBocor = alterraData.data;
      //find alterra data
      let dataLoop = new Array();
      for (let i = 0; i < panjangBocor.length; i++) {
        for (let j = 0; j < tmp.length; j++) {
          if (tmp[j].supply_id == panjangBocor[i].product_id) {
            console.log(tmp[j].id);
            console.log(panjangBocor[i].enabled);
            await check.updateAlterra(tmp[j].id, panjangBocor[i].enabled);
          }
        }
      }
      return response.send({
        message: "success"
      });
    } catch (error) {
      return response.send({
        error: error.message
      });
    }
  }

  async alterraData({
    request,
    response,
    auth
  }) {
    const alterraData = await check.alterraProduct();
    return response.send({
      data: alterraData
    });
  }

  async supplyData({
    request,
    response,
    auth
  }) {
    const supplyData = await supply
      .query()
      .where("supplier_code", "ALTERRA")
      .fetch();
    const tmp = supplyData.toJSON().map(x => {
      return {
        id: x.id,
        supply_id: x.supplier_product_id.product_id
      };
    });
    return response.send({
      data: tmp
    });
  }

  async xmlSoap({
    request,
    response
  }) {
    const res = {
      data: {
        headers: {
          "cache-control": "private, max-age=0",
          "content-length": "357",
          "content-type": "text/xml; charset=utf-8",
          server: "Microsoft-IIS/7.5",
          "x-aspnet-version": "2.0.50727",
          "x-powered-by": "ASP.NET",
          date: "Tue, 06 Aug 2019 06:40:42 GMT",
          connection: "close"
        },
        body: '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><SendCommandResponse xmlns="http://tempuri.org/"><SendCommandResult>1</SendCommandResult></SendCommandResponse></soap:Body></soap:Envelope>',
        statusCode: 200
      }
    };
    let responseInJSON = JSON.parse(
      convert.xml2json(res.data.body, {
        compact: true,
        ignoreDeclaration: true,
        ignoreAttributes: true,
        spaces: 4
      })
    );
    const init =
      responseInJSON["soap:Envelope"]["soap:Body"].SendCommandResponse
      .SendCommandResult._text;
    console.log(init);
    response.send(init);
  }

  async purchase({
    request,
    response
  }) {
    const refID = await CatalogKeeper.generateRefID();
    var inputData = {
      ref: refID,
      category: "ELOAD",
      target: "0182463187",
      denom: 1,
      productCode: "UM"
    };

    const me = await meReload.requestTopup(inputData);
    //const asd = numeral(test)._value.toString()
    response.send({
      data: me,
      // unix: inputData.ref,
      ref: refID
    });
  }

  async status({
    request,
    response
  }) {
    // var inputData = {
    //   ref: "Bj0JdZ",
    // }
    // const whitelist = Env.get("JOMPAY_IP");
    // const whitelistData = whitelist.split(":");
    // const me = await meReload.checkStatus(inputData)
    // //await Cache.forget('U7fDVwsBdsphfvEwfx6GKNloek8BxSX1ATy4uHkHCWY=')
    // response.send({
    //   data: me,
    //   // ip: whitelistData
    // })
    // const body = {
    //   accounttype: "1",
    //   amount: 10000,
    //   billerbankname: "MAYBANK",
    //   billerbanknum: "100002270",
    //   billercode: "39446",
    //   billercodename: "TELIN MALAYSIA",
    //   channel: "3",
    //   currencycode: "MYR",
    //   debittimestamp: "2019-09-13T03:39:09.0000000+00:00",
    //   extdata: null,
    //   nbpsref: "69DD9I2D",
    //   payerbankname: "MAYBANK",
    //   payerbanknum: "100002270",
    //   repeatmsg: "Y",
    //   rrn: "07690910",
    //   rrn2: "myKedai"
    // };
    // var result = Object.keys(body)
    //   .sort()
    //   .map(function(key) {
    //     if (body[key] !== null) {
    //       return body[key];
    //     }
    //   });
    // const date = "20190913040919";
    // const key = "ADEDG4PWEU";
    // result = result.join().replace(/,/g, "");
    // const plainSignature = date + result + key;
    // const signature = crypto
    //   .createHash("SHA256")
    //   .update(plainSignature)
    //   .digest("base64");
    // response.send({
    //   signature: signature,
    //   sagnature: "S8O8yDnu9fpJA+Dg4tF7pzIShewJvQbJ0n/LJKPU07M="
    // });
    const ran = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    response.send({
      token: ran
    })
  }

  async time({
    request,
    response
  }) {
    //const data = await curTime.updateTransaction("TRXXXX4930QW9KZ7", 100000)

    // const tmpData = await catalogDetail.all()
    // const arrData = tmpData.toJSON()
    // const idData = arrData.map(el => {
    //   return el.id
    // })

    // for (let index = 0; index < idData.length; index++) {
    //   const productCatalog = await catalogDetail.find(idData[index])
    //   productCatalog.poin = `{"poin": "1", "value": "0.02", "divider": "10"}`
    //   await productCatalog.save()
    // }
    // const tmpData = await catalogDetail.all()
    // const arrData = tmpData.toJSON()
    // response.send({
    //   data: arrData
    // })
    const inputData = {
      DealerTransactionID: "TRXXXX4A79CLJQYK",
      TrangloTransactionID: "190903101311012"
    };
    const test = await TrangloPlugin.checkTransactionStatusDetails(inputData);
    response.send({
      data: test
    });
  }

  async generateUploadURL({
    request,
    response
  }) {
    const serializeError = require("serialize-error");
    const Logger = use("Logger");
    const SK = use("App/Common/StorageKeeper");
    try {
      const {
        extension
      } = request.get();
      const {
        filename,
        url,
        expiry_date
      } = await SK.generateUploadURL(
        extension
      );
      response.send({
        status: "OK",
        data: {
          filename,
          url,
          expiry_date
        }
      });
    } catch (e) {
      Logger.warning("account::depositCallback", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E991: ${e.message}`
      });
    }
  }
}

module.exports = TestingCheckController;
