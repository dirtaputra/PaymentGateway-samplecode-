"use strict";
const User = use("App/Models/User");
const Database = use("Database");
// const token = use('App/Models/Token')
const Log = use("App/Models/Log");
const Encryption = use("Encryption");
const btoa = use("btoa");
const BK = use("App/Common/BalanceKeeper");
const meReload = use("App/Common/Supplier/MeReloadPlugin");
const Alterra = use("App/Common/Supplier/AlterraPlugin");
const check = use("App/Common/Supplier/AutoCheck");
const bbPromise = require("bluebird");
const Cache = use("Cache");
const moment = use("moment");
const numeral = require("numeral");
const TransactionHistory = use("App/Models/TransactionHistory");
const Ledger = use("App/Models/Ledger");
const CatalogDetails = use("App/Models/CatalogDetail");
const JsonFind = require('json-find');
const PurchaseValidation = use("App/Common/PurchaseValidation");
const randomstring = require("randomstring");
const Hash = use('Hash');
const {
  validateAll
} = use('Validator');

class UserController {
  async data({
    request,
    response
  }) {
    let pagination = request.only(["page", "limit"]);
    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 10;
    const userData = await Database.select("*")
      .from("users")
      .paginate(page, limit);
    return response.json(userData);
  }

  async index({
    view,
    request,
    response
  }) {
    // try {
    let {
      startdate,
      enddate
    } = request.all();
    // const start = startdate ? moment(startdate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    // const end = enddate ? moment(enddate).endOf('day').format('YYYY-MM-DD HH:mm:ss') : moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');

    const start = startdate ?
      moment(startdate, "YYYY-MM-DD")
      .startOf("day")
      .toISOString() :
      moment()
      .startOf("month")
      .toISOString();
    const end = enddate ?
      moment(enddate, "YYYY-MM-DD")
      .endOf("day")
      .toISOString() :
      moment()
      .endOf("month")
      .toISOString();

    if (request.ajax()) {
      const draw = request.input("draw");
      const start_dt = request.input("start");
      const length_dt = request.input("length");
      const field_order = request.input(
        "columns[" + request.input("order[0][column]") + "][data]"
      );
      const type_order = request.input("order[0][dir]");
      const search = request.input("search[value]");

      const init = User.query()
        .select(
          "id",
          "email",
          "fullname",
          "type",
          "supplier_code",
          "enable",
          "is_partner",
          "created_at",
          "t.last_tx",
          Database.raw("t.last_tx IS NULL AS isnull")
        )
        .joinRaw(`left join (select t1.buyer_id, max(t1.created_at) as last_tx from transactions t1 group by buyer_id) as t on users.id = t.buyer_id`)
        .whereRaw(
          `(
              email ILIKE '%${search}%'
              or fullname ILIKE '%${search}%'
              or type ILIKE '%${search}%'
              or supplier_code ILIKE '%${search}%'
              )`
        )
        .whereBetween("created_at", [start, end])
        .orderBy('isnull', 'ASC')
        .orderBy(field_order, type_order)
        .clone();

      let records_total = await User.query().whereBetween("created_at", [start, end]).getCount();
      let records_filtered = search ? await init.getCount() : records_total;
      let initial_db = await init
        .offset(start_dt)
        .limit(length_dt)
        .fetch();

      //calculate time user actve balance
      const time = moment().toISOString();
      const amount = await Cache.get("0");
      var a = moment(amount.time);
      var b = moment(time);
      const diff = a.diff(b, "minutes"); // 1
      const minutesString = moment.duration(diff, "minutes").humanize(true);

      const userData = await User.query()
        .where("type", "BUYER")
        .getCount();

      var balance = new Array();
      for (var i = 0; i < userData; i++) {
        let redisData = (await Cache.get(i)) || 0;
        balance[i] = redisData;
      }

      const tryData = initial_db.rows.map((data, index, array) => {
        let obj_redis = balance.find(el => el.id === data.id);
        let redis_balance = obj_redis ? obj_redis.amount : 0;
        let redis_minute = obj_redis ? minutesString : "-";
        return {
          id: data.id,
          email: data.email,
          fullname: data.fullname,
          type: data.type,
          supplier_code: data.supplier_code,
          enable: data.enable,
          created_at: data.created_at,
          is_partner: data.is_partner,
          // time: redis_minute,
          balance: numeral(redis_balance).format("0,0.00"),
          last_tx: data.last_tx
        };
      });

      const data_res = {
        draw: draw,
        recordsTotal: records_total,
        recordsFiltered: records_filtered,
        data: tryData,
        time: minutesString
      };
      return response.status(200).json(data_res);
    }
    // end of ajax datatable

    return view.render("pages.user");
    // } catch (error) {
    //   return response.json({
    //     error: error
    //   });
    // }
  }

  async create({
    view
  }) {
    return view.render("pages.userAdd");
  }
  async store({
    request,
    response,
    auth
  }) {
    try {
      const type = request.input("type");
      const is_partner = request.input("is_partner");
      let data_req = request.only([
        "email",
        "fullname",
        "password",
        "type",
        "trx_scope",
        "whitelist",
        "supplier_code",
      ]);
      data_req.auth_user_id = auth.user.id;
      let authToken;
      let partner_token;
      const partner_id = request.input("partner_id") || "0";
      if (is_partner === "yes") {
        partner_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        authToken = await Hash.make(partner_token)

      }
      let user = await User.create({
        email: data_req.email,
        fullname: data_req.fullname,
        password: data_req.password,
        type: data_req.type,
        is_partner: partner_id,
        whitelist: data_req.whitelist,
        authtoken: authToken,
        trx_scope: data_req.trx_scope,
        supplier_code: data_req.supplier_code,
        auth_user_id: auth.user.id,
        partner_token: partner_token
      });
      //let user = await User.create(data_req);
      if (type === "BUYER") {
        let token = await auth.authenticator("api").generate(user);
        Object.assign(user, token);
      } else if (type === "SUPPLIER") {
        let token = await auth.authenticator("api").generate(user);
        Object.assign(user, token);
      }

      // const fullname = request.input('fullname')

      // const Logs = new Log()
      // Logs.user_id = auth.user.id
      // Logs.activity = 'add data user'
      // Logs.detail = 'add data user =' + fullname + ', and type =' + type
      // await Logs.save()
      return response.redirect("/user");
    } catch (error) {
      return response.redirect("/user");
    }
  }
  async generateNewToken({
    auth,
    view,
    response
  }) {
    const supplierData = await auth
      .authenticator("jwt")
      .revokeTokensForUser(auth.user, null, true);
    const buyerToken = await auth.authenticator("api").generate(auth.user);
    return response.redirect("back");
  }
  async generateNewPassword({
    auth,
    view,
    response
  }) {
    const partner_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const authToken = await Hash.make(partner_token)
    const users = await User.find(auth.user.id)
    users.partner_token = partner_token;
    users.authtoken = authToken
    users.auth_user_id = auth.user.id;
    await users.save();
    return response.redirect("back");
  }
  async profile({
    view,
    auth,
    response
  }) {
    if (auth.user.type === "STAFF") {
      return view.render("pages.profile");
    } else if (auth.user.type === "SUPPLIER") {
      const profile = await User.query()
        .with("tokens")
        .where("users.id", auth.user.id)
        .fetch();
      const dataProfile = profile.toJSON();
      const tokens = btoa(dataProfile[0].tokens[0].token);
      const decrypted = tokens;
      return view.render("pages.profile", {
        data: profile,
        token: tokens,
        plain: decrypted
      });
    } else if (auth.user.type === "BUYER") {
      const profile = await User.query()
        .with("tokens")
        .where("users.id", auth.user.id)
        .fetch();
      const dataProfile = profile.toJSON();
      const tokens = btoa(dataProfile[0].tokens[0].token);
      return view.render("pages.profile", {
        data: profile,
        token: tokens
      });
    }
  }
  async destroy({
    response,
    params,
    auth
  }) {
    try {
      const users = await User.find(params.id);
      users.auth_user_id = auth.user.id;
      await users.delete();

      // const Logs = new Log()
      // Logs.user_id = auth.user.id
      // Logs.activity = 'Delete user data'
      // Logs.detail = 'Deleted ' + users.fullname
      // await Logs.save()
      return response.redirect("back");
    } catch (error) {
      return response.redirect("back");
    }
  }
  async edit({
    view,
    params
  }) {
    const users = await User.find(params.id);
    return view.render("pages.userEdit", {
      data: users
    });
  }
  async update({
    params,
    request,
    response,
    auth
  }) {
    const users = await User.find(params.id);

    users.email = request.all().email;
    users.fullname = request.all().fullname;
    users.password = request.all().password;
    users.type = request.all().type;
    users.enable = request.all().enable;
    users.is_partner = request.all().is_partner;
    users.whitelist = request.all().whitelist;
    users.supplier_code = request.all().supplier_code;

    users.auth_user_id = auth.user.id;

    // const Logs = new Log()
    // const U_email = request.all().email;
    // const U_fullname = request.all().fullname;
    // const U_password = request.all().password;
    // const U_type = request.all().type;
    // const U_supplier_code = request.all().supplier_code;

    // Logs.user_id = auth.user.id
    // Logs.activity = 'Update user data'
    // Logs.detail = 'Update email = ' + users.email + ' to = ' + U_email + ', name = ' + users.fullname + ' to = ' + U_fullname + ', supplier code = ' + users.supplier_code + ' to = ' + U_supplier_code
    // await Logs.save()
    await users.save();
    return response.redirect("/user");
    // const asd = users.fullname
    // const data = request.all().fullname
    // return data + ' ' + asd
  }
  async updateProfile({
    params,
    request,
    response,
    auth
  }) {
    const users = await User.find(params.id);

    users.email = request.all().email;
    users.fullname = request.all().fullname;
    users.password = request.all().password;
    users.type = request.all().type;
    users.supplier_code = request.all().supplier_code;
    users.msisdn = request.all().msisdn;
    users.auth_user_id = auth.user.id;
    await users.save();
    return response.redirect("/account");
  }

  async changePassword({
    params,
    request,
    response,
    auth
  }) {
    try {
      const {
        oldPassword,
        newPassword
      } = request.get();
      // validation form
      const rules = {
        oldPassword: 'required',
        newPassword: 'required',
        repeatPassword: 'required|same:newPassword'
      }
      const validation = await validateAll(request.get(), rules);
      if (validation.fails()) {
        return response.json({
          status: false,
          error: validation.messages()
        });
      }

      const users = await User.find(params.id);
      const check_pwd = await Hash.verify(oldPassword, users.password);
      if (check_pwd) {
        users.password = newPassword;
        users.auth_user_id = auth.user.id;
        users.change_password = 'change_password';
        await users.save();
        return response.json({
          status: true
        })
      } else {
        return response.json({
          status: false,
          error: [{
            field: "oldPassword",
            message: "your input old password not match",
            validation: "match"
          }]
        });
      }
    } catch (e) {
      throw e;
    }
  }
  async addSupply({
    view
  }) {
    return view.render("pages.supplyCatalogAdd");
  }
  async SoftDelete({
    params,
    request,
    response,
    auth,
    view
  }) {
    try {
      const change_status = params.status === '0' ? 1 : 0;
      const users = await User.find(params.id);
      users.enable = change_status;
      users.auth_user_id = auth.user.id;
      await users.save();
      return response.redirect("/user");
    } catch (error) {
      return view.render("pages.user", {
        error: "You cant enable this account"
      });
    }
  }

  async index_b2b({
    view,
    request,
    response
  }) {
    if (!request.ajax()) return view.render("pages.userB2b");
    const draw = request.input("draw");
    const start_dt = request.input("start");
    const length_dt = request.input("length");
    const field_order = request.input("columns[" + request.input("order[0][column]") + "][data]");
    const type_order = request.input("order[0][dir]");
    const search = request.input("search[value]");
    
    const init = User.query()
      .select( "id", "email", "fullname", "type", "supplier_code", "enable", "is_partner", "created_at", "t.last_tx", 
        Database.raw("t.last_tx IS NULL AS isnull")
      )
      .joinRaw(`left join (select t1.buyer_id, max(t1.created_at) as last_tx from transactions t1 group by buyer_id) as t on users.id = t.buyer_id`)
      .whereRaw(
        `(
          email ILIKE '%${search}%'
          or fullname ILIKE '%${search}%'
          or type ILIKE '%${search}%'
          or supplier_code ILIKE '%${search}%'
        )`
      )
      .where('is_partner', '!=', '')
      .where('is_partner', '!=', '0')
      .orderBy('isnull', 'ASC')
      .orderBy(field_order, type_order)
      .clone();
          
    let records_total = await User
      .query()
      .where('is_partner', '!=', '')
      .where('is_partner', '!=', '0')
      .getCount();
    let records_filtered = search ? await init.getCount() : records_total;
    let initial_db = await init
      .offset(start_dt)
      .limit(length_dt)
      .fetch();
    //calculate time user actve balance
    const time = moment().toISOString();
    const amount = await Cache.get("0");
    var a = moment(amount.time);
    var b = moment(time);
    const diff = a.diff(b, "minutes"); // 1
    const minutesString = moment.duration(diff, "minutes").humanize(true);
    const userData = await User.query()
      .where("type", "BUYER")
      .getCount();
    var balance = new Array();
    for (var i = 0; i < userData; i++) {
      let redisData = (await Cache.get(i)) || 0;
      balance[i] = redisData;
    }
    
    const tryData = initial_db.rows.map((data, index, array) => {
      let obj_redis = balance.find(el => el.id === data.id);
      let redis_balance = obj_redis ? obj_redis.amount : 0;
      let redis_minute = obj_redis ? minutesString : "-";
      return {
        id: data.id,
        email: data.email,
        fullname: data.fullname,
        type: data.type,
        supplier_code: data.supplier_code,
        enable: data.enable,
        created_at: data.created_at,
        is_partner: data.is_partner,
        // time: redis_minute,
        balance: numeral(redis_balance).format("0,0.00"),
        last_tx: data.last_tx
      };
    });
              
    const data_res = {
      draw: draw,
      recordsTotal: records_total,
      recordsFiltered: records_filtered,
      data: tryData,
      time: minutesString
    };
    return response.status(200).json(data_res);
  }

  async Test1({
    response
  }) {
    const deposit = await BK.balance("4bb0171a-e5df-42ec-8988-f0be1046bdb8");
    response.send({
      balance: deposit
    });
  }

  async Test({
    response,
    request,
    auth
  }) {
    const userList = await User.query()
      .where("type", "BUYER")
      .fetch();
    const userData = userList.rows.map(data => {
      return {
        id: data.id
      };
    });

    var i;
    var balance = new Array();
    for (i = 0; i < userData.length; i++) {
      balance[i] = await BK.balance(userData[i].id);
    }
    const time = new Date().toISOString();
    const waktu = moment(time).format("mm");
    const tryData = userList.rows.map((data, index) => {
      return {
        id: data.id,
        amount: balance[index],
        time: moment(time).format("YYYY-MM-DD HH:mm:ss Z")
      };
    });
    var total = 0;
    for (var i = 0; i < balance.length; i++) {
      total += balance[i];
    }
    await Cache.putMany(tryData, 30);
    await Cache.put("user_balance", total, 30);
    const dfg = moment.duration(-4, "minutes").humanize(true);
    return tryData;
  }

  async request({
    request,
    response
  }) {
    //request example 
    var inputData = {
      TrxID: "AM1416",
      SourceNo: "6285791858101",
      DestNo: "6285791858101",
      product_code: "ID_AM",
      byAmount: "false",
      denom: "50000"
    }
    const coba = await Tranglo.requestTopup(inputData);
    response.send({
      //data: moment.duration(finTime, "minutes").humanize(true)
      data: coba
    });
  }

  async check({
    response,
    request
  }) {
    // var inputData = {
    //   DealerTransactionID: "TRXXXX4370ZGE5EE",
    //   TrangloTransactionID: "190620092356072"
    // }
    // const coba = await Tranglo.checkTransactionStatusDetails(inputData)
    //const coba = await Tranglo.checkBalance()
    // const selfRef = await Ledger.query()
    //   .where("deposit_ref", "84848c00-d120-45a6-81d2-cf7fc3810f3b")
    //   .fetch()
    // const tmp = selfRef.toJSON()
    // const pv = await PurchaseValidation.sellingPriceB2B("ALFAMART", "ALFAMART", "50000", "PR0001")
    // const margin = await PurchaseValidation.findMarginByID("ALFAMART", "ALFAMART", "50000", "13.30")
    // const ip = request.ip()
    // const auto = await check.alterraProduct()
    // console.log(auto.data[0])
    // const res = response.response.statusCode
    // const rc_desc = {
    //   "00": "Success",
    //   "10": "Pending",
    //   "20": "Wrong number/ number blocked/ number expired",
    //   "21": "Product Issue",
    //   "22": "Duplicate Transaction",
    //   "23": "Connection Timeout",
    //   "24": "Provider Cut Off",
    //   "25": "KWH is Overlimit",
    //   "26": "Payment Overlimit",
    //   "50": "Bill Already Paid/ Not Available",
    //   "51": "Invalid Inquiry Amount or No inquiry",
    //   "98": "Order Canceled by Ops",
    //   "99": "General Error",
    // };
    const rc_desc = {
      "0": "Success Transaction",
      "1": "Fail Transaction",
      "2": "Transaction Not Found",
      "10": "Parameter request not complete",
      "11": "Invalid denom value",
      "12": "Invalid MSISDN destination number",
      "13": "Invalid RequestID format",
      "14": "Problem user access",
      "15": "Duplicate ReqID",
      "16": "Not Enough Deposit",
      "17": "IP Address not allowed",
      "18": "Invalid Method Request",
      "26": "Insufficient Deposit",
      "69": "late response cause answering more than 14 seconds",
      "81": "B-Phone number is expired",
      "100": "Other error",
      "101": "Transaction is failed",
      "102": "Subscriber not found",
      "103": "Account barred from refill",
      "104": "Temporary blocked",
      "105": "Dedicated account not allowed",
      "109": "Reaches maximum number of daily balance sharing from",
      "115": "Refill not accepted",
      "117": "Service Class not allowed",
      "120": "Invalid refill profile",
      "121": "Supervision period too long",
      "122": "Service fee period too long",
      "123": "Max credit limit exceed",
      "126": "Account not active",
      "136": "Date adjustment error",
      "153": "Dedicated account max credit limit exceeded",
      "160": "Operation not allowed",
      "167": "Invalid unit type",
      "177": "Refill denied, account not active",
      "178": "Refill denied, service fee expired",
      "179": "Refill denied, supervision expired",
      "900": "Gateway problem",
      "998": "998 HTTP access not allowed",
      "999": "Time limit transaction exceeded (No Response)"
    }
    // const rc = "999";
    // const tmp = rc_desc[rc]
    // response.send({
    //   res: tmp
    // })
    const old = await Cache.get('rates_old')
    const current = await Cache.get('rates_current')
    response.send({
      rates_old: old,
      rates_current: current
    })
  }
  async getTime({
    request,
    response,
    auth
  }) {
    const time = moment().toISOString();
    const amount = await Cache.get("0");
    var a = moment(amount.time);
    var b = moment(time);
    const diff = a.diff(b, "minutes"); // 1
    const minutesString = moment.duration(diff, "minutes").humanize(true);

    return response.json(minutesString);
  }

  async cekData({
    request,
    response
  }) {

    const recentHistory = (await TransactionHistory.query()
      .where("trx_id", "TRXXXX4359CIW2XY")
      .orderBy("created_at", "desc")
      .fetch()).first();
    const inputData = ({
      //DealerTransactionID: jobData.trxId,
      TrangloTransactionID: recentHistory.data.TrangloTransactionId
    });
    response.send({
      id: inputData.TrangloTransactionID
    })

  }

  async cobaData({
    request,
    response
  }) {
    const Override = use("App/Models/OverrideDeposit");
    const BalanceKeeper = use("App/Common/BalanceKeeper");
    const testing = use("App/Common/DepositAttr");


    const arr_email = ['info@telin.hk', 'hello@telin.tw'];
    const obj = await User
        .query()
        .where('is_partner', '!=', "")
        .where('is_partner', '!=', "0")
        .whereIn('email', arr_email)
        .pluck('id');
    for (const user_id of obj) {
      let inputData = {
        user_id: user_id,
        remark: 'Topup Postpaid',
        amount: 2500,
        validator: '{"val1":"final","val2":""}',
        validate_by: '{"val1":"","val2":""}',
        status: 0,
        type: 'deposit_transfer'
      }
      const [balance, check_data] = await Promise.all([
        BalanceKeeper.balance(user_id),
        Override
          .query()
          .where(inputData)
          .getCount()
      ])
      if (balance < 500) {
        if (check_data < 1) await testing.reqOverride(inputData);
        console.log('>>>>>> Kirim email', user_id)
      }
      console.log('>>>>>> Data ', balance, check_data)
    }
    return response.send({status: true})
  }
}

module.exports = UserController;
