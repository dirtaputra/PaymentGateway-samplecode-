"use strict";
const Override = use("App/Models/OverrideDeposit");
const User = use("App/Models/User");
const Mail = use("Mail");
const Database = use("Database");
const moment = require("moment");
const ledger = use("App/Models/LedgerHook");
const deposit = use("App/Models/DepositLogHook");
const DepositM = use("App/Models/DepositLog");
const Env = use("Env");
const depositAttr = use("App/Common/DepositAttr");
const url = "rpg.telin.com.my/";
const Log = use("App/Models/Log");
class OverrideDepositController {
  async Index({
    response,
    request,
    view,
    auth
  }) {
    const stage1_1 = Env.get("STAGE1_1");
    const stage1_2 = Env.get("STAGE1_2");
    const stage2_1 = Env.get("STAGE2_1");
    const stage2_2 = Env.get("STAGE2_2");
    const stage2_3 = Env.get("STAGE2_3");
    if (!request.ajax()) {
      return view.render("pages.override", {
        stage1_1: stage1_1,
        stage1_2: stage1_2,
        stage2_1: stage2_1,
        stage2_2: stage2_2,
        stage2_3: stage2_3
      });
    }

    const draw = request.input('draw')
    const start_dt = request.input('start')
    const length_dt = request.input('length')
    const field_order = request.input('columns['+request.input('order[0][column]')+'][data]')
    const type_order = request.input('order[0][dir]')
    const search = request.input('search[value]')
    let init = Override.query()
      .select(
        "override_deposits.remark",
        "override_deposits.amount",
        "override_deposits.type",
        "override_deposits.id",
        "override_deposits.validator",
        "override_deposits.validate_by",
        "users.fullname"
      )
      .leftJoin("users", "override_deposits.user_id", "users.id")
      .where("status", 0)
      .where(function() {
        if (auth.user.email === stage2_1 || auth.user.email === stage2_2 || auth.user.email === stage2_3){
          // (data.validate_by.val1 === '' && data.validator.val2 ==='') || data.validate_by.val2 ==='aida'
          this.where(function() {
            this.where(Database.raw(`validate_by ->> 'val1'`), '');
            this.where(Database.raw(`validator ->> 'val2'`), '');
          })
          this.orWhere(Database.raw(`validate_by ->> 'val2'`), 'aida');
        } else if (auth.user.email === stage1_1 ||auth.user.email === stage1_2) {
          // data.validate_by.val2 === '' && data.validator.val2 === 'aida'
          this.where(Database.raw(`validate_by ->> 'val2'`), '');
          this.where(Database.raw(`validator ->> 'val2'`), 'aida');
        }
      })
      .whereRaw(`(
        fullname ILIKE '%${search}%'
        or remark ILIKE '%${search}%'
        )`)
      .orderBy(field_order, type_order)
      .clone()

    let records_total = await Override
      .query()
      .where("status", 0)
      .where(function() {
        if (auth.user.email === stage2_1 || auth.user.email === stage2_2 || auth.user.email === stage2_3){
          // (data.validate_by.val1 === '' && data.validator.val2 ==='') || data.validate_by.val2 ==='aida'
          this.where(function() {
            this.where(Database.raw(`validate_by ->> 'val1'`), '');
            this.where(Database.raw(`validator ->> 'val2'`), '');
          })
          this.orWhere(Database.raw(`validate_by ->> 'val2'`), 'aida');
        } else if (auth.user.email === stage1_1 ||auth.user.email === stage1_2) {
          // data.validate_by.val2 === '' && data.validator.val2 === 'aida'
          this.where(Database.raw(`validate_by ->> 'val2'`), '');
          this.where(Database.raw(`validator ->> 'val2'`), 'aida');
        }
      })
      .getCount();
    let records_filtered = search ? await init.getCount() : records_total;
    let initial_db = await init.offset(start_dt).limit(length_dt).fetch();
    
    const data_res = {
      'draw': draw,
      'recordsTotal': records_total,
      'recordsFiltered': records_filtered,
      'data': initial_db
    }
    return response.status(200).json(data_res);
  }

  async Add({
    response,
    request,
    auth,
    view
  }) {
    const userData = await User.query()
      .where("type", "BUYER")
      .fetch();
    // const historis = await Override.query()
    //   .with("user")
    //   .where("created_by", auth.user.id)
    //   .fetch()
    // console.log(historis.toJSON())
    return view.render("pages.depositAdd", {
      data: userData.toJSON(),
      // historisdata: historis.toJSON()
    });
  }
  async Store({
    request,
    response,
    auth,
    view,
    params
  }) {
    const stage1_1 = Env.get("STAGE1_1");
    const stage1_2 = Env.get("STAGE1_2");
    const stage2_1 = Env.get("STAGE2_1");
    const stage2_2 = Env.get("STAGE2_2");
    const stage2_3 = Env.get("STAGE2_3");
    const mail = auth.user.email;
    if (mail === stage2_1 || mail === stage2_2 || mail === stage2_3) {
      const cond = request.input("condition");
      if (cond === "deposit_transfer" || cond === "deposit_cash" || cond === "salesforce" || cond === "manual_jompay") {
        // const check = await DepositM.query()
        //   .where("user_id", request.input("user_id"))
        //   .where("status", "PAID")
        //   .fetch();
        const paidCount = (await DepositM.query()
          .where("user_id", request.input("user_id"))
          .where("status", "PAID")
          .count("* as total"))[0].total;
        const DepositData = new deposit();
        DepositData.user_id = request.input("user_id");
        DepositData.amount = request.input("amount");
        if (cond === "deposit_transfer") {
          DepositData.payment_id = "MIBFT" + new Date().valueOf();
        } else if (cond === "deposit_cash") {
          DepositData.payment_id = "MCASH" + new Date().valueOf();
        } else if (cond === "salesforce") {
          DepositData.payment_id = "TRSF" + new Date().valueOf();
        } else if (cond === "manual_jompay") {
          DepositData.payment_id = "JOM" + new Date().valueOf();
        }
        DepositData.status = "PAID";
        DepositData.detail = request.input("remark");
        DepositData.auth_user_id = auth.user.id;
        await DepositData.save();

        const ledgerDataRef = new ledger();
        const amount = request.input("amount");
        ledgerDataRef.user_id = request.all().user_id;
        ledgerDataRef.credit = request.all().amount;
        ledgerDataRef.remark = request.all().remark;
        ledgerDataRef.deposit_ref = DepositData.id;
        ledgerDataRef.auth_user_id = auth.user.id;
        await ledgerDataRef.save();
        console.log(paidCount);
        const user = await User.find(request.input("user_id"))
        console.log("partnerID: ", user.is_partner)
        if (Number(paidCount) === 0 && Number(user.is_partner) === 0) {
          const ledgerData = new ledger();
          const amount = request.input("amount");
          const bonus = parseFloat((amount * 5) / 100);
          ledgerData.user_id = request.all().user_id;
          ledgerData.credit = bonus;
          ledgerData.remark = `5% bonus from ${amount}`;
          ledgerData.auth_user_id = auth.user.id;
          ledgerData.self_references = ledgerDataRef.id
          console.log(ledgerDataRef.id)
          await ledgerData.save();
        }

        const OverrideData = new Override();
        OverrideData.user_id = request.input("user_id");
        OverrideData.remark = request.input("remark");
        OverrideData.amount = request.input("amount");
        OverrideData.status = 1;
        OverrideData.validator = '{"val1":"final","val2":""}';
        OverrideData.validate_by = `{"val1":"${auth.user.id}","val2":""}`;
        OverrideData.created_by = auth.user.id;
        OverrideData.type = request.input("condition");
        await OverrideData.save();
        const createdbyData = await User.find(OverrideData.created_by);
        const userData = await User.find(request.input("user_id"));
        const emailrp = await Mail.send(
          "emails.approve", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark"),
            created_by: createdbyData.fullname,
            trxId: DepositData.payment_id
          },
          message => {
            message.subject(`Approved Manual Deposit Transaction`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage2_1);
            message.to(stage2_2);
            message.to(stage2_3);
            ///stage 2 email
          }
        );
        return response.redirect("/statement");
      } else {
        const OverrideData = new Override();
        const mail = auth.user.email;
        OverrideData.user_id = request.input("user_id");
        OverrideData.remark = request.input("remark");
        OverrideData.amount = request.input("amount");
        OverrideData.status = 1;
        OverrideData.validator = '{"val1":"roszemi","val2":""}';
        OverrideData.validate_by = `{"val1":"${auth.user.id}","val2":""}`;
        OverrideData.created_by = auth.user.id;
        OverrideData.type = request.input("condition");
        await OverrideData.save();

        const ledgerData = new ledger();
        ledgerData.user_id = request.all().user_id;
        ledgerData.credit = request.all().amount;
        ledgerData.remark = request.all().remark;
        ledgerData.override_id = OverrideData.id;
        ledgerData.auth_user_id = auth.user.id;
        await ledgerData.save();
        //const targetEmail = stage2;
        const userData = await User.find(request.input("user_id"));
        const emailrp = await Mail.send(
          "emails.approve", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark")
          },
          message => {
            message.subject(`Approved Override Transaction`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage2_1);
            message.to(stage2_2);
            message.to(stage2_3); ///stage 2 email
          }
        );
        return response.redirect("/statement");
      }
    } else if (mail === stage1_1 || mail === stage1_2) {
      const OverrideData = new Override();
      OverrideData.user_id = request.input("user_id");
      OverrideData.remark = request.input("remark");
      OverrideData.amount = request.input("amount");
      OverrideData.status = 0;
      OverrideData.created_by = auth.user.id;
      OverrideData.validator = '{"val1":"final","val2":""}';
      OverrideData.validate_by = '{"val1":"","val2":""}';
      OverrideData.type = request.input("condition");
      await OverrideData.save();

      // const ledgerData = new ledger();
      // ledgerData.user_id = request.all().user_id;
      // ledgerData.credit = request.all().amount;
      // ledgerData.remark = request.all().remark;
      // ledgerData.override_id = OverrideData.id;
      // ledgerData.auth_user_id = auth.user.id;
      // await ledgerData.save();
      // const targetEmail = stage2;
      const userData = await User.find(request.input("user_id"));
      //const targetEmail = stage2;
      if (request.input("condition") === "deposit_cash" || request.input("condition") === "deposit_transfer" || request.input("condition") === "manual_jompay") {
        const emailrp = await Mail.send(
          "emails.ceo", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark")
          },
          message => {
            message.subject(`Approval Manual Deposit stage 2 `);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage2_1);
            message.to(stage2_2);
            message.to(stage2_3); ///stage 2 email
          }
        );
      } else {
        const emailrp = await Mail.send(
          "emails.ceo", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark")
          },
          message => {
            message.subject(`Approval Override Deposit stage 2`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage2_1);
            message.to(stage2_2);
            message.to(stage2_3); ///stage 2 email
          }
        );
      }
      return response.redirect("/statement");
    } else {
      const OverrideData = new Override();
      OverrideData.user_id = request.input("user_id");
      OverrideData.remark = request.input("remark");
      OverrideData.amount = request.input("amount");
      OverrideData.status = 0;
      OverrideData.created_by = auth.user.id;
      OverrideData.validator = '{"val1":"roszemi","val2":"aida"}';
      OverrideData.validate_by = '{"val1":"","val2":""}';
      OverrideData.type = request.input("condition");
      await OverrideData.save();
      if (request.input("condition") === "deposit_transfer" || request.input("condition") === "deposit_cash" || request.input("condition") === "manual_jompay") {
        const userData = await User.find(request.input("user_id"));
        const targetEmail = stage1;
        const emailrp = await Mail.send(
          "emails.vp", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark")
          },
          message => {
            message.subject(`Approval Manual Deposit stage 1`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage1); /// stage 1 email
          }
        );
      } else {
        const userData = await User.find(request.input("user_id"));
        const targetEmail = stage1;
        const emailrp = await Mail.send(
          "emails.vp", {
            email: userData.email,
            amount: request.input("amount"),
            datetime: moment()
              .utcOffset("+08:00")
              .format("DD-MMM-YYYY HH:mm:ss ZZ"),
            remark: request.input("remark")
          },
          message => {
            message.subject(`Approval Override Deposit stage 1`);
            message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
            message.to(stage1); /// stage 1 email
          }
        );
      }
      return response.redirect("/statement");
    }
  }

  async Edit({
    request,
    params,
    view,
    response,
    auth
  }) {
    try {
      const ValidateData = await Override.query()
        .with("user")
        .where("id", params.id)
        .fetch();

      let dataAll = ValidateData.toJSON();
      if (dataAll[0].created_by === '' || dataAll[0].remark === 'Topup Postpaid') {
        const update_createdBy = await Override.find(params.id);
        update_createdBy.created_by = auth.user.id;
        await update_createdBy.save();
        dataAll[0].created_by = auth.user.id;
      }
      const user_id = dataAll[0].created_by;
      const stage1_1 = Env.get("STAGE1_1");
      const stage1_2 = Env.get("STAGE1_2");
      const stage2_1 = Env.get("STAGE2_1");
      const stage2_2 = Env.get("STAGE2_2");
      const stage2_3 = Env.get("STAGE2_3");
      const created_by = await User.find(user_id);
      console.log(created_by.email);
      return view.render("pages.formValidate", {
        data: ValidateData.toJSON(),
        email: created_by.email,
        stage1_1: stage1_1,
        stage1_2: stage1_2,
        stage2_1: stage2_1,
        stage2_2: stage2_2,
        stage2_3: stage2_3
      });
    } catch (error) {
      console.log('OverrideDepositController error:', error);
      return response.send({
        status: false,
        error: error
      });
    }
  }

  async EditTransfer({
    params,
    view
  }) {
    const ValidateData = await Override.query()
      .with("user")
      .where("id", params.id)
      .fetch();

    const dataAll = ValidateData.toJSON();
    const user_id = dataAll[0].created_by;
    const created_by = await User.find(user_id);
    return view.render("pages.validateTransfer", {
      data: ValidateData.toJSON(),
      email: created_by.email
    })

  }

  async EditApp({
    params,
    view,
  }) {
    const url = Env.get("AZURE_DEPOSIT_URL");
    const container = Env.get("AZURE_STORAGE_CONTAINER");
    const ValidateData = await Override.query()
      .with("user")
      .where("id", params.id)
      .fetch();
    const dataAll = ValidateData.toJSON();
    const tmpId = dataAll[0].user.id;
    const tmpHistori = await Override.query()
      .with("user")
      .where("user_id", tmpId)
      .fetch();
    console.log(tmpHistori.toJSON())
    const user_id = dataAll[0].created_by;
    const created_by = await User.find(user_id);
    return view.render("pages.validateApp", {
      data: ValidateData.toJSON(),
      email: created_by.email,
      url: url,
      container: container,
      // histori: tmpHistori.toJSON()
    })
  }

  async updatevp({
    params,
    request,
    response,
    auth
  }) {
    const stage1_1 = Env.get("STAGE1_1");
    const stage1_2 = Env.get("STAGE1_2");
    const stage2_1 = Env.get("STAGE2_1");
    const stage2_2 = Env.get("STAGE2_2");
    const stage2_3 = Env.get("STAGE2_3");
    const catalogs = await Override.find(params.id);
    const cond = request.input("type");
    catalogs.user_id = request.all().user_id;
    catalogs.amount = request.all().amount;
    catalogs.remark = request.all().remark;
    catalogs.created_by = request.all().created_by;
    catalogs.validate_by = '{"val1":"","val2":"aida"}';
    catalogs.auth_user_id = auth.user.id;
    await catalogs.save();
    const userData = await User.find(request.input("user_id"));
    const targetEmail = stage2;
    if (cond === "deposit_cash" || cond === "deposit_transfer") {
      const emailrp = await Mail.send(
        "emails.ceo", {
          email: userData.email,
          amount: request.input("amount"),
          datetime: moment()
            .utcOffset("+08:00")
            .format("DD-MMM-YYYY HH:mm:ss ZZ"),
          remark: request.input("remark")
        },
        message => {
          message.subject(`Approval Manual Deposit stage 2`);
          message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
          message.to(stage2_1);
          message.to(stage2_2);
          message.to(stage2_3); ///stage 2 email
        }
      );
    } else {
      const emailrp = await Mail.send(
        "emails.ceo", {
          email: userData.email,
          amount: request.input("amount"),
          datetime: moment()
            .utcOffset("+08:00")
            .format("DD-MMM-YYYY HH:mm:ss ZZ"),
          remark: request.input("remark")
        },
        message => {
          message.subject(`Approval Override Deposit stage 2 `);
          message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
          message.to(stage2_1);
          message.to(stage2_2);
          message.to(stage2_3); ///stage 2 email
        }
      );
    }
    return response.redirect("/approval");
  }
  async updateceo({
    params,
    request,
    response,
    auth
  }) {
    const stage1_1 = Env.get("STAGE1_1");
    const stage1_2 = Env.get("STAGE1_2");
    const stage2_1 = Env.get("STAGE2_1");
    const stage2_2 = Env.get("STAGE2_2");
    const stage2_3 = Env.get("STAGE2_3");
    const mail = auth.user.email;
    const catalogs = await Override.find(params.id);
    const dataValidate = request.all().validate_by;
    catalogs.user_id = request.all().user_id;
    catalogs.amount = request.all().amount;
    catalogs.remark = request.all().remark;
    catalogs.status = 1;
    catalogs.created_by = request.all().created_by;
    if (dataValidate === "ceo_only") {
      catalogs.validate_by = `{"val1":"${auth.user.id}","val2":""}`;
    } else {
      catalogs.validate_by = `{"val1":"${auth.user.id}","val2":"aida"}`;
    }
    catalogs.auth_user_id = auth.user.id;
    await catalogs.save();
    //const targetEmail = stage2;
    const cond = request.input("type");
    const userData = await User.find(request.input("user_id"));
    if (cond === "deposit_transfer" || cond === "deposit_cash") {
      // const check = await DepositM.query()
      //   .where("user_id", request.input("user_id"))
      //   .where("status", "PAID")
      //   .fetch();
      const paidCount = (await DepositM.query()
        .where("user_id", request.input("user_id"))
        .where("status", "PAID")
        .count("* as total"))[0].total;
      const DepositData = new deposit();
      DepositData.user_id = request.input("user_id");
      DepositData.amount = request.input("amount");
      if (cond === "deposit_transfer") {
        DepositData.payment_id = "MIBFT" + new Date().valueOf();
      } else if (cond === "deposit_cash") {
        DepositData.payment_id = "MCASH" + new Date().valueOf();
      }
      DepositData.status = "PAID";
      DepositData.detail = request.input("remark");
      DepositData.auth_user_id = auth.user.id;
      await DepositData.save();

      const ledgerDataRef = new ledger();
      const amount = request.input("amount");
      ledgerDataRef.user_id = request.all().user_id;
      ledgerDataRef.credit = request.all().amount;
      ledgerDataRef.remark = request.all().remark;
      ledgerDataRef.deposit_ref = DepositData.id;
      ledgerDataRef.auth_user_id = auth.user.id;
      await ledgerDataRef.save();
      console.log(paidCount);
      const user = await User.find(request.input("user_id"))
      console.log("partnerID: ", user.is_partner)
      if (Number(paidCount) === 0 && Number(user.is_partner) === 0) {
        const ledgerData = new ledger();
        const amount = request.input("amount");
        const bonus = parseFloat((amount * 5) / 100);
        ledgerData.user_id = request.all().user_id;
        ledgerData.credit = bonus;
        ledgerData.remark = `5% bonus from ${amount}`;
        ledgerData.auth_user_id = auth.user.id;
        ledgerData.self_references = ledgerDataRef.id;
        await ledgerData.save();
      }

      const emailrp = await Mail.send(
        "emails.approve", {
          email: userData.email,
          amount: request.input("amount"),
          datetime: moment()
            .utcOffset("+08:00")
            .format("DD-MMM-YYYY HH:mm:ss ZZ"),
          remark: request.input("remark"),
          created_by: catalogs.created_by,
          trxId: DepositData.payment_id
        },
        message => {
          message.subject(`Approved Manual Deposit Transaction `);
          message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
          message.to(stage2_1);
          message.to(stage2_2);
          message.to(stage2_3);
        }
      );
      return response.redirect("/approval");
    } else {
      const id = request.input("id");
      const override = await Override.find(id);
      const ledgerData = new ledger();
      ledgerData.user_id = request.all().user_id;
      ledgerData.credit = request.all().amount;
      ledgerData.remark = request.all().remark;
      ledgerData.override_id = override.id;
      ledgerData.auth_user_id = auth.user.id;
      await ledgerData.save();

      const emailrp = await Mail.send(
        "emails.approve", {
          email: userData.email,
          amount: request.input("amount"),
          datetime: moment()
            .utcOffset("+08:00")
            .format("DD-MMM-YYYY HH:mm:ss ZZ"),
          remark: request.input("remark")
        },
        message => {
          message.subject(`Approved Override Deposit Transaction `);
          message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
          message.to(stage2_1);
          message.to(stage2_2);
          message.to(stage2_3); ///stage 2 email
        }
      );
      return response.redirect("/approval");
    }
  }

  async updateTransfer({
    auth,
    params,
    request,
    response
  }) {
    const Approve = await Override.find(params.id);
    Approve.validate_by = `{"val1":"${auth.user.id}","val2":""}`;
    Approve.status = 1;
    const userData = await User.find(Approve.user_id);
    userData.allow_transfer = 1;
    await Approve.save();
    await userData.save();
    return response.redirect("/approval");
  }

  async updateApp({
    auth,
    params,
    request,
    response
  }) {
    const stage2_1 = Env.get("STAGE2_1");
    const stage2_2 = Env.get("STAGE2_2");
    const stage2_3 = Env.get("STAGE2_3");
    const paidCount = (await DepositM.query()
      .where("user_id", request.input("user_id"))
      .where("status", "PAID")
      .count("* as total"))[0].total;
    var depositData = {
      user_id: request.input("user_id"),
      amount: request.input("amount"),
      payment_id: "MIBFT" + new Date().valueOf(),
      status: "PAID",
      detail: request.input("remark"),
    }
    const DepositTmp = await depositAttr.reqDeposit(depositData);
    const refID = await DepositM.query()
      .where("payment_id", depositData.payment_id)
      .first()
    var ledgerData = {
      user_id: depositData.user_id,
      credit: depositData.amount,
      deposit_ref: refID.id,
      remark: depositData.detail
    }
    const LedgerTmp = await depositAttr.reqLedger(ledgerData);

    const selfRef = await ledger.query()
      .where("deposit_ref", refID.id)
      .first();
    console.log(refID.id)
    console.log(selfRef.id)
    const user = await User.find(request.input("user_id"))
    console.log("partnerID: ", user.is_partner)
    if (Number(paidCount) === 0 && Number(user.is_partner) === 0) {
      const bonus = parseFloat((depositData.amount * 5) / 100);
      var Bonus = {
        user_id: depositData.user_id,
        credit: bonus,
        remark: `5% bonus from ${depositData.amount}`,
        self_references: selfRef.id
      }
      const LedgerBonus = await depositAttr.reqLedger(Bonus);
      console.log("asd")
    }
    const userData = await User.find(request.input("user_id"));
    const emailrp = await Mail.send(
      "emails.approveapp", {
        email: userData.email,
        amount: request.input("amount"),
        datetime: moment()
          .utcOffset("+08:00")
          .format("DD-MMM-YYYY HH:mm:ss ZZ"),
        remark: request.input("remark"),
        trxId: refID.payment_id,
        approved: auth.user.fullname
      },
      message => {
        message.subject(`Approved Manual Deposit Transaction from Mobile App`);
        message.from("rpg.telinmy@yandex.com", "RPG Platform - TelinMY");
        message.to(stage2_1);
        message.to(stage2_2);
        message.to(stage2_3);
        ///stage 2 email
      }
    );
    const catalogs = await Override.find(params.id);
    const dataValidate = request.all().validate_by;
    catalogs.user_id = request.all().user_id;
    catalogs.amount = request.all().amount;
    catalogs.remark = request.all().remark;
    catalogs.status = 1;
    catalogs.created_by = request.all().created_by;
    if (dataValidate === "ceo_only") {
      catalogs.validate_by = `{"val1":"${auth.user.id}","val2":""}`;
    } else {
      catalogs.validate_by = `{"val1":"${auth.user.id}","val2":"aida"}`;
    }
    catalogs.auth_user_id = auth.user.id;
    await catalogs.save();
    return response.redirect("/approval");
  }

  async filter_name({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await User.query()
      .select("id", "fullname", "msisdn", "email")
      // .whereRaw(`fullname ILIKE '%${param}%'`)
      .whereRaw(
        `(
        fullname ILIKE '%${param}%'
        or email ILIKE '%${param}%'
        or msisdn ILIKE '%${param}%'
        )`
      )
      .where("type", "BUYER")
      .fetch();
    const formattedData = res.rows.map(data => {
      return {
        id: data.id,
        text: data.fullname + "(" + data.msisdn + "||" + data.email + ")"
      };
    });
    return response.json({
      items: formattedData
    });
  }

  async Reject({
    params,
    request,
    response,
    auth,
    view
  }) {
    const OverrideData = await Override.find(params.id);
    OverrideData.status = 2;
    await OverrideData.save();
    return response.redirect("/approval");
  }

  async Historis({
    params,
    request,
    response,
    auth
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input('draw')
        const start_dt = request.input('start')
        const length_dt = request.input('length')
        const field_order = request.input('columns[' + request.input('order[0][column]') + '][data]')
        const type_order = request.input('order[0][dir]')
        const search = request.input('search[value]')

        const init = Override
          .query()
          .select("user_id", "remark", "amount", "status", "type")
          .offset(start_dt)
          .limit(length_dt)

          .orderBy(field_order, type_order)
          .clone()

        let initial_db = await init.fetch()
        let records_total = await User.getCount()
        let records_filtered = records_total

        if (search) {
          records_filtered = await init.getCount()
        }

        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
      // end of ajax datatable

      return view.render("pages.user");
    } catch (error) {
      return response.json({
        error: error
      })
    }
  }

  async cancelDeposit({
    params,
    request,
    respons,
    auth,
    view
  }) {
    return view.render("pages.cancelDeposit")
  }
  async historyDeposit({
    request,
    response,
    auth
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input('draw');
        const start_dt = request.input('start');
        const length_dt = request.input('length');
        const field_order = request.input('columns[' + request.input('order[0][column]') + '][data]');
        const type_order = request.input('order[0][dir]');
        const search = request.input('search[value]');
        const filter_user = request.get().filter_user ?
          `and payment_id = '${request.get().filter_user}'` :
          "";
        const init = DepositM
          .query()
          .select('users.fullname', 'deposit_logs.payment_id', 'deposit_logs.amount', 'deposit_logs.status', 'deposit_logs.detail', 'deposit_logs.created_at')
          .leftJoin('users', 'deposit_logs.user_id', 'users.id')
          .whereRaw(`(
            users.fullname ILIKE '%${search}%'
            or deposit_logs.payment_id ILIKE '%${search}%'
            or deposit_logs.detail ILIKE '%${search}%')
            and payment_id NOT LIKE 'JOM%'
            and payment_id NOT LIKE 'UPAY%'
            ${filter_user}
            `)
          .where("status", "PAID")
          .orderBy(field_order, type_order)
          .clone()

        let records_total = request.get().filter_user ?
          await DepositM
          .query()
          .where("payment_id", filter_user)
          .where("status", "PAID")
          .whereRaw(`
            payment_id NOT LIKE 'JOM%'
            and payment_id NOT LIKE 'UPAY%'
          `)
          .getCount() :
          await DepositM
          .query()
          .where("status", "PAID")
          .whereRaw(`
            payment_id NOT LIKE 'JOM%'
            and payment_id NOT LIKE 'UPAY%'
          `)
          .getCount();
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();

        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
    } catch (e) {
      return response.send(e)
    }
  }
  async filter_id({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await DepositM.query()
      .distinct('payment_id as id', 'payment_id as text')
      .whereRaw(`
        payment_id ILIKE '%${param}%'
        and payment_id NOT LIKE 'JOM%'
        and payment_id NOT LIKE 'UPAY%'
      `)
      .where("status", "PAID")
      .fetch();
    return response.json({
      items: res.toJSON()
    });
  }
  async historyOverride({
    request,
    response,
    auth
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input('draw');
        const start_dt = request.input('start');
        const length_dt = request.input('length');
        const field_order = request.input('columns[' + request.input('order[0][column]') + '][data]');
        const type_order = request.input('order[0][dir]');
        const search = request.input('search[value]');
        const filter_user = request.get().filter_user;
        const form_validate = request.input('form_validate') ? true : false;
        const init = Override
          .query()
          .select('users.fullname', 'override_deposits.remark', 'override_deposits.amount', 'override_deposits.type', 'override_deposits.status')
          .leftJoin('users', 'override_deposits.user_id', 'users.id')
          .whereRaw(`(
            users.fullname ILIKE '%${search}%'
            or override_deposits.remark ILIKE '%${search}%'
            )`)
          .where(function() {
            if (!form_validate) this.where('created_by', auth.user.id);
            if (filter_user) this.where('user_id', filter_user);
          })
          .orderBy(field_order, type_order)
          .clone()

        let records_total = await Override
          .query()
          .where(function() {
            if (!form_validate) this.where('created_by', auth.user.id);
            if (filter_user) this.where('user_id', filter_user);
          })
          .getCount();
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();

        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
    } catch (e) {
      return response.send(e)
    }
  }

  async cancelDepositAction({
    request,
    response,
    auth
  }) {
    try {
      const objD = await Database
        .table('deposit_logs')
        .where('payment_id', request.get().payment_id)
        .where('status', 'PAID')
        .first()
      const objL = await Database
        .table('ledgers')
        .where('deposit_ref', objD.id)
        .first()

      const saveD = new Log();
      saveD.before = objD; //before
      saveD.after = {}; //after
      saveD.activity = `DELETE ${request.get().payment_id} from deposit log`;
      saveD.user_id = auth.user.id;

      const saveL = new Log();
      saveL.before = objL; //before
      saveL.after = {}; //after
      saveL.activity = `DELETE with deposit ref ${request.get().payment_id} from ledger`;
      saveL.user_id = auth.user.id;

      await Database
        .table('ledgers')
        .where('id', objL.id)
        .delete();
      await Database
        .table('deposit_logs')
        .where('id', objD.id)
        .delete();

      await Promise.all([
        saveL.save(),
        saveD.save(),
      ])
      response.send({
        status: true
      })
    } catch (error) {
      console.log("cancel deposit action: ", error)
      response.send({
        status: false,
        error: error
      })
    }
  }
}

module.exports = OverrideDepositController;
