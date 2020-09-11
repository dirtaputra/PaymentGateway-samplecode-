"use strict";
const CatalogKeeper = use("App/Common/CatalogKeeper");
const moment = use("moment");
const Supply = use("App/Models/Supply");
const User = use("App/Models/User");
const CatalogDetails = use("App/Models/CatalogDetail");
const Catalogs = use("App/Models/Catalog");
const BK = use("App/Common/BalanceKeeper");
const JsonFind = require("json-find");
const Logger = use("Logger");
const serializeError = require("serialize-error");
const Database = use("Database");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const Catalog = use("App/Models/Catalog");
const BalanceKeeper = use("App/Common/BalanceKeeper");
const PurchaseValidation = use("App/Common/PurchaseValidation");
const AlterraPlugin = use("App/Common/Supplier/AlterraPlugin");
const Event = use("Event");
const Ajv = require("ajv");
const Env = use("Env");
const Cache = use("Cache");
const axios = require("axios");
const millify = require("millify");
const ajv = new Ajv({
  allErrors: true
});
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
const B2BStub = use("App/Common/Supplier/B2BStub");
class BizzController {
  async balance({
    request,
    response,
    auth,
    params
  }) {
    try {
      const knownUser = request.buyerAccount;
      const balance = await BK.balance(knownUser.id);
      response.send({
        balance: Number(balance || "0.00").toFixed(2)
      });
    } catch (e) {
      Logger.warning("bizz::balance", serializeError(e));
      response.send({
        response_code: "99",
        message: `other error`
      });
    }
  }

  async product({
    request,
    response,
    params
  }) {
    try {
      const knownUser = request.buyerAccount;
      console.log(knownUser.is_partner);
      const listProduct = await CatalogDetails.query()
        .where("b2b", "?", knownUser.is_partner)
        .fetch();
      const page = request.all().page || 0;
      const pageNum = parseInt(page);
      const code = request.all().code;
      console.log(code);
      const listOfProduct = code ?
        await CatalogDetails.query()
        .with("catalog")
        .with("supply")
        .where("b2b", "?", knownUser.is_partner)
        .where("product_code", code)
        .where("status", "ENABLE")
        .whereHas("supply", builder => {
          builder.whereNotNull("product_code");
        })
        .orderBy("product_code", "asc")
        .orderBy("denom", "asc")
        .offset(25 * (page || 0))
        .limit(25)
        .fetch() :
        await CatalogDetails.query()
        .with("catalog")
        .with("supply")
        .where("b2b", "?", knownUser.is_partner)
        .where("status", "ENABLE")
        .whereHas("supply", builder => {
          builder.whereNotNull("product_code");
        })
        .orderBy("product_code", "asc")
        .orderBy("denom", "asc")
        .offset(25 * (page || 0))
        .limit(25)
        .fetch();
      const kurs1 = await axios.get("https://api.exchangerate-api.com/v4/latest/MYR");
      console.log("kurs: " + kurs1.data.rates.IDR)
      const remapedList = listOfProduct.toJSON().map(el => {
        //console.log(el.catalogdetail[0].b2b.knownUser.is_partner);
        const key = knownUser.is_partner;
        const partner = el.b2b[key];
        console.log(partner);
        // const price =
        //   partner.type === "PERCENT" ?
        //   (parseFloat(partner.value) / 100) * el.reference :
        //   partner.value;
        let price;
        let kurs = 3400;
        let denom;
        if (!partner.min) {
          price =
            partner.type === "PERCENT" ?
            (parseFloat(partner.value) / 100) * el.reference :
            partner.value;
          price = parseFloat(price).toFixed(2);
          denom = el.denom
        } else {
          let min, max;
          min = (parseFloat(partner.value) / 100) * el.min;
          max = (parseFloat(partner.value) / 100) * el.denom;
          max = max / kurs1.data.rates.IDR;
          price = `${min.toFixed(2)} - ${(max + parseFloat(2)).toFixed(2)}`;
          denom = `${el.min} - ${el.denom}`;
        }
        let rrp;
        if (partner.min) {
          let denomTmp = parseFloat(el.denom) / kurs1.data.rates.IDR;
          rrp = `${el.min} - ${(denomTmp + parseFloat(4)).toFixed(2)}`;
        } else {
          rrp = el.reference;
        }
        const {
          country,
          currency
        } = countryCurrencyMap(el.catalog.origin);
        let b2bUser = knownUser.is_partner;
        // console.log("user :" + el.b2b[b2bUser].type)
        //margin type
        let margin;
        if (el.supply.category === "PREDEFINED") {
          margin = "2";
        } else if (
          el.supply.category === "BILL" &&
          el.supply.min_denom !== null
        ) {
          margin =
            parseFloat(el.min) - (parseFloat(partner.value) / 100) * el.min;
          margin = parseFloat(margin).toFixed(2);
        } else {
          if (el.b2b[b2bUser].type === "ABSOLUTE") {
            margin = (rrp - parseFloat(el.b2b[b2bUser].value)).toFixed(2);
          } else if (el.b2b[b2bUser].type === "PERCENT") {
            margin = (
              rrp -
              rrp * (parseFloat(el.b2b[b2bUser].value) / 100)
            ).toFixed(2);
            margin = (margin / rrp) * 100;
          }
        }
        //el.b2b[b2bUser].type === "ABSOLUTE" ? (rrp - parseFloat(el.b2b[b2bUser].value)).toFixed(2) : el.b2b[b2bUser].type === "PERCENT" ? (rrp - (rrp * (parseFloat(el.b2b[b2bUser].value) / 100))).toFixed(2) : el.supply.category === "PREDEFINED" ? 2 : '',
        return {
          code: el.product_code,
          codeName: el.catalog.name,
          item_id: `${el.product_code}:${el.sub_id}`,
          category: el.supply.category,
          country: country,
          name: el.label || "-",
          description: el.catalog.description,
          denomination: denom,
          denom: denom,
          price: price,
          rrp: rrp,
          margin_type: el.b2b[b2bUser].type,
          margin: margin,
          inquiry_first: el.product_code === "PLN" ||
            el.product_code === "PLNBILL" ||
            el.product_code === "BPJS" ?
            true : false,
          available: el.status === "ENABLE" ? true : false
        };
      });
      const app_url = Env.get("APP_URL");
      const home = parseInt(pageNum - 1);
      let prevVal;
      if (home < 0) {
        prevVal = 0;
      } else {
        prevVal = parseInt(pageNum - 1);
      }
      response.send({
        next: `${app_url}/biz/product?page=` + parseInt(pageNum + 1),
        prev: `${app_url}/biz/product?page=` + prevVal,
        data: remapedList
      });
    } catch (e) {
      Logger.warning("bizz::product", serializeError(e));
      response.send({
        response_code: "99",
        message: "other error"
      });
    }
  }

  async productDetail({
    request,
    response,
    params
  }) {
    try {
      const knownUser = request.buyerAccount;
      console.log(knownUser.is_partner);
      const x = await CatalogDetails.query()
        .where("b2b", "?", knownUser.is_partner)
        .where("product_code", params.code)
        .fetch();
      const listOfProduct = await Supply.query()
        .with("catalog")
        .with("catalogdetail")
        .whereHas("catalogdetail", builder => {
          builder.where("b2b", "?", knownUser.is_partner);
          builder.where("product_code", params.code);
        })
        .where("status", "ENABLE")
        .orderBy("category", "desc")
        .orderBy("product_code", "asc")
        .fetch();
      const remapedList = listOfProduct.toJSON().map(el => {
        //console.log(el.catalogdetail[0].b2b.knownUser.is_partner);
        const key = knownUser.is_partner;
        const partner = el.catalogdetail[0].b2b[key];
        const price =
          partner.type === "PERCENT" ?
          (parseFloat(partner.value) / 100) * el.reference :
          partner.value;
        const {
          country,
          currency
        } = countryCurrencyMap(el.catalog.origin);

        return {
          code: el.product_code,
          item_id: `${el.product_code}:${el.sub_id}`,
          category: el.category,
          country: country,
          name: el.catalog.name,
          description: el.catalog.description,
          denomination: el.denom,
          denom: el.denom,
          price: price,
          rrp: el.reference,
          inquiry_first: el.product_code === "PLN" ? true : false,
          available: el.status === "ENABLE" ? true : false
        };
      });
      response.send({
        data: remapedList
      });
    } catch (e) {
      Logger.warning("bizz::product_detail", serializeError(e));
      response.send({
        response_code: "99",
        message: "other error"
      });
    }
  }

  async transactionDetail({
    response,
    request,
    params
  }) {
    try {
      // fetch data
      const knownUser = await request.buyerAccount;
      const trxId = params.id;
      const trxData = await Transaction.query()
        .where("id", trxId)
        .andWhere("buyer_id", knownUser.id)
        .with("histories", builder => {
          builder.orderBy("created_at", "asc");
        })
        .with("catalog.catalogDetail")
        .first();
      console.log(trxData);
      // throw if not exist
      if (!trxData) {
        return response.send({
          response_code: "32",
          message: `transaction ID not found`
        });
      }
      // convert to JS Obj and take the last histories
      const jsonTrxData = trxData.toJSON();
      jsonTrxData.histories = jsonTrxData.histories.pop() || {};
      console.log(jsonTrxData);
      const {
        pin: hPin,
        token: hToken,
        amount: hAmount
      } =
      jsonTrxData.histories.data || {};
      const {
        currency,
        country
      } = countryCurrencyMap(
        jsonTrxData.catalog.origin
      );
      const status = jsonTrxData.histories.status;
      const historiesData = await TransactionHistory.query()
        .where("trx_id", trxId)
        .orderBy("created_at", "desc")
        .first();
      if (historiesData.status === "SUCCESS") {
        let pin;
        if (jsonTrxData.product_code === "PLN") {
          pin = jsonTrxData.histories.data.token;
        } else if (
          jsonTrxData.product_code === "ALFAMART" ||
          jsonTrxData.product_code === "INDOMART"
        ) {
          pin = jsonTrxData.histories.data.serialNo;
        } else {
          pin = jsonTrxData.histories.data.pin;
        }
        const found =
          jsonTrxData.catalog.catalogDetail.find(
            o =>
            o.product_code === jsonTrxData.product_code &&
            o.sub_id === jsonTrxData.sub_id &&
            o.denom === jsonTrxData.denom
          ) || false;
        const categoryData = await Supply.query()
          .where("product_code", jsonTrxData.product_code)
          .first();
        console.log("kategori :" + categoryData.category);
        /// send back response
        response.send({
          trx_id: jsonTrxData.id,
          response_code: status === "SUCCESS" ?
            "00" : status === "PENDING" ?
            "01" : status === "FAILED" ?
            "02" : status === "QUOTE" ?
            "01" : "99",
          message: status.toLowerCase() === "quote" ? "pending" : status.toLowerCase(),
          token_pin: pin,
          order_time: moment(jsonTrxData.created_at).toISOString(),
          update_time: moment(jsonTrxData.histories.updated_at).toISOString(),
          product: {
            code: jsonTrxData.product_code,
            codeName: jsonTrxData.catalog.name,
            item_id: `${jsonTrxData.product_code}:${jsonTrxData.sub_id}`,
            category: categoryData.category,
            country: country,
            name: found.label || "-",
            description: jsonTrxData.catalog.description,
            denomination: jsonTrxData.denom,
            denom: jsonTrxData.denom,
            price: jsonTrxData.sell_price,
            rrp: jsonTrxData.reference,
            available: true
          }
        });
      } else {
        const found =
          jsonTrxData.catalog.catalogDetail.find(
            o =>
            o.product_code === jsonTrxData.product_code &&
            o.sub_id === jsonTrxData.sub_id &&
            o.denom === jsonTrxData.denom
          ) || false;
        const categoryData = await Supply.query()
          .where("product_code", jsonTrxData.product_code)
          .first();
        /// send back response
        response.send({
          trx_id: jsonTrxData.id,
          response_code: status === "SUCCESS" ?
            "00" : status === "PENDING" ?
            "01" : status === "FAILED" ?
            "02" : status === "QUOTE" ?
            "01" : "99",
          message: status.toLowerCase() === "quote" ? "pending" : status.toLowerCase(),
          token_pin: "",
          order_time: moment(jsonTrxData.created_at).toISOString(),
          update_time: moment(jsonTrxData.histories.updated_at).toISOString(),
          product: {
            code: jsonTrxData.product_code,
            codeName: jsonTrxData.catalog.name,
            item_id: `${jsonTrxData.product_code}:${jsonTrxData.sub_id}`,
            category: categoryData.category,
            country: country,
            name: found.label || "-",
            description: jsonTrxData.catalog.description,
            denomination: jsonTrxData.denom,
            denom: jsonTrxData.denom,
            price: jsonTrxData.sell_price,
            rrp: jsonTrxData.reference,
            available: true
          }
        });
      }
    } catch (e) {
      Logger.warning("bizz::transaction_detail", serializeError(e));
      response.send({
        response_code: "99",
        message: `other error`
      });
    }
  }

  async transactionList({
    params,
    request,
    response
  }) {
    try {
      const knownUser = await request.buyerAccount;
      const page = request.all().page || 0;
      const pageNum = parseInt(page);
      const target = request.all().target;
      const order_id = request.all().order_id;
      const trxLogs = order_id ?
        await Transaction.query()
        .where("buyer_id", knownUser.id)
        .with("histories", builder => {
          builder.orderBy("created_at", "asc");
        })
        .with("catalog.catalogDetail")
        .where("order_id", order_id)
        .orderBy("created_at", "desc")
        .offset(25 * (page || 0))
        .limit(25)
        .fetch() :
        target ?
        await Transaction.query()
        .where("buyer_id", knownUser.id)
        .with("histories", builder => {
          builder.orderBy("created_at", "asc");
        })
        .with("catalog.catalogDetail")
        .where("target", target)
        .orderBy("created_at", "desc")
        .offset(25 * (page || 0))
        .limit(25)
        .fetch() :
        await Transaction.query()
        .where("buyer_id", knownUser.id)
        .with("histories", builder => {
          builder.orderBy("created_at", "asc");
        })
        .with("catalog.catalogDetail")
        .orderBy("created_at", "desc")
        .offset(25 * (page || 0))
        .limit(25)
        .fetch();
      // console.log(trxLogs);
      /// if data exist
      let trxLogsObj = [];
      if (trxLogs) {
        trxLogsObj = trxLogs.toJSON().map(x => {
          x.histories = x.histories.pop() || {};
          const {
            pin: hPin,
            token: hToken,
            amount: hAmount
          } =
          x.histories.data || {};
          const {
            currency,
            country
          } = countryCurrencyMap(x.catalog.origin);
          const found =
            x.catalog.catalogDetail.find(
              o =>
              o.product_code === x.product_code &&
              o.sub_id === x.sub_id &&
              o.denom === x.denom
            ) || false;
          //console.log(x.histories.data.pin)
          return {
            trx_id: x.id,
            response_code: x.histories.status === "SUCCESS" ?
              "00" : x.histories.status === "PENDING" ?
              "01" : x.histories.status === "FAILED" ?
              "02" : x.histories.status === "QUOTE" ?
              "01" : "99",
            message: x.histories.status.toLowerCase() === "quote" ?
              "pending" : x.histories.status.toLowerCase(),
            token_pin: x.product_code === "PLN" ?
              x.histories.data.token : x.product_code === "ALFAMART" || x.product_code === "INDOMART" ?
              x.histories.data.serialNo : x.product_code === "DIGIPIN" ?
              x.histories.data.pin : "",
            order_time: moment(x.created_at).toISOString(),
            update_time: moment(x.histories.updated_at).toISOString(),
            product: {
              code: x.product_code,
              codeName: x.catalog.name,
              item_id: `${x.product_code}:${x.sub_id}`,
              category: x.product_code === "PLN" ?
                "PIN" : x.product_code === "ALFAMART" ?
                "PIN" : x.product_code === "PLNBILL" ?
                "PREDEFINED" : "ELOAD",
              country: country,
              name: found.label || "-",
              description: x.catalog.description,
              denomination: x.denom,
              denom: x.denom,
              price: x.sell_price,
              rrp: x.reference,
              available: true
            }
          };
        });
      }
      const app_url = Env.get("APP_URL");
      const home = parseInt(pageNum - 1);
      let prevVal;
      if (home < 0) {
        prevVal = 0;
      } else {
        prevVal = parseInt(pageNum - 1);
      }
      response.send({
        next: `${app_url}/biz/transaction?page=` + parseInt(pageNum + 1),
        prev: `${app_url}/biz/transaction?page=` + prevVal,
        data: trxLogsObj
      });
    } catch (e) {
      Logger.warning("bizz::transaction_list", serializeError(e));
      response.send({
        response_code: "99",
        message: "other error"
      });
    }
  }
  async deposit({
    request,
    response,
    params
  }) {
    try {
      const knownUser = request.buyerAccount;
      response.send({
        biller_code: "6576254",
        ref_1: "56325468"
      });
    } catch (e) {
      Logger.warning("bizz::deposit", serializeError(e));
      response.send({
        response_code: "99",
        message: "other error"
      });
    }
  }

  async purchase({
    response,
    request,
    params
  }) {
    try {
      const knownUser = request.buyerAccount;
      let {
        order_id,
        item_id,
        target,
        poin,
        phone,
        recipient,
        amount
      } = request.post();
      const splittedID = item_id.split(":");
      const product_code = splittedID[0];
      const sub_id = splittedID[1];
      const codeName = product_code.toUpperCase();
      const supDef = await Supply.findBy("product_code", product_code);
      const category = supDef.category;
      const [balance, sellingPrice, supplyDef] = await Promise.all([
        BalanceKeeper.balance(knownUser.id),
        PurchaseValidation.sellingPriceByID(product_code, sub_id, amount),
        Supply.findBy("product_code", codeName)
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
      const productDetails = await Catalogs.findBy("code", codeName);
      const {
        country
      } = countryCurrencyMap(productDetails.origin);
      if (category === "PREDEFINED") {
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
          poinConf === null ?
          0 :
          poin > 0 ?
          parseFloat((poinConf.value / poinConf.poin) * poin) :
          0;
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
                response_code: "23",
                message: "product is temporarily not available"
              });
            } else {
              return response.send({
                response_code: "21",
                message: "product not exist"
              });
            }
          } else {
            return response.send({
              response_code: "21",
              message: `product not exist`
            });
          }
        } else {
          // check balance
          if (Number(balance) < Number(updatedPrice)) {
            return response.send({
              response_code: "25",
              message: "insufficient balance"
            });
          }
          // generate trxId
          const trxid = CatalogKeeper.generateTrxId();
          // buyer with a sufficient balance. Send OK to buyer.
          response.send({
            trx_id: trxid,
            response_code: "01",
            message: "pending",
            // order_time: moment().toISOString(),
            // update_time: moment(updated_at).toISOString(),
            product: {
              code: product_code,
              item_id: item_id,
              category: supDef.category,
              country: country,
              name: productDetails.name,
              description: productDetails.description,
              denomination: Number(data.amount) - Number(data.admin_charge),
              price: telinCost + 2,
              rrp: telinCost + 4,
              available: true
            }
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
          trans.order_id = order_id;
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
        //check validator
        const productDetails = await Catalog.findBy(
          "code",
          product_code.toUpperCase()
        );
        //const orderId = await Transaction.findBy("order_id", order_id);
        const orderId = await Transaction.query()
          .where("buyer_id", knownUser.id)
          .where("order_id", order_id)
          .first();
        const schema =
          productDetails.toJSON().validator === null ?
          null :
          productDetails.toJSON().validator;
        if (orderId !== null) {
          return response.send({
            response_code: "24",
            message: "duplicate order_id"
          });
        }
        if (schema !== null) {
          const validate = ajv.compile(schema);
          if (
            !validate({
              phone: recipient
            })
          ) {
            // missing phone
            return response.send({
              response_code: "22",
              message: "Missing recipient number"
            });
          } else if (recipient === null) {
            return response.send({
              response_code: "22",
              message: "Missing recipient number"
            });
          }
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
              response_code: "20",
              info: "Invalid number for this operator!"
            });
          }
        }
        recipient = recipient ? recipient : null;
        const [balance, sellingPrice] = await Promise.all([
          BalanceKeeper.balance(knownUser.id),
          PurchaseValidation.sellingPriceB2B(
            product_code,
            sub_id,
            amount,
            knownUser.is_partner
          )
        ]);

        // check PLN prepaid
        const valid_denoms = amount;
        if (["PLN"].includes(codeName)) {
          const supDef =
            (await Supply.query()
              .where("product_code", codeName)
              .where(function () {
                this.where(function () {
                  this.where("denom", valid_denoms).whereNull("min_denom");
                }).orWhere(function () {
                  this.where("min_denom", "<=", valid_denoms).where(
                    "denom",
                    ">=",
                    valid_denoms
                  );
                });
              })
              .fetch()).first() || null;
          if (supDef) {
            const requestData = Object.assign({
                product: supDef.toJSON().supplier_product_id.type,
                target: target
              },
              supDef.toJSON().supplier_product_id
            );
            // do an inquiry.
            const {
              data
            } = await AlterraPlugin.inquiry(requestData);
            Logger.info("inquiryB2B:PLN", data);
            if (
              ["20", "21", "24", "25", "99"].includes(data.response_code) ||
              data.error
            ) {
              return response.send({
                response_code: "20",
                message: rc_desc_alterra[data.response_code] ||
                  "target is invalid / expired / blocked"
              });
            }
          } else {
            return response.send({
              response_code: "21",
              message: "product not exist"
            });
          }
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
            response_code: "21",
            message: "product not exist"
          });
        }
        // check balance
        if (Number(balance) < Number(finalPrice)) {
          return response.send({
            response_code: "25",
            message: "Insufficient balance!"
          });
        }
        const checkData = await Supply.query()
          .where("product_code", product_code)
          .first();
        const supplyData = checkData.min_denom ?
          await Supply.query()
          .where("product_code", product_code)
          .first() :
          await Supply.query()
          .where("product_code", product_code)
          .where("denom", amount)
          .first();
        const {
          country
        } = countryCurrencyMap(productDetails.origin);
        // generate trxId
        const trxid = CatalogKeeper.generateTrxId();
        // buyer with a sufficient balance. Send OK to buyer.
        console.log("tmp : " + product_code);
        response.send({
          trx_id: trxid,
          response_code: "01",
          message: "pending",
          // order_time: moment().toISOString(),
          // update_time: moment(updated_at).toISOString(),
          product: {
            code: product_code,
            item_id: item_id,
            category: supplyData.category,
            country: country,
            name: productDetails.name,
            description: productDetails.description,
            denomination: parseFloat(amount).toFixed(2),
            denom: parseFloat(amount).toFixed(2),
            price: finalPrice,
            rrp: reference,
            available: true
          }
        });

        // find supplier with the highest margin!
        const PriceAndMargin = await PurchaseValidation.findMarginByID(
          product_code,
          sub_id,
          amount,
          finalPrice
        );
        // insert into table transaction & transaction_histories
        Logger.notice("trx::purchaseB2B", PriceAndMargin);
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
          trans.recipient_phone = recipient;
          trans.sub_id = sub_id ? sub_id : null;
          trans.order_id = order_id;
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
          trans.recipient_phone = recipient;
          trans.remark = label;
          trans.order_id = order_id;
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
            phone: recipient
          });
        }
      }
    } catch (e) {
      Logger.warning("trx::purchaseB2B", serializeError(e));
      console.log("error :" + e);
      response.send({
        response_code: "99",
        message: `other error`
      });
    }
  }

  async inquiry({
    response,
    request,
    params
  }) {
    try {
      const {
        item_id,
        code,
        target,
        denom
      } = request.post();
      console.log(denom);
      //const splittedID = item_id.split(":");
      const product = code;
      //const sub_id = splittedID[1];
      //const denom = splittedID[2];
      const codeName = product.toUpperCase();
      const serve = Env.get("NODE_ENV");
      const tmpData = await Supply.findBy("product_code", codeName);
      console.log("code :" + tmpData.category);
      // check PLN prepaid
      //const valid_denoms = denom;
      if (codeName === "PLN") {
        const supDef =
          (await Supply.query()
            .where("product_code", code)
            .fetch()).first() || null;
        if (supDef) {
          const requestData = Object.assign({
              product: supDef.toJSON().supplier_product_id.type,
              target: target
            },
            supDef.toJSON().supplier_product_id
          );
          console.log(supDef);
          // do an inquiry.
          const {
            data
          } = await AlterraPlugin.inquiry(requestData);
          Logger.info("inquiryB2B:PLN", data);
          if (
            ["20", "23", "21", "24", "25", "99"].includes(data.response_code) ||
            data.error
          ) {
            return response.send({
              response_code: "20",
              message: "target is invalid / expired / blocked"
            });
          } else {
            return response.send({
              response_code: "00",
              message: "success",
              customer_id: target,
              bill_amount: "0.00",
              available: true,
              customer_data: {
                name: serve !== "production" ? "sewati" : data.subscriber_name,
                reference_no: data.pln_refno,
                power: data.power,
                segmentation: data.subscriber_segmentation
              }
            });
          }
        } else {
          return response.send({
            response_code: "21",
            message: "product is not exist"
          });
        }
      } else if (tmpData.category === "PREDEFINED") {
        if (!codeName) {
          return response.send({
            response_code: "99",
            message: `other error`
          });
        }
        // check bill number
        if (!target) {
          return response.send({
            response_code: "31",
            message: `invalid inquiry`
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
            response_code: "21",
            message: "product not exist"
          });
        }
        // get bill amount
        const supDef =
          (await Supply.query()
            .where("product_code", codeName)
            .fetch()).first() || null;
        if (supDef) {
          // do an inquiry.
          const {
            error,
            telinCost,
            data
          } = await this.billData(
            supDef.supplier_product_id.type,
            target,
            supDef.supplier_product_id
          );
          Logger.info(
            "inquiryFinalBill",
            error ? {
              error: error
            } :
            data
          );
          if (error) {
            return response.send({
              response_code: "99",
              message: "other error"
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
              response_code: data.response_code,
              message: rc_desc_alterra[data.response_code]
            });
          }

          if (data.error) {
            if (data.error.includes(450)) {
              return response.send({
                response_code: "23",
                message: "product is temporarily not available"
              });
            } else if (data.error.includes(406)) {
              return response.send({
                response_code: "406",
                message: "Invalid subscription number"
              });
            } else {
              return response.send({
                response_code: "21",
                message: "Product not exist"
              });
            }
          }
          // map customer data
          info = data.power ?
            (info = `${data.subscriber_name} (${data.subscriber_segmentation}) ${data.power}va, ${data.bill_status} mo`) :
            data.name;
          //
          const {
            currency
          } = countryCurrencyMap(catalogObj.origin);
          //
          // response.send({
          //   status: "OK",
          //   data: {
          //     itemID: `${codeName}:${supDef.sub_id}:${millify(
          //     Number(data.amount) - Number(data.admin_charge)
          //   )}`,
          //     info: info,
          //     currency,
          //     denom: Number(data.amount) - Number(data.admin_charge),
          //     price: telinCost + 2,
          //     rrp: telinCost + 4,
          //     prefix: catalogObj.prefix,
          //     label: "",
          //     poin: 0
          //   }
          // });
          let name;
          if (codeName === "BPJS") {
            name = data.name
          } else {
            name = data.subscriber_name
          }
          return response.send({
            response_code: "00",
            message: "success",
            customer_id: target,
            bill_amount: (telinCost + 2).toFixed(2),
            bill_amount_origin: (
              parseFloat(data.amount) - parseFloat(data.admin_charge)
            ).toFixed(2),
            available: true,
            customer_data: {
              name: name,
              reference_no: data.pln_refno,
              power: data.power,
              segmentation: data.subscriber_segmentation
            }
          });
        } else {
          return response.send({
            response_code: "21",
            message: "product is not exist"
          });
        }
      } else {
        return response.send({
          response_code: "31",
          message: "invalid inquiry"
        });
      }
    } catch (e) {
      Logger.warning("trx::inquiryB2B", serializeError(e));
      response.send({
        response_code: "99",
        message: "other error"
      });
    }
  }

  async invokeEvent({
    request,
    response
  }) {
    try {
      const {
        eventName,
        dataInJSON
      } = request.all();
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

  async initJobToWorker({
    trans: trxData,
    phone: phone
  }) {
    const supplyDef = await Supply.find(trxData.supply_id);
    Event.fire("new::transaction", {
      trxId: trxData.id,
      supplier: supplyDef.supplier_code,
      phone: phone
    });
  }

  async billData(type, target, supplier_product_id) {
    let rates = 3400;
    const currentRates = await Cache.get("rates_current");
    if (currentRates) {
      rates = currentRates;
    } else {
      const [{
        data: dataKurs1
      }, {
        data: dataKurs2
      }] = await Promise.all([
        axios.get("https://api.exchangerate-api.com/v4/latest/MYR"),
        axios.get("https://api.exchangeratesapi.io/latest?base=MYR")
      ]);

      rates = dataKurs1 ?
        Number(dataKurs1.rates.IDR) :
        dataKurs2 ?
        Number(dataKurs2.rates.IDR) :
        await Cache.get("rates_old");

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
    const requestData = Object.assign({
        product: type,
        target: target
      },
      supplier_product_id
    );
    // bill inquiry
    const {
      error,
      data
    } = await AlterraPlugin.inquiry(requestData);
    Logger.notice(
      "purchaseByIDWithPOINAndBill:Inquiry",
      error ? {
        error: error
      } :
      data
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
}

module.exports = BizzController;

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
