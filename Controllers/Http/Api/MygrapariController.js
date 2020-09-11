"use strict";

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const User = use("App/Models/UserApi");
const Users = use("App/Models/User");
const Logger = use("Logger");
const Env = use("Env");
const PurchaseValidation = use("App/Common/PurchaseValidation");
const MygpGateway = use("App/Common/MygrapariGateway");
const CatalogKeeper = use("App/Common/CatalogKeeper");
const PayGateway = use("App/Common/PaymentGatewayPlugin");
const Transaction = use("App/Models/Transaction");
const TransactionHistory = use("App/Models/TransactionHistory");
const moment = require("moment");
const numeral = require("numeral");
const btoa = require("btoa");
const Mail = use("Mail");
const Encryption = use("Encryption");
const atob = use("atob");
const Event = use("Event");
const Cache = use("Cache");
const DepositLog = use("App/Models/DepositLog");
const Database = use("Database");
const Token = use("App/Models/Token");
const cdigit = require('cdigit');
const randomize = require('randomatic');
/**
 * Resourceful controller for interacting with mygraparis
 */
class MygrapariController {
  /**
   *
   */
  async wrapAuthValidate(_auth, method, email, password) {
    try {
      const userRecord = await _auth.authenticator(method).validate(email, password, true);
      return userRecord;
    } catch (e) {
      return null;
    }
  }

  /**
   *
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   * @param {Auth} ctx.auth
   */
  async login({
    request,
    response,
    auth
  }) {
    const {
      email: normalEmail,
      password,
      msisdn
    } = request.only(["email", "password", "msisdn"]);
    // let tokenData = null;
    // let userInRpg = null;
    const email = normalEmail ? normalEmail.toLowerCase() : null;
    try {
      if (email) {
        /// email
        let [userExistWithEmail, userWithAuth, userInCrm] = await Promise.all([
          // auth.authenticator("api").validate(email, password, true),
          User.findBy("email", email),
          this.wrapAuthValidate(auth, "api", email, password),
          MygpGateway.queryAccount(email, password)
        ]);
        Logger.info("login with email", {
          userExistWithEmail,
          userWithAuth,
          userInCrm
        });
        if (!userExistWithEmail && userInCrm.access_token) {
          //// user not exist in Database, but exist in CRM ---> CREATE
          userWithAuth = await User.create({
            email,
            password,
            fullname: userInCrm.name,
            is_dealer: true
          });
          await auth.authenticator("api").generate(userWithAuth);
          userExistWithEmail = userWithAuth; ///same object
        } else if (userExistWithEmail && !userWithAuth && userInCrm.access_token) {
          /// user ada di DB dan ada di CRM, tapi auth di RPG fail ---> UPDATE
          userExistWithEmail.fullname = userInCrm.name;
          userExistWithEmail.password = password;
          userExistWithEmail.is_dealer = true;
          await userExistWithEmail.save();
        } else if (!userWithAuth) {
          //// exist dan auth gagal.. dan CRM tidak ada ---> REJECT
          if(userExistWithEmail) throw new Error("Invalid password");
          else throw new Error("Account not found");
        }
        ///
        // get base64 token
        const token = await this.base64Token(auth, userExistWithEmail);
        response.send({
          status: "OK",
          as2in1: userInCrm,
          email: userWithAuth.email || userExistWithEmail.email,
          name: userWithAuth.fullname || userExistWithEmail.fullname,
          token: token
        });
      } else {
        /// msisdn
        const [userExistWithMsisdn, userInRpg] = await Promise.all([
          User.findBy("msisdn", msisdn),
          this.wrapAuthValidate(auth, "api2", msisdn, password)
        ])
        if (!userInRpg) {
          /// jika msisdn tidak ditemukan
          if(userExistWithMsisdn) throw new Error("Invalid password");
          else throw new Error("Account not found");
        }
        let gwData = null;
        if (userInRpg.is_dealer === true && userInRpg.email) {
          /// query gwdata jika status dealer dan punya email
          gwData = await MygpGateway.queryAccount(userInRpg.email, password);
        }
        // get base64 token
        const token = await this.base64Token(auth, userInRpg);
        response.send({
          status: "OK",
          as2in1: gwData,
          email: userInRpg.email,
          name: userInRpg.fullname,
          token: token
        });
      }
    } catch (e) {
      // token not found
      Logger.warning(`${email} ==> ` + e.message);
      response.send({
        status: "FAIL",
        error: `E021: ${e.message}`
      });
    }
  }

  async base64Token(_auth, userObj) {
    const tokenData = await _auth.authenticator("api2").listTokensForUser(userObj);
    const plainToken = Encryption.decrypt(tokenData[0].token);
    return btoa(plainToken);
  }

  /**
   *
   *
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async directPurchase({
    request,
    response
  }) {
    //
    const knownUser = request.buyerAccount;
    const trxId = CatalogKeeper.generateTrxId();
    let {
      target,
      amount,
      method,
      redirect
    } = request.post();

    ///
    const inputData = {
      AMOUNT: amount,
      PAYMENT_METHOD: method.toUpperCase(), // DC,CC,FPX, ALL
      REDIRECT_URL: redirect || "",
      CALLBACK_URL: Env.get("PG_CALLBACK_URL") // optional
    };
    // query payment Window
    const payGwResult = await PayGateway.generateTW(inputData);
    if (payGwResult.error || payGwResult.response_code != "ss") {
      return response.send({
        status: "FAIL",
        error: `E061: ${payGwResult.error || payGwResult.response_detail}`
      });
    }
    // Purchase Data
    // define product
    const product = target.startsWith("62") ? "TSEL" : "AS2IN1";
    // OBTAIN status, error, finalPrice, postMargin
    const sellPriceMargin = await PurchaseValidation.sellingPrice(product, amount);
    if (sellPriceMargin.error) {
      return response.send({
        status: "FAIL",
        error: `E032: ${sellPriceMargin.error}`
      });
    }
    // set amount/denom = valid_denom
    amount = sellPriceMargin.valid_denom;
    // OBTAIN array of supplier
    const SupplierMarginPrices = await PurchaseValidation.findMargin(
      product,
      amount,
      sellPriceMargin.finalPrice
    );
    if (SupplierMarginPrices.length === 0) {
      return response.send({
        status: "FAIL",
        error: `E033: Product is not available for transaction`
      });
    }
    ///
    const newTrx = await Transaction.create({
      id: trxId,
      buyer_id: knownUser.id,
      supply_id: SupplierMarginPrices[0].supplier_id,
      product_code: product,
      target,
      denom: amount,
      cost: SupplierMarginPrices[0].hbs,
      sell_price: sellPriceMargin.finalPrice,
      margin_pre: SupplierMarginPrices[0].preMargin,
      margin_post: SupplierMarginPrices[0].postMargin,
      directpay_id: payGwResult.data.payment_id
    });
    const newTrxHist = await TransactionHistory.create({
      trx_id: trxId,
      status: "UNPAID",
      data: payGwResult
    });
    // fire event for DirectMkiosWorker
    Event.fire("DIRECT::PAYSTATUS", {
      trxId,
      payId: payGwResult.data.payment_id
    });
    // return status
    return response.send({
      status: "OK",
      data: {
        id: trxId,
        payment_url: payGwResult.data.url
      }
    });
  }

  async emailCrm({
    auth,
    response
  }) {
    try {
      const plainmsisdn = auth.user.msisdn;
      const checkmsisdn = plainmsisdn + "-email";
      const check = await Cache.has(checkmsisdn);
      const mail = Env.get("MAIL_NOTIFICATION");
      if (check) {
        response.send({
          status: "FAIL"
        });
      } else {
        const date = moment()
          .utcOffset("+08:00")
          .format("DD-MMM-YYYY")
        const targetEmail = mail;
        const emailrp = await Mail.send(
          "emails.crm", {
            email: auth.user.email,
            msisdn: auth.user.msisdn,
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            fullname: auth.user.fullname
          },
          message => {
            message.subject(`inquiry in crm account ${auth.user.msisdn}-${date}`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(mail);
          }
        );
        const keyData = auth.user.msisdn + "-email";
        const mailData = auth.user.email;
        await Cache.put(keyData, mailData, 4320);
        response.send({
          status: "OK",
          data: emailrp
        });
      }
    } catch (error) {
      response.send({
        status: "FAIL",
        error: error
      });
    }
  }

  async ForgotPassword({
    request,
    response
  }) {
    const {
      newpassword,
      msisdn
    } = request.only(["newpassword", "msisdn"]);
    const check = await Users.findBy("msisdn", msisdn);
    if (check) {
      check.password = newpassword;
      await check.save();
      response.send({
        status: "OK"
      });
    } else {
      response.send({
        status: "FAIL",
        error: "msisdn does not exist"
      });
    }
  }

  async isExist({
    params,
    request,
    response
  }) {
    const check = await Users.findBy("msisdn", params.msisdn);
    if (check) {
      response.send({
        status: "OK",
        message: "msisdn exist"
      });
    } else {
      response.send({
        status: "FAIL",
        message: "msisdn does not exist"
      });
    }
  }
  async GetProfileCrm({
    view,
    auth,
    request,
    response,
    params
  }) {
    const token = atob(params.token); ///decode base64 token
    const tokenBase64 = atob(token);
    const data = await Users.query()
      .with("tokens")
      .whereHas("tokens", builder => {
        builder.where("token", tokenBase64);
      })
      .fetch();
    const msisdn = data.toJSON();
    const plainMsisdn = msisdn[0].msisdn;
    const check = await Cache.has(plainMsisdn);
    if (check) {
      return view.render("crm.wait", {
        error: "You cant Access this page"
      });
    } else {
      return view.render("crm.profile", {
        userData: data.toJSON(),
        nomor: msisdn[0].msisdn
      });
    }
  }

  async UpdateProfileCrm({
    response,
    request,
    params,
    auth,
    view
  }) {
    const {
      email,
      password,
      msisdn,
      count
    } = request.only([
      "email",
      "password",
      "msisdn",
      "count"
    ]);
    const data = await MygpGateway.queryAccount(email, password);
    if (data.access_token) {
      const check = await User.findBy("msisdn", msisdn);
      check.email = email;
      check.password = password;
      check.is_dealer = true;
      await check.save();
      return view.render("crm.success");
    } else {
      if (parseInt(count) >= 2) {
        await Cache.put(msisdn, email, 15);
      }
      return view.render("crm.profile", {
        error: "Invalid User or Password, your credential may be blocked due to multiple failure attempts",
        dataGw: parseInt(count),
        nomor: msisdn
      });
    }
  }
  // async Success({
  //   request,
  //   response,
  //   auth
  // }) {
  //   const email = "cs-litebss@neuronworks.co.id";
  //   const password = "Neuron#123";
  //   const coba = await MygpGateway.queryAccount(email, password);
  //   console.log(coba);
  //   return coba;
  // }
  async redis({
    request,
    response,
    auth
  }) {
    const msisdn = "085791858101";
    const final = msisdn + "-email";
    await Cache.put(final, "coba", 2);
    if (await Cache.has("085791858101-email")) {
      response.send({
        Status: "OK"
      });
    }
  }
  async checkRedis({
    response,
    auth
  }) {
    // await Cache.forget("1")
    if (await Cache.has("085791858101-email")) {
      response.send({
        Status: "OK",
        data: await Cache.get("085791858101-email")
      });
    } else {
      response.send({
        Status: "oh snap"
      });
    }
  }

  async deleteRedis({
    response
  }) {
    await Cache.forget("085791858101-email");
    response.send({
      status: "Success"
    });
  }

  async GetDeposit({
    view,
    params
  }) {
    const tokenBase64 = atob(atob(params.token));
    const data_user = await Database.table("tokens")
      .where("token", tokenBase64)
      .where("is_revoked", false);
    if (data_user[0]) {
      const user_id = data_user[0].user_id;
      const data_res = await Database.table("deposit_logs as d")
        .select(
          "d.payment_id",
          "d.created_at",
          Database.raw(
            `(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`
          )
        )
        .where("d.user_id", user_id)
        .where("d.status", "PAID")
        .limit(15)
        .orderBy("d.created_at", "desc");

      const data = data_res.map(el => {
        el.deposit_amount = numeral(Number(el.deposit_amount)).format("0,0.00");
        el.created_at = moment(el.created_at).format("DD MMM YYYY HH:mm:ss");
        return el;
      });
      return view.render("pages.e_receipt.deposit", {
        _list: data,
        _token: params.token
      });
    }
    return view.render("pages.e_receipt.deposit", {
      failed: "Invalid token"
    });
  }

  async GetDepositDetail({
    response,
    params
  }) {
    const table_model = "deposit_logs as d";
    let data = await Database.table(table_model)
      .select(
        "u.fullname",
        "d.payment_id",
        "d.status",
        Database.raw(
          `coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`
        ),
        Database.raw(
          `(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`
        ),
        Database.raw(
          `coalesce((select lc.credit from ledgers as lc where lc.self_references != '' and lc.self_references = (select rl.id from ledgers as rl where rl.deposit_ref = d.id)::text),0) as bonus`
        ),
        "d.amount",
        "d.detail",
        "d.created_at"
      )
      .leftJoin("users as u", "d.user_id", "u.id")
      // .leftJoin("ledgers as l", "d.id", "l.deposit_ref")
      .where("d.status", "PAID")
      .where("d.payment_id", params.payment_id);
    return response.json(data[0]);
  }

  async jompay({
    view,
    params
  }) {
    try {
      const tokenBase64 = atob(atob(params.token));
      const data_user = (await Token
        .query()
        .with('user')
        .where('token', tokenBase64)
        .where('is_revoked', false)
        .fetch()).toJSON();
      let ref_number = data_user[0].user.ref_number || false;
      if (!ref_number) {
        let ref_exist = true;
        let exist_data = await User
          .query()
          .pluck('ref_number')
        while (ref_exist) {
          let rand_key = randomize('0', 7); // 0 to set number random
          let gen_key = cdigit.luhn.generate(rand_key);
          if (exist_data.indexOf(gen_key) === -1) {
            // console.log("element doesn't exist");
            ref_number = gen_key;
            ref_exist = false;
          }
        }
        await Database
          .table('users')
          .where('id', data_user[0].user_id)
          .update('ref_number', ref_number);
      }
      return view.render('pages.payment.jompay', {
        biller_code: 39446,
        ref_number: ref_number,
        fullname: data_user[0].user.fullname
      })
    } catch (e) {
      return view.render('pages.payment.jompay', {
        biller_code: '-',
        ref_number: '-'
      })
    }
  }

  async GetReceipt({
    response,
    request
  }) {
    const knownUser = await request.buyerAccount;
    try {
      const table_model = "deposit_logs as d";
      let data = Database
        .table(table_model)
        .select('d.payment_id', 'd.created_at',
          Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`)
        )
        .where('d.user_id', knownUser.id)
        .where('d.status', 'PAID')
        .limit(15)
        .orderBy('d.created_at', 'desc');
      const payment = await data
      const arrPaymentId = await data.pluck('d.payment_id')

      let data_detail = await Database.table(table_model)
        .select("u.fullname", "d.payment_id", "d.status",
          Database.raw(`coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`),
          Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`),
          Database.raw(`coalesce((select lc.credit from ledgers as lc where lc.self_references != '' and lc.self_references = (select rl.id from ledgers as rl where rl.deposit_ref = d.id)::text),0) as bonus`),
          "d.amount", "d.created_at"
        )
        .leftJoin("users as u", "d.user_id", "u.id")
        .where("d.status", "PAID")
        .whereIn("d.payment_id", arrPaymentId);

      const detail = payment.map((el) => {
        const d_detail = data_detail.find(o => o.payment_id === el.payment_id);
        el.detail = d_detail;
        return el;
      });
      return response.send({
        status: "OK",
        data: detail
      });
    } catch (error) {
      response.send({
        status: "FAILED",
        error: `Error:${error}`
      });
    }
  }

  async GetBroadcast({
    response,
    request
  }) {
    try {
      const knownUser = request.buyerAccount;
      // page dimulai dari 0
      let {
        page
      } = request.get();
      const limit_res = 20;
      const objBs = await Database
        .table('broadcasts')
        .select('id', 'title', 'message', 'created_at')
        .whereRaw(`target::text like '%"${knownUser.id}"%' or target::text = '"All"'`)
        .orderBy('created_at', 'desc')
        .offset(limit_res * (page || 0))
        .limit(limit_res)
      response.send({
        status: "OK",
        data: objBs
      });
    } catch (e) {
      /// catch error
      Logger.warning("trx::history", serializeError(e));
      response.send({
        status: "FAIL",
        error: `E990: ${e.message}`,
      });
    }
  }
}

module.exports = MygrapariController;
