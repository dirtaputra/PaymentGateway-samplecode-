"use strict";

const CatalogKeeper = use("App/Common/CatalogKeeper");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const PurchaseValidation = use("App/Common/PurchaseValidation");
const Finnet = use("App/Common/Supplier/FinnetPlugin");
const Supply = use("App/Models/Supply");
const Catalog = use("App/Models/Catalog");
const CatalogDetail = use("App/Models/CatalogDetail");
const Event = use("Event");
const Env = use("Env");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const AlterraPlugin = use("App/Common/Supplier/AlterraPlugin");
const millify = require("millify");
const Cache = use("Cache");
const Database = use("Database");
const axios = require("axios");

const rc_desc_alterra = {
  "00": "Success",
  "10": "Pending",
  "20": "Wrong number/ number blocked/ number expired",
  "21": "Product Issue",
  "22": "Duplicate Transaction",
  "23": "Connection Timeout",
  "24": "Provider Cut Off",
  "25": "KWH is Overlimit",
  "26": "Payment Overlimit",
  "50": "Bill Already Paid/ Not Available",
  "51": "Invalid Inquiry Amount or No inquiry",
  "98": "Order Canceled by Ops",
  "99": "General Error"
};

const Ajv = require("ajv");
const ajv = new Ajv({
  allErrors: true
});

const moment = require("moment");

const SandboxData = require("./SandboxData");

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

/**
 * Resourceful controller for interacting with transactions
 */
class TransactionController {
  constructor() {
    this._sandboxEnv = Env.get("NODE_ENV") === "sandbox";
  }
  /**
   *
   * @param {object} ctx
   * @param {Parameters} ctx.params
   * @param {Response} ctx.response
   */
  async productList({ params, response, request }) {
    ///
    if (await Cache.has("api_get_product_list")) {
      const obj_cache = await Cache.get("api_get_product_list");
      return response.send(obj_cache);
    }

    const listOfProduct = await Supply.query()
      .distinct("category")
      .distinct("product_code")
      .with("catalog")
      .where("status", "ENABLE")
      .orderBy("category", "desc")
      .orderBy("product_code", "asc")
      .fetch();

    const remapedList = listOfProduct.toJSON().map(el => {
      // console.log(el);
      const { country, currency } = countryCurrencyMap(el.catalog.origin);
      return {
        code: el.product_code,
        category: el.category,
        type: ["ELOAD", "PIN"].includes(el.category)
          ? "opt"
          : el.category === "BILL"
          ? "bill"
          : "bill-predefined",
        name: el.catalog.name,
        country,
        currency
      };
    });
    // remapedList.sort((a, b) =>
    //   (a.category == b.category && a.name < b.name) ? -1 :
    //   (a.category == b.category && b.name < a.name) ? 1 : 0
    // );
    const res_data = {
      status: "OK",
      data: remapedList
    };
    await Cache.add("api_get_product_list", res_data, 30); //15 seconds
    response.send(res_data);
  }

  async inquiryMap({ request, params, response }) {
    const knownUser = request.buyerAccount;
    let inc_limit = 0;
    if (await Cache.has("inquiry_limit_" + knownUser.id)) {
      const obj_cache = await Cache.get("inquiry_limit_" + knownUser.id);
      inc_limit = Number(obj_cache);
      if (inc_limit === 30) {
        return response.send({
          status: "FAIL",
          error: "Limit inquiry request 30 RPM"
        });
      }
    }
    await Cache.put("inquiry_limit_" + knownUser.id, inc_limit + 1, 1); //a minute

    const headers = request.headers();
    const version = headers["accept-version"] ? headers["accept-version"] : "1";
    if (["1", "2"].includes(version)) {
      switch (version) {
        case "1":
          await this.inquiry(params, response);
          break;

        case "2":
          await this.inquiryByID(params, response);
          break;
      }
    } else {
      response.send({
        status: "FAIL",
        error: "E990: Wrong version number!"
      });
    }
  }

  /**
   *
   * @param {object} ctx
   * @param {Parameters} ctx.params
   * @param {Response} ctx.response
   */
  async inquiry(params, response) {
    try {
      /// parse input
      const codeName = (params.code || "").toUpperCase();
      // console.log(codeName);
      if (!codeName) {
        return response.send({
          status: "FAIL",
          error: `E030: Missing product code`
        });
      }
      // check in redis
      if (await Cache.has(codeName + "_v1")) {
        const obj_cache = await Cache.get(codeName + "_v1");
        return response.send(obj_cache);
      }
      ///
      const [availablePrice, catalogObj] = await Promise.all([
        CatalogKeeper.findPriceList(codeName),
        Catalog.findBy("code", codeName)
      ]);
      if (availablePrice.length === 0) {
        return response.send({
          status: "FAIL",
          error: `E031: Price list is not available`
        });
      }
      const { currency } = countryCurrencyMap(catalogObj.origin);
      //// otherwise
      const res_data = {
        status: "OK",
        data: {
          product: codeName,
          currency,
          prefix: catalogObj.prefix || "",
          price_list: availablePrice
        }
      };
      await Cache.add(codeName + "_v1", res_data, 15); //15 minutes
      response.send(res_data);
    } catch (e) {
      Logger.warning("trx::inquiry", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async inquiryByID(params, response) {
    try {
      /// parse input
      const codeName = (params.code || "").toUpperCase();
      // console.log(codeName);
      if (!codeName) {
        return response.send({
          status: "FAIL",
          error: `E030: Missing product code`
        });
      }
      // check in redis
      if (await Cache.has(codeName + "_v2")) {
        const obj_cache = await Cache.get(codeName + "_v2");
        return response.send(obj_cache);
      }
      ///
      const [availablePrice, catalogObj] = await Promise.all([
        CatalogKeeper.findPriceListWithID(codeName),
        Catalog.findBy("code", codeName)
      ]);
      if (availablePrice.length === 0) {
        return response.send({
          status: "FAIL",
          error: `E031: Price list is not available`
        });
      }
      const { currency } = countryCurrencyMap(catalogObj.origin);
      //// otherwise
      const res_data = {
        status: "OK",
        data: {
          product: codeName,
          currency,
          prefix: catalogObj.prefix || "",
          price_list: availablePrice
        }
      };
      await Cache.add(codeName + "_v2", res_data, 15); //15 minutes
      response.send(res_data);
    } catch (e) {
      Logger.warning("trx::inquiry", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async inquiryFinalMap({ request, auth, response }) {
    await this.inquiryFinalByID(request, response);
  }

  /**
   *
   * @param {object} ctx
   * @param {Parameters} ctx.params
   * @param {Response} ctx.response
   */
  async inquiryFinal({ params, response }) {
    try {
      /// parse input
      const codeName = (params.code || "").toUpperCase();
      const denom = Number(params.denom || 0);
      console.log([codeName, denom]);
      if (!codeName) {
        return response.send({
          status: "FAIL",
          error: `E030: Missing product code`
        });
      }
      if (denom <= 0) {
        return response.send({
          status: "FAIL",
          error: `E034: Invalid product denomination`
        });
      }
      // block DATAPACK & PLN
      if (codeName.match(/(PLN|DATA)/gi)) {
        return response.send({
          status: "FAIL",
          error: `Please update MyKedai to the latest version`
        });
      }
      ///
      const [
        { finalPrice, valid_denom, reference, error },
        catalogObj
      ] = await Promise.all([
        PurchaseValidation.sellingPrice(codeName, denom),
        Catalog.findBy("code", codeName)
      ]);
      if (error) {
        return response.send({
          status: "FAIL",
          error: `E031: Price list is not available`
        });
      }
      const { currency } = countryCurrencyMap(catalogObj.origin);
      //// otherwise
      response.send({
        status: "OK",
        data: {
          product: codeName,
          currency,
          denom: valid_denom,
          price: finalPrice,
          rrp: reference,
          prefix: catalogObj.prefix
        }
      });
    } catch (e) {
      Logger.warning("trx::inquiry", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  /**
   * @param {object} ctx
   * @param {Parameters} ctx.params
   * @param {Response} ctx.response
   */
  async inquiryFinalByID(request, response) {
    try {
      const { itemID, denom, target } = request.post();
      const splittedID = itemID.split(":");
      const product = splittedID[0];
      const sub_id = splittedID[1];
      const codeName = product.toUpperCase();

      console.log([codeName, denom]);
      if (denom <= 0) {
        return response.send({
          status: "FAIL",
          error: `E034: Invalid product denomination`
        });
      }
      ///
      const [
        { finalPrice, valid_denom, reference, label, poin, error },
        catalogObj
      ] = await Promise.all([
        PurchaseValidation.sellingPriceByID(codeName, sub_id, denom),
        Catalog.findBy("code", codeName)
      ]);
      if (error) {
        return response.send({
          status: "FAIL",
          error: `E031: Price list is not available`
        });
      }
      //check phone number
      if (
        [
          "TSEL",
          "TSELDATA",
          "AXIS",
          "AXISDATA",
          "INDOSATOOREDOO",
          "ISATDATA",
          "SMARTFREN",
          "SMARTFRENDATA",
          "TRI",
          "TRIDATA",
          "XL",
          "XLDATA"
        ].includes(codeName)
      ) {
        const isValid = await MobilePrefixCheck(codeName, target);
        if (!isValid) {
          return response.send({
            status: "FAIL",
            info: "Invalid number for this operator!"
          });
        }
      }
      // check PLN prepaid
      let info = null;
      if (["PLN", "PLNBILL"].includes(codeName)) {
        const supDef =
          (await Supply.query()
            .where("product_code", codeName)
            .where(function() {
              this.where(function() {
                this.where("denom", valid_denom).whereNull("min_denom");
              }).orWhere(function() {
                this.where("min_denom", "<=", valid_denom).where(
                  "denom",
                  ">=",
                  valid_denom
                );
              });
            })
            .fetch()).first() || null;
        if (supDef) {
          const requestData = Object.assign(
            {
              product: supDef.toJSON().supplier_product_id.type,
              target: target
            },
            supDef.toJSON().supplier_product_id
          );
          // do an inquiry.
          const { data } = await AlterraPlugin.inquiry(requestData);
          if (data.error) {
            Logger.info("inquiryFinalByID:PLN", data.error);
            return response.send({
              status: "FAIL",
              info: data.error
            });
          }
          Logger.info("inquiryFinalByID:PLN", data);
          if (
            ["20", "21", "24", "25", "99"].includes(data.response_code) ||
            data.error
          ) {
            return response.send({
              status: "FAIL",
              info:
                rc_desc_alterra[data.response_code] || "Invalid meter number"
            });
          }
          info = `${data.subscriber_name} (${data.subscriber_segmentation}) ${data.power}va`;
        } else {
          return response.send({
            status: "FAIL",
            info: "Product is currently unavailable"
          });
        }
      }
      //
      const { currency } = countryCurrencyMap(catalogObj.origin);
      //// otherwise
      response.send({
        status: "OK",
        data: {
          itemID: `${codeName}:${sub_id}:${millify(valid_denom)}`,
          currency,
          denom: valid_denom,
          price: finalPrice,
          rrp: reference,
          info: info,
          prefix: catalogObj.prefix,
          label: label,
          poin: parseFloat(poin.value / poin.poin).toFixed(3)
        }
      });
    } catch (e) {
      Logger.warning("trx::inquiry", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async inquiryFinalBill({ params, response }) {
    try {
      const codeName = (params.code || "").toUpperCase();
      const billNumber = params.bill || "";
      // check code name
      if (!codeName) {
        return response.send({
          status: "FAIL",
          error: `E030: Missing product code`
        });
      }
      // check bill number
      if (!billNumber) {
        return response.send({
          status: "FAIL",
          error: `E003: Missing bill number`
        });
      }
      //
      let info = null;
      // check codeName
      const [listSupportedProducts, catalogObj] = await Promise.all([
        Supply.query()
          .where("category", "PREDEFINED")
          .distinct("product_code")
          .fetch(),
        Catalog.findBy("code", codeName)
      ]);
      const mappedSupportedProducts = listSupportedProducts.rows.map(
        x => x.product_code
      );
      if (!mappedSupportedProducts.includes(codeName)) {
        return response.send({
          status: "FAIL",
          error: "E033: Product is not available for transaction"
        });
      }
      // get bill amount
      const supDef =
        (await Supply.query()
          .where("product_code", codeName)
          .fetch()).first() || null;
      if (supDef) {
        // do an inquiry.
        const { error, telinCost, data } = await this.billData(
          supDef.supplier_product_id.type,
          billNumber,
          supDef.supplier_product_id
        );
        Logger.info(
          "inquiryFinalBill",
          error
            ? {
                error: error
              }
            : data
        );
        if (error) {
          return response.send({
            status: "FAIL",
            data: {
              info: error
            }
          });
        }
        if (
          [
            "20",
            "21",
            "22",
            "23",
            "24",
            "25",
            "26",
            "50",
            "51",
            "98",
            "99"
          ].includes(data.response_code)
        ) {
          return response.send({
            status: "FAIL",
            data: {
              info: rc_desc_alterra[data.response_code]
            }
          });
        }

        if (data.error) {
          if (data.error.includes(450)) {
            return response.send({
              status: "FAIL",
              data: {
                info: "Closed temporarily due to operator issue"
              }
            });
          } else if (data.error.includes(406)) {
            return response.send({
              status: "FAIL",
              data: {
                info: "Invalid subscription number"
              }
            });
          } else {
            return response.send({
              status: "FAIL",
              data: {
                info: "Product unavailable"
              }
            });
          }
        }
        // map customer data
        info = data.power
          ? (info = `${data.subscriber_name} (${data.subscriber_segmentation}) ${data.power}va, ${data.bill_status} mo`)
          : data.name;
        //
        const { currency } = countryCurrencyMap(catalogObj.origin);
        //
        response.send({
          status: "OK",
          data: {
            itemID: `${codeName}:${supDef.sub_id}:${millify(
              Number(data.amount) - Number(data.admin_charge)
            )}`,
            info: info,
            currency,
            denom: Number(data.amount) - Number(data.admin_charge),
            price: telinCost + 2,
            rrp: telinCost + 4,
            prefix: catalogObj.prefix,
            label: "",
            poin: 0
          }
        });
      } else {
        return response.send({
          status: "FAIL",
          info: "Product is currently unavailable"
        });
      }
    } catch (e) {
      Logger.warning("trx::inquiry", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async purchaseMap({ request, auth, response }) {
    const knownUser = request.buyerAccount;
    if (await Cache.has("purchase_limit_" + knownUser.id)) {
      return response.send({
        status: "FAIL",
        error: "Limit purchase request 1 RPS"
      });
    }
    await Cache.add("purchase_limit_" + knownUser.id, "limit 1 RPS", 1 / 60); //a second

    const headers = request.headers();
    const version = headers["accept-version"] ? headers["accept-version"] : "1";
    if (["1", "2", "3", "4"].includes(version)) {
      let { product, target, amount, phone, itemID, poin } = request.post();
      let key_limit = "purchase_limit_10s_";
      switch (version) {
        case "1":
          key_limit = "purchase_limit_10s_" + knownUser.id +"_"+ product +"_"+ target +"_"+ amount +"_"+ phone;
          if (await Cache.has(key_limit)) {
            return response.send({
              status: "FAIL",
              error: "Duplicate Transaction"
            });
          }
          await Cache.add(key_limit, "duplicate transaction in 10 RPS", 1 / 6); //10 seconds
          await this.purchase(request, auth, response);
          break;

        case "2":
          key_limit = "purchase_limit_10s_" + knownUser.id +"_"+ itemID +"_"+ target +"_"+ amount +"_"+ phone;
          if (await Cache.has(key_limit)) {
            return response.send({
              status: "FAIL",
              error: "Duplicate Transaction"
            });
          }
          await Cache.add(key_limit, "duplicate transaction in 10 RPS", 1 / 6); //10 seconds
          await this.purchaseByID(request, auth, response);
          break;

        case "3":
          key_limit = "purchase_limit_10s_" + knownUser.id +"_"+ itemID +"_"+ target +"_"+ amount +"_"+ phone +"_"+ poin;
          if (await Cache.has(key_limit)) {
            return response.send({
              status: "FAIL",
              error: "Duplicate Transaction"
            });
          }
          await Cache.add(key_limit, "duplicate transaction in 10 RPS", 1 / 6); //10 seconds
          await this.purchaseByIDWithPOIN(request, auth, response);
          break;

        case "4":
          key_limit = "purchase_limit_10s_" + knownUser.id +"_"+ itemID +"_"+ target +"_"+ amount +"_"+ phone +"_"+ poin;
          if (await Cache.has(key_limit)) {
            return response.send({
              status: "FAIL",
              error: "Duplicate Transaction"
            });
          }
          await Cache.add(key_limit, "duplicate transaction in 10 RPS", 1 / 6); //10 seconds
          await this.purchaseByIDWithPOINAndBill(request, auth, response);
          break;
      }
    } else {
      response.send({
        status: "FAIL",
        error: "E990: Wrong version number!"
      });
    }
  }

  /**
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
  async purchase(request, auth, response) {
    try {
      /// parse input
      const knownUser = request.buyerAccount;
      let { product, target, amount, phone } = request.post();
      // block DATAPACK & PLN
      if (product.match(/(PLN|DATA)/gi)) {
        return response.send({
          status: "FAIL",
          error: `Please update MyKedai to the latest version`
        });
      }
      // check validator
      const productDetails = await Catalog.findBy(
        "code",
        product.toUpperCase()
      );
      const schema =
        productDetails.toJSON().validator === null
          ? null
          : productDetails.toJSON().validator;
      if (schema !== null) {
        const validate = ajv.compile(schema);
        if (
          !validate({
            phone: phone
          })
        ) {
          // missing phone
          return response.send({
            status: "FAIL",
            error: "E003: Missing phone number!"
          });
        }
      }
      phone = phone ? phone : null;
      //
      let product_code = product.toUpperCase();
      // get balance, selling price and post margin
      let [balance, sellingPrice, supplyDef] = await Promise.all([
        BalanceKeeper.balance(knownUser.id),
        PurchaseValidation.sellingPrice(product_code, amount),
        Supply.findBy("product_code", product)
      ]);
      const {
        status,
        error,
        finalPrice,
        reference,
        valid_denom
      } = sellingPrice;
      // set amount/denom = valid_denom
      const category = supplyDef.category;
      if (category === "PREDEFINED") {
        return response.send({
          status: "FAIL",
          error: "E003: Please update your myKedai App to the latest version!"
        });
      }
      amount = valid_denom;
      if (status !== "OK") {
        return response.send({
          status: "FAIL",
          error: `E032: ${error}`
        });
      }
      // check balance
      if (Number(balance) < Number(finalPrice)) {
        return response.send({
          status: "FAIL",
          error: "E004: Insufficient balance!"
        });
      }
      // generate trxId
      const trxid = CatalogKeeper.generateTrxId();
      // buyer with a sufficient balance. Send OK to buyer.
      response.send({
        status: "OK",
        data: trxid
      });
      // find supplier with the highest margin!
      const PriceAndMargin = await PurchaseValidation.findMargin(
        product_code,
        amount,
        finalPrice
      );
      // insert into table transaction & transaction_histories
      Logger.notice("trx::purchase", PriceAndMargin);
      const trans = new Transaction();
      const trans_hist = new TransactionHistory();
      if (PriceAndMargin.length === 0) {
        // Product can't be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.recipient_phone = phone;
        trans.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        //
        trans_hist.trx_id = trxid;
        trans_hist.status = "FAILED";
        trans_hist.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        await trans.save();
        await trans_hist.save();
        // event.fire to hash & telin;
      } else {
        // Product can be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.supply_id = PriceAndMargin[0].supplier_id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.sell_price = finalPrice;
        trans.cost = PriceAndMargin[0].hbs;
        trans.margin_pre = PriceAndMargin[0].preMargin;
        trans.margin_post = PriceAndMargin[0].postMargin;
        trans.recipient_phone = phone;
        //
        trans_hist.trx_id = trxid;
        trans_hist.status = "QUOTE";
        await trans.save();
        await trans_hist.save();
        //
        BalanceKeeper.deduct({
          userId: knownUser.id,
          amount: parseFloat(finalPrice),
          trxRef: trans_hist.id
        });
        // event.fire
        await this.initJobToWorker({
          trans: trans,
          phone: phone
        });
      }
      // delete cache redis transaction history
      if (await Cache.has("histov1_" + knownUser.id)) {
        await Cache.pull("histov1_" + knownUser.id);
      }
      if (await Cache.has("histov2_" + knownUser.id)) {
        await Cache.pull("histov2_" + knownUser.id);
      }
      if (await Cache.has("statement_" + knownUser.id)) {
        await Cache.pull("statement_" + knownUser.id);
      }
    } catch (e) {
      /// catch error
      Logger.warning("trx::purchase", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  /**
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {View} ctx.view
   */
  async purchaseByID(request, auth, response) {
    try {
      /// parse input
      const knownUser = request.buyerAccount;
      let { itemID, target, amount, phone } = request.post();
      const splittedID = itemID.split(":");
      const product = splittedID[0];
      const sub_id = splittedID[1];
      // check validator
      const productDetails = await Catalog.findBy(
        "code",
        product.toUpperCase()
      );
      const schema =
        productDetails.toJSON().validator === null
          ? null
          : productDetails.toJSON().validator;
      if (schema !== null) {
        const validate = ajv.compile(schema);
        if (
          !validate({
            phone: phone
          })
        ) {
          // missing phone
          return response.send({
            status: "FAIL",
            error: "E003: Missing phone number!"
          });
        }
      }
      phone = phone ? phone : null;
      //
      let product_code = product.toUpperCase();
      // get balance, selling price and post margin
      const [balance, sellingPrice, supplyDef] = await Promise.all([
        BalanceKeeper.balance(knownUser.id),
        PurchaseValidation.sellingPriceByID(product_code, sub_id, amount),
        Supply.findBy("product_code", product)
      ]);

      const category = supplyDef.category;
      if (category === "PREDEFINED") {
        return response.send({
          status: "FAIL",
          error: "E003: Please update your myKedai App to the latest version!"
        });
      }

      const {
        status,
        error,
        finalPrice,
        reference,
        valid_denom,
        label
      } = sellingPrice;
      // set amount/denom = valid_denom
      amount = valid_denom;
      if (status !== "OK") {
        return response.send({
          status: "FAIL",
          error: `E032: ${error}`
        });
      }
      // check balance
      if (Number(balance) < Number(finalPrice)) {
        return response.send({
          status: "FAIL",
          error: "E004: Insufficient balance!"
        });
      }
      // generate trxId
      const trxid = CatalogKeeper.generateTrxId();
      // buyer with a sufficient balance. Send OK to buyer.
      response.send({
        status: "OK",
        data: trxid
      });
      // find supplier with the highest margin!
      const PriceAndMargin = await PurchaseValidation.findMarginByID(
        product_code,
        sub_id,
        amount,
        finalPrice
      );
      // insert into table transaction & transaction_histories
      Logger.notice("trx::purchase", PriceAndMargin);
      const trans = new Transaction();
      const trans_hist = new TransactionHistory();
      if (PriceAndMargin.length === 0) {
        // Product can't be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        trans.recipient_phone = phone;
        trans.sub_id = sub_id ? sub_id : null;
        //
        trans_hist.trx_id = trxid;
        trans_hist.status = "FAILED";
        trans_hist.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        await trans.save();
        await trans_hist.save();
        // event.fire to hash & telin;
      } else {
        // Product can be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.supply_id = PriceAndMargin[0].supplier_id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.sell_price = finalPrice;
        trans.cost = PriceAndMargin[0].hbs;
        trans.margin_pre = PriceAndMargin[0].preMargin;
        trans.margin_post = PriceAndMargin[0].postMargin;
        trans.sub_id = sub_id ? sub_id : null;
        trans.recipient_phone = phone;
        trans.remark = label;
        //
        trans_hist.trx_id = trxid;
        trans_hist.status = "QUOTE";
        await trans.save();
        await trans_hist.save();
        //
        BalanceKeeper.deduct({
          userId: knownUser.id,
          amount: parseFloat(finalPrice),
          trxRef: trans_hist.id
        });
        // event.fire
        await this.initJobToWorker({
          trans: trans,
          phone: phone
        });
      }
      // delete cache redis transaction history
      if (await Cache.has("histov1_" + knownUser.id)) {
        await Cache.pull("histov1_" + knownUser.id);
      }
      if (await Cache.has("histov2_" + knownUser.id)) {
        await Cache.pull("histov2_" + knownUser.id);
      }
      if (await Cache.has("statement_" + knownUser.id)) {
        await Cache.pull("statement_" + knownUser.id);
      }
    } catch (e) {
      /// catch error
      Logger.warning("trx::purchase", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async purchaseByIDWithPOIN(request, auth, response) {
    try {
      /// parse input
      const knownUser = request.buyerAccount;
      let { itemID, target, amount, phone, poin } = request.post();
      const splittedID = itemID.split(":");
      const product = splittedID[0];
      const sub_id = splittedID[1];
      // check validator
      const productDetails = await Catalog.findBy(
        "code",
        product.toUpperCase()
      );
      const schema =
        productDetails.toJSON().validator === null
          ? null
          : productDetails.toJSON().validator;
      if (schema !== null) {
        const validate = ajv.compile(schema);
        if (
          !validate({
            phone: phone
          })
        ) {
          // missing phone
          return response.send({
            status: "FAIL",
            error: "E003: Missing phone number!"
          });
        }
      }
      phone = phone ? phone : null;
      //
      let product_code = product.toUpperCase();
      // get balance, selling price and post margin
      const [balance, sellingPrice, supplyDef] = await Promise.all([
        BalanceKeeper.balance(knownUser.id),
        PurchaseValidation.sellingPriceByID(product_code, sub_id, amount),
        Supply.findBy("product_code", product)
      ]);

      const category = supplyDef.category;
      if (category === "PREDEFINED") {
        return response.send({
          status: "FAIL",
          error: "E003: Please update your myKedai App to the latest version!"
        });
      }

      const {
        status,
        error,
        finalPrice,
        reference,
        valid_denom,
        label,
        poin: poinConf
      } = sellingPrice;
      // set amount/denom = valid_denom
      amount = valid_denom;
      if (status !== "OK") {
        return response.send({
          status: "FAIL",
          error: `E032: ${error}`
        });
      }
      // check balance
      if (Number(balance) < Number(finalPrice)) {
        return response.send({
          status: "FAIL",
          error: "E004: Insufficient balance!"
        });
      }
      // generate trxId
      const trxid = CatalogKeeper.generateTrxId();
      // buyer with a sufficient balance. Send OK to buyer.
      response.send({
        status: "OK",
        data: trxid
      });
      // find supplier with the highest margin!
      const PriceAndMargin = await PurchaseValidation.findMarginByID(
        product_code,
        sub_id,
        amount,
        finalPrice
      );
      // insert into table transaction & transaction_histories
      Logger.notice("trx::purchase", PriceAndMargin);
      const trans = new Transaction();
      const trans_hist = new TransactionHistory();
      //
      poin = poinConf === null ? 0 : poin ? poin : 0;
      const discount =
        poinConf === null
          ? 0
          : poin > 0
          ? parseFloat((poinConf.value / poinConf.poin) * poin)
          : 0;
      const updatedPrice = finalPrice - discount;
      //
      if (PriceAndMargin.length === 0) {
        // Product can't be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        trans.recipient_phone = phone;
        trans.sub_id = sub_id ? sub_id : null;
        trans_hist.trx_id = trxid;
        trans_hist.status = "FAILED";
        trans_hist.remark =
          "Found in the product catalog, but can not be found in the supplier catalog";
        await trans.save();
        await trans_hist.save();
        // event.fire to hash & telin;
      } else {
        // Product can be found in the supplier catalog
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.supply_id = PriceAndMargin[0].supplier_id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.sell_price = updatedPrice;
        trans.cost = PriceAndMargin[0].hbs;
        trans.margin_pre = PriceAndMargin[0].preMargin;
        trans.margin_post = PriceAndMargin[0].postMargin;
        trans.sub_id = sub_id ? sub_id : null;
        trans.recipient_phone = phone;
        trans.remark = label;
        // POIN
        trans.discount = discount;
        trans.poin = poin;
        //
        trans_hist.trx_id = trxid;
        trans_hist.status = "QUOTE";
        await trans.save();
        await trans_hist.save();
        //
        const remark = poin > 0 ? `disc. ${Number(poin)} POIN` : "";
        //
        BalanceKeeper.deduct({
          userId: knownUser.id,
          amount: parseFloat(updatedPrice),
          remark: remark,
          trxRef: trans_hist.id
        });
        // event.fire
        await this.initJobToWorker({
          trans: trans,
          phone: phone
        });
      }

      // delete cache redis transaction history
      if (await Cache.has("histov1_" + knownUser.id)) {
        await Cache.pull("histov1_" + knownUser.id);
      }
      if (await Cache.has("histov2_" + knownUser.id)) {
        await Cache.pull("histov2_" + knownUser.id);
      }
      if (await Cache.has("statement_" + knownUser.id)) {
        await Cache.pull("statement_" + knownUser.id);
      }
    } catch (e) {
      /// catch error
      Logger.warning("trx::purchase", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async purchaseByIDWithPOINAndBill(request, auth, response) {
    try {
      /// parse input
      const knownUser = request.buyerAccount;
      let { itemID, target, amount, phone, poin } = request.post();
      const splittedID = itemID.split(":");
      const product = splittedID[0];
      const sub_id = splittedID[1];
      // check validator
      const productDetails = await Catalog.findBy(
        "code",
        product.toUpperCase()
      );
      const schema =
        productDetails.toJSON().validator === null
          ? null
          : productDetails.toJSON().validator;
      if (schema !== null) {
        const validate = ajv.compile(schema);
        if (
          !validate({
            phone: phone
          })
        ) {
          // missing phone
          return response.send({
            status: "FAIL",
            error: "E003: Missing phone number!"
          });
        }
      }
      phone = phone ? phone : null;
      //
      let product_code = product.toUpperCase();
      // get balance, selling price and post margin
      const [balance, sellingPrice, supplyDef] = await Promise.all([
        BalanceKeeper.balance(knownUser.id),
        PurchaseValidation.sellingPriceByID(product_code, sub_id, amount),
        Supply.findBy("product_code", product)
      ]);
      const {
        status,
        error,
        finalPrice,
        reference,
        valid_denom,
        label,
        poin: poinConf
      } = sellingPrice;
      // check product category
      const category = supplyDef.category;
      if (category === "PREDEFINED") {
        // get bill payment data
        const {
          error,
          data,
          dealerCost,
          telinCost,
          rates
        } = await this.billData(
          supplyDef.supplier_product_id.type,
          target,
          supplyDef.supplier_product_id
        );
        // insert into table transaction & transaction_histories
        const trans = new Transaction();
        const trans_hist = new TransactionHistory();
        //
        poin = poinConf === null ? 0 : poin ? poin : 0;
        const discount =
          poinConf === null
            ? 0
            : poin > 0
            ? parseFloat((poinConf.value / poinConf.poin) * poin)
            : 0;
        const updatedPrice = dealerCost - discount;
        if (
          error ||
          ([
            "20",
            "21",
            "22",
            "23",
            "24",
            "25",
            "26",
            "50",
            "51",
            "98",
            "99"
          ].includes(data.response_code) ||
            data.error)
        ) {
          if (data.error) {
            if (data.error.includes(450)) {
              return response.send({
                status: "FAIL",
                error: "Closed temporarily due to operator issue"
              });
            } else {
              return response.send({
                status: "FAIL",
                error: "Product unavailable"
              });
            }
          } else {
            return response.send({
              status: "FAIL",
              error:
                error ||
                `E032: ${rc_desc_alterra[data.response_code] ||
                  "Product unavailable"}`
            });
          }
        } else {
          // check balance
          if (Number(balance) < Number(updatedPrice)) {
            return response.send({
              status: "FAIL",
              error: "E004: Insufficient balance!"
            });
          }
          // generate trxId
          const trxid = CatalogKeeper.generateTrxId();
          // buyer with a sufficient balance. Send OK to buyer.
          response.send({
            status: "OK",
            data: trxid
          });

          trans.id = trxid;
          trans.buyer_id = knownUser.id;
          trans.supply_id = supplyDef.id;
          trans.product_code = product_code;
          trans.target = target;
          trans.denom = Number(data.amount) - Number(data.admin_charge);
          trans.reference = telinCost + 4;
          trans.sell_price = updatedPrice;
          trans.cost = telinCost;
          trans.meta = {
            rrp: telinCost + 4,
            rates: rates,
            category: "PREDEFINED"
          };
          trans.margin_pre = Number(updatedPrice - telinCost);
          trans.margin_post = 0;
          trans.sub_id = sub_id ? sub_id : null;
          trans.recipient_phone = phone;
          trans.remark = label;
          // POIN
          trans.discount = discount;
          trans.poin = poin;
          //
          trans_hist.trx_id = trxid;
          trans_hist.status = "QUOTE";
          await trans.save();
          await trans_hist.save();
          //
          const remark = poin > 0 ? `disc. ${Number(poin)} POIN` : "";
          //
          BalanceKeeper.deduct({
            userId: knownUser.id,
            amount: parseFloat(updatedPrice),
            remark: remark,
            trxRef: trans_hist.id
          });
          // event.fire
          await this.initJobToWorker({
            trans: trans,
            phone: phone
          });
        }
      } else {
        // set amount/denom = valid_denom
        amount = valid_denom;
        if (status !== "OK") {
          return response.send({
            status: "FAIL",
            error: `E032: ${error}`
          });
        }
        // check balance
        if (Number(balance) < Number(finalPrice)) {
          return response.send({
            status: "FAIL",
            error: "E004: Insufficient balance!"
          });
        }
        // generate trxId
        const trxid = CatalogKeeper.generateTrxId();
        // buyer with a sufficient balance. Send OK to buyer.
        response.send({
          status: "OK",
          data: trxid
        });
        // find supplier with the highest margin!
        const PriceAndMargin = await PurchaseValidation.findMarginByID(
          product_code,
          sub_id,
          amount,
          finalPrice
        );
        // insert into table transaction & transaction_histories
        Logger.notice("trx::purchase", PriceAndMargin);
        const trans = new Transaction();
        const trans_hist = new TransactionHistory();
        //
        poin = poinConf === null ? 0 : poin ? poin : 0;
        const discount =
          poinConf === null
            ? 0
            : poin > 0
            ? parseFloat((poinConf.value / poinConf.poin) * poin)
            : 0;
        const updatedPrice = finalPrice - discount;
        //
        trans.id = trxid;
        trans.buyer_id = knownUser.id;
        trans.product_code = product_code;
        trans.target = target;
        trans.denom = amount;
        trans.reference = reference;
        trans.sub_id = sub_id ? sub_id : null;
        trans.recipient_phone = phone;
        //
        trans_hist.trx_id = trxid;
        //
        if (PriceAndMargin.length === 0) {
          // Product can't be found in the supplier catalog
          trans.remark =
            "Found in the product catalog, but can not be found in the supplier catalog";
          trans_hist.status = "FAILED";
          trans_hist.remark =
            "Found in the product catalog, but can not be found in the supplier catalog";
          await trans.save();
          await trans_hist.save();
          // event.fire to hash & telin;
        } else {
          // Product can be found in the supplier catalog
          trans.supply_id = PriceAndMargin[0].supplier_id;
          trans.sell_price = updatedPrice;
          trans.cost = PriceAndMargin[0].hbs;
          trans.margin_pre = PriceAndMargin[0].preMargin;
          trans.margin_post = PriceAndMargin[0].postMargin;
          trans.remark = label;
          // POIN
          trans.discount = discount;
          trans.poin = poin;
          //
          trans_hist.status = "QUOTE";
          trans_hist.data= {supplier: PriceAndMargin[0].supplier_code, cost: PriceAndMargin[0].hbs}
          await trans.save();
          await trans_hist.save();
          //
          const remark = poin > 0 ? `disc. ${Number(poin)} POIN` : "";
          //
          BalanceKeeper.deduct({
            userId: knownUser.id,
            amount: parseFloat(updatedPrice),
            remark: remark,
            trxRef: trans_hist.id
          });
          // event.fire
          await this.initJobToWorker({
            trans: trans,
            phone: phone
          });
        }
      }

      // delete cache redis transaction history
      if (await Cache.has("histov1_" + knownUser.id)) {
        await Cache.pull("histov1_" + knownUser.id);
      }
      if (await Cache.has("histov2_" + knownUser.id)) {
        await Cache.pull("histov2_" + knownUser.id);
      }
      if (await Cache.has("statement_" + knownUser.id)) {
        await Cache.pull("statement_" + knownUser.id);
      }
    } catch (e) {
      /// catch error
      Logger.warning("trx::purchase", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async billData(type, target, supplier_product_id) {
    // cek rate
    let rates = 3400;
    const currentRates = await Cache.get("rates_current");
    if (currentRates) {
      rates = currentRates;
    } else {
      const [{ data: dataKurs1 }, { data: dataKurs2 }] = await Promise.all([
        axios.get("https://api.exchangerate-api.com/v4/latest/MYR"),
        axios.get("https://api.exchangeratesapi.io/latest?base=MYR")
      ]);

      rates = dataKurs1
        ? Number(dataKurs1.rates.IDR)
        : dataKurs2
        ? Number(dataKurs2.rates.IDR)
        : await Cache.get("rates_old");

      if (dataKurs1 || dataKurs2) {
        await Promise.all([
          Cache.put(
            "rates_old",
            rates,
            moment()
              .endOf("month")
              .toISOString()
          ),
          Cache.put(
            "rates_current",
            rates,
            moment()
              .endOf("date")
              .toISOString()
          )
        ]);
      }
    }
    //
    const requestData = Object.assign(
      {
        product: type,
        target: target
      },
      supplier_product_id
    );
    // bill inquiry
    const { error, data } = await AlterraPlugin.inquiry(requestData);
    Logger.notice(
      "purchaseByIDWithPOINAndBill:Inquiry",
      error
        ? {
            error: error
          }
        : data
    );
    // calculated denom. BPJS: premi + 1200, where premi = amount - admin_charge
    const calculatedDenom =
      Number(data.amount) - Number(data.admin_charge) + 1200;
    // telin cost in MYR = round up dari calculatedDenom / 95% daily rates
    const telinCost = Math.ceil(calculatedDenom / (0.95 * rates));
    // dealer cost = telinCost + RM 2
    const dealerCost = telinCost + 2;

    return {
      error: error,
      data: data,
      dealerCost: dealerCost,
      telinCost: telinCost,
      rates: rates
    };
  }

  /**
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async history({ request, auth, response }) {
    const headers = request.headers();
    const version = headers["accept-version"] ? headers["accept-version"] : "1";
    if (["1", "2"].includes(version)) {
      switch (version) {
        case "1":
          await this.historyV1(request, response);
          break;

        case "2":
          await this.historyV2(request, response);
          break;
      }
    } else {
      response.send({
        status: "FAIL",
        error: "E990: Wrong version number!"
      });
    }
  }

  async historyV2(request, response) {
    // console.log('history version 2');
    try {
      const knownUser = request.buyerAccount;
      let { start, end, page, previous } = request.post();

      const validStart = moment(start, "YYYY-MM-DD")
        .startOf("day")
        .toISOString();
      const validEnd = moment(end, "YYYY-MM-DD")
        .endOf("day")
        .toISOString();
      // previous = moment(previous, "YYYY-MM-DD").endOf("day").toISOString();

      // check in redis
      let res_data = {};
      const sub_key_redis = validStart + validEnd + previous;
      if (await Cache.has("histov2_" + knownUser.id)) {
        const obj_cache = await Cache.get("histov2_" + knownUser.id);
        if (obj_cache[sub_key_redis]) {
          return response.send(obj_cache[sub_key_redis]);
        }
        res_data = obj_cache;
      }

      // const limit_res = 10;
      const trxLogs = previous
        ? await Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .whereRaw("created_at < ?", [previous])
            .with("histories", builder => {
              builder.orderBy("created_at", "asc");
            })
            .with("catalog")
            .orderBy("created_at", "desc")
            // .limit(limit_res)
            .fetch()
        : await Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .with("histories", builder => {
              builder.orderBy("created_at", "asc");
            })
            .with("catalog")
            .orderBy("created_at", "desc")
            // .offset(limit_res * (page || 0))
            // .limit(limit_res)
            .fetch();
      // console.log(trxLogs);
      /// if data exist
      let trxLogsObj = [];
      if (trxLogs) {
        trxLogsObj = trxLogs.toJSON().map(x => {
          x.histories = x.histories.pop() || {};
          const { pin: hPin, token: hToken, amount: hAmount } =
            x.histories.data || {};
          const { currency } = countryCurrencyMap(x.catalog.origin);
          return {
            id: x.id,
            product: x.product_code,
            origin: currency,
            target: x.target,
            denom: x.denom,
            price: x.sell_price,
            poin: x.poin,
            discount: x.discount,
            status: x.histories.status,
            rrp: x.reference,
            data: {
              pin: hPin,
              token: hToken,
              amount: hAmount
            },
            purchased_at: moment(x.created_at).toISOString(),
            updated_at: moment(x.histories.updated_at).toISOString()
          };
        });
      }

      /// only for sandbox
      if (this._sandboxEnv) {
        SandboxData.History().forEach(element => {
          trxLogsObj.push(element);
        });
      }
      let totalTransaction, sumRrp;
      if (previous) {
        [totalTransaction, sumRrp] = await Promise.all([
          Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .whereRaw("created_at < ?", [previous])
            .whereHas("histories", builder => {
              builder.where("status", "SUCCESS");
            })
            .getCount(),
          Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .whereRaw("created_at < ?", [previous])
            .getSum("reference")
        ]);
      } else {
        [totalTransaction, sumRrp] = await Promise.all([
          Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .whereHas("histories", builder => {
              builder.where("status", "SUCCESS");
            })
            .getCount(),
          Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .getSum("reference")
        ]);
      }
      res_data[sub_key_redis] = {
        status: "OK",
        sum_rrp: sumRrp || 0,
        total_success_transactions: totalTransaction,
        list: trxLogsObj
      };
      await Cache.put("histov2_" + knownUser.id, res_data, 1); //1 minutes
      response.send(res_data[sub_key_redis]);
    } catch (e) {
      /// catch error
      Logger.warning("trx::history", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async historyV1(request, response) {
    // console.log('history version 1');
    try {
      const knownUser = request.buyerAccount;
      const { start, end, page, previous } = request.post();

      const validEnd = moment(end, "YYYY-MM-DD")
        .endOf("day")
        .toISOString();
      const validStart = moment(end, "YYYY-MM-DD")
        .startOf("month")
        .toISOString();

      // check in redis
      let res_data = {};
      const sub_key_redis = validStart + validEnd + previous;
      if (await Cache.has("histov1_" + knownUser.id)) {
        const obj_cache = await Cache.get("histov1_" + knownUser.id);
        if (obj_cache[sub_key_redis]) {
          return response.send(obj_cache[sub_key_redis]);
        }
        res_data = obj_cache;
      }

      const trxLogs = previous
        ? await Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            .whereRaw("created_at < ?", [previous])
            // .whereRaw("DATE(created_at) <= ?", [end])
            .with("histories", builder => {
              builder.orderBy("created_at", "asc");
            })
            .with("catalog")
            .orderBy("created_at", "desc")
            .limit(10)
            .fetch()
        : await Transaction.query()
            .where("buyer_id", knownUser.id)
            .whereRaw("created_at >= ?", [validStart])
            .whereRaw("created_at <= ?", [validEnd])
            // .whereRaw("DATE(created_at) >= ?", [start])
            // .whereRaw("DATE(created_at) <= ?", [end])
            .with("histories", builder => {
              builder.orderBy("created_at", "asc");
            })
            .with("catalog")
            .orderBy("created_at", "desc")
            .offset(10 * (page || 0))
            .limit(10)
            .fetch();
      // console.log(trxLogs);
      /// if data exist
      let trxLogsObj = [];
      if (trxLogs) {
        trxLogsObj = trxLogs.toJSON().map(x => {
          x.histories = x.histories.pop() || {};
          const { pin: hPin, token: hToken, amount: hAmount } =
            x.histories.data || {};
          const { currency } = countryCurrencyMap(x.catalog.origin);
          return {
            id: x.id,
            product: x.product_code,
            origin: currency,
            target: x.target,
            denom: x.denom,
            price: x.sell_price,
            poin: x.poin,
            discount: x.discount,
            status: x.histories.status,
            rrp: x.reference,
            data: {
              pin: hPin,
              token: hToken,
              amount: hAmount
            },
            purchased_at: moment(x.created_at).toISOString(),
            updated_at: moment(x.histories.updated_at).toISOString()
          };
        });
      }

      /// only for sandbox
      if (this._sandboxEnv) {
        SandboxData.History().forEach(element => {
          trxLogsObj.push(element);
        });
      }

      res_data[sub_key_redis] = {
        status: "OK",
        data: trxLogsObj
      };
      await Cache.put("histov1_" + knownUser.id, res_data, 1); //1 minutes
      response.send(res_data[sub_key_redis]);
    } catch (e) {
      /// catch error
      Logger.warning("trx::history", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  /**
   *
   * @param {object} ctx
   * @param {Parameters} ctx.params
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async status({ params, request, response }) {
    //
    try {
      // fetch data
      const knownUser = await request.buyerAccount;
      const trxId = params.id;
      // check in redis
      if (await Cache.has(trxId)) {
        const obj_cache = await Cache.get(trxId);
        return response.send(obj_cache);
      }

      const trxData = await Transaction.query()
        .where("id", trxId)
        .andWhere("buyer_id", knownUser.id)
        .with("histories", builder => {
          builder.orderBy("created_at", "asc");
        })
        .with("catalog")
        .first();
      // throw if not exist
      if (!trxData) {
        return response.send({
          status: "FAIL",
          error: `E041: Transaction ID not available`
        });
      }

      const productDetail =
        trxData.sub_id === null
          ? await CatalogDetail.query()
              .where("product_code", trxData.product_code)
              .where(function() {
                this.where(function() {
                  this.where("denom", Number(trxData.denom)).whereNull("min");
                }).orWhere(function() {
                  this.where("min", "<=", Number(trxData.denom)).where(
                    "denom",
                    ">=",
                    Number(trxData.denom)
                  );
                });
              })
              .first()
          : await CatalogDetail.query()
              .where("product_code", trxData.product_code)
              .where("sub_id", trxData.sub_id)
              .where(function() {
                this.where(function() {
                  this.where("denom", Number(trxData.denom)).whereNull("min");
                }).orWhere(function() {
                  this.where("min", "<=", Number(trxData.denom)).where(
                    "denom",
                    ">=",
                    Number(trxData.denom)
                  );
                });
              })
              .first();
      // convert to JS Obj and take the last histories
      const jsonTrxData = trxData.toJSON();
      jsonTrxData.histories = jsonTrxData.histories.pop() || {};
      // console.log(jsonTrxData);
      const { pin: hPin, token: hToken, amount: hAmount, serialNo, data: dataPLN } =
        jsonTrxData.histories.data || {};
      const { currency } = countryCurrencyMap(jsonTrxData.catalog.origin);
      /// send back response
      let description = jsonTrxData.catalog.usage_description;
      if (jsonTrxData.histories.data && jsonTrxData.histories.data.description) {
        description = jsonTrxData.histories.data.description;
        if (jsonTrxData.histories.data.expiry_date)
          description +=
            " expiry on " + jsonTrxData.histories.data.expiry_date._text;
      }

      const res_data = {
        status: "OK",
        data: {
          id: jsonTrxData.id,
          product: jsonTrxData.product_code,
          productLabel:
            productDetail.label !== null
              ? productDetail.label
              : jsonTrxData.catalog.name,
          origin: currency,
          target: jsonTrxData.target,
          denom: jsonTrxData.denom,
          poin: jsonTrxData.poin,
          discount: jsonTrxData.discount,
          price: jsonTrxData.sell_price,
          rrp: jsonTrxData.reference,
          status: jsonTrxData.histories.status,
          data: {
            pin: hPin,
            token: hToken,
            amount: hAmount,
            voucher: serialNo,
            description: dataPLN ? dataPLN.info_text : "",
          },
          description: description,
          purchased_at: moment(jsonTrxData.created_at).toISOString(),
          updated_at: moment(jsonTrxData.histories.updated_at).toISOString()
        }
      };
      await Cache.add(jsonTrxData.id, res_data, 0.25); //15 seconds
      response.send(res_data);
    } catch (e) {
      /// catch error
      Logger.warning("trx::status", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`
      });
    }
  }

  async invokeEvent({ request, response }) {
    try {
      const { eventName, dataInJSON } = request.all();
      Event.fire(eventName, dataInJSON);
      response.send({
        status: true
      });
    } catch (error) {
      response.send({
        status: false,
        error: error
      });
    }
  }

  async initJobToWorker({ trans: trxData, phone: phone }) {
    const supplyDef = await Supply.find(trxData.supply_id);
    Event.fire("new::transaction", {
      trxId: trxData.id,
      supplier: supplyDef.supplier_code,
      phone: phone
    });
  }
}

module.exports = TransactionController;

function countryCurrencyMap(code) {
  if (code === "IDN") {
    return {
      country: "Indonesia",
      currency: "IDR"
    };
  } else if (code === "MYS") {
    return {
      country: "Malaysia",
      currency: "MYR"
    };
  } else if (code === "NPL") {
    return {
      country: "Nepal",
      currency: "NPR"
    };
  } else if (code === "BGD") {
    return {
      country: "Bangladesh",
      currency: "BDT"
    };
  } else if (code === "PHL") {
    return {
      country: "Philippines",
      currency: "PHP"
    };
  }
}

async function checkBillAmount(codeName, denom, finalPrice, target) {
  const {
    supplier_product_id,
    supplier_code
  } = (await PurchaseValidation.findMargin(codeName, denom, finalPrice))[0];

  let amount = 0;
  if (supplier_code === "FINNET") {
    const dataFinnet = await Finnet.billInquiry(
      Object.assign(
        {
          product: codeName,
          bill_number: target
        },
        supplier_product_id
      )
    );
    amount = dataFinnet.data.amount.replace(/^0+|\s/gm, "");
  }

  return amount;
}

async function MobilePrefixCheck(codeName, phone) {
  // prune number
  const pureNumber = phone.replace(/^(62)/gm, "0");
  const prefix = pureNumber.slice(0, 4);
  let pattern = [];
  switch (codeName) {
    case "TSEL":
      pattern = [
        "0811",
        "0812",
        "0813",
        "0821",
        "0822",
        "0823",
        "0851",
        "0852",
        "0853"
      ];
      break;
    case "TSELDATA":
      pattern = [
        "0811",
        "0812",
        "0813",
        "0821",
        "0822",
        "0823",
        "0851",
        "0852",
        "0853"
      ];
      break;
    case "AXIS":
      pattern = ["0831", "0832", "0833", "0838", "0859"];
      break;
    case "AXISDATA":
      pattern = ["0831", "0832", "0833", "0838", "0859"];
      break;
    case "INDOSATOOREDOO":
      pattern = ["0814", "0815", "0816", "0855", "0856", "0857", "0858"];
      break;
    case "ISATDATA":
      pattern = ["0814", "0815", "0816", "0855", "0856", "0857", "0858"];
      break;
    case "SMARTFREN":
      pattern = [
        "0881",
        "0882",
        "0883",
        "0884",
        "0885",
        "0886",
        "0887",
        "0888",
        "0889"
      ];
      break;
    case "SMARTFRENDATA":
      pattern = [
        "0881",
        "0882",
        "0883",
        "0884",
        "0885",
        "0886",
        "0887",
        "0888",
        "0889"
      ];
      break;
    case "TRI":
      pattern = ["0895", "0896", "0897", "0898", "0899"];
      break;
    case "TRIDATA":
      pattern = ["0895", "0896", "0897", "0898", "0899"];
      break;
    case "XL":
      pattern = ["0817", "0818", "0819", "0859", "0877", "0878", "0879"];
      break;
    case "XLDATA":
      pattern = ["0817", "0818", "0819", "0859", "0877", "0878", "0879"];
      break;
  }

  return pattern.includes(prefix) ? true : false;
}
