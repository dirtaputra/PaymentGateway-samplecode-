const Downloads = use("App/Models/Download");
const Deposit = use("App/Models/DepositLog");
const transaction = use("App/Models/Transaction");
const Statement = use("App/Models/Ledger");
const moment = require("moment");
const {
  Parser
} = require("json2csv");
const Database = use("Database");
const User = use('App/Models/User');
const Cache = use("Cache");
const numeral = require("numeral");
const Poin = use("App/Models/Poin");
const Env = use("Env");
class DepositDownload {
  async GenerateDeposit(id) {
    let csv;
    // const id = "264ea0d9-af96-4dc3-a94f-0dfbf3c6ef52"
    const DownloadData = await Downloads.query().with("user").where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();
    console.log(RDownloadData);
    const start = moment(RDownloadData[0].start).startOf("day").toISOString();
    const end = moment(RDownloadData[0].end).endOf("day").toISOString();
    const table_model = "deposit_logs as d";

    if (RDownloadData[0].user.type === "STAFF") {
      // const data = await Deposit.query()
      // 	.select("user_id", "payment_id", "amount", "status", "detail", "created_at")
      // 	.with("user")
      // 	.whereBetween("deposit_logs.created_at", [ start, end ])
      // 	.orderBy("deposit_logs.created_at", "desc")
      // 	.fetch();
      let qdata = await Database.table(table_model)
        .select("u.fullname", "d.payment_id", "d.status", "d.amount", "d.detail", "d.created_at",
          Database.raw(`coalesce((select l.debit from ledgers as l where l.remark like 'processing fee%' and split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`),
          Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where l.remark like 'processing fee%' and split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`),
          Database.raw(`case when SUBSTRING(payment_id,1,4)='TRSF' then 'YES' else '-' end as trsf`)
        )
        .leftJoin("users as u", "d.user_id", "u.id")
        .leftJoin("ledgers as l", "d.id", "l.deposit_ref")
        .whereBetween("d.created_at", [start, end])
        .orderBy("d.created_at", "desc");

      const data = qdata.map(function (el) {
        el.created_at = moment(el.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return el;
      });

      const fields = [{
          label: "Date",
          value: "created_at"
        },
        {
          label: "ID",
          value: "payment_id"
        },
        {
          label: "Name",
          value: "fullname"
        },
        {
          label: "Processing Fee",
          value: "processing_fee"
        },
        {
          label: "Deposit Amount",
          value: "deposit_amount"
        },
        {
          label: "Amount",
          value: "amount"
        },
        {
          label: "Status",
          value: "status"
        },
        {
          label: "SF",
          value: 'trsf'
        }
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(data);
    } else if (RDownloadData[0].user.type === "BUYER") {
      // const data = await Deposit.query()
      // 	.select("id", "user_id", "payment_id", "amount", "status", "detail", "created_at")
      // 	.with("user")
      // 	.where("deposit_logs.user_id", RDownloadData[0].user.id)
      // 	.whereBetween("deposit_logs.created_at", [ start, end ])
      // 	.orderBy("deposit_logs.created_at", "desc")
      // 	.fetch();
      // const fields = [ "payment_id", "amount", "status", "detail", "created_at" ];
      let qdata = await Database.table(table_model)
        .select("u.fullname", "d.payment_id", "d.status",
          Database.raw(`coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`),
          Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`),
          "d.amount", "d.detail", "d.created_at"
        )
        .leftJoin("users as u", "d.user_id", "u.id")
        .leftJoin("ledgers as l", "d.id", "l.deposit_ref")
        .whereBetween("d.created_at", [start, end])
        .whereRaw(`d.user_id = '${RDownloadData[0].user.id}'`)
        .orderBy("d.created_at", "desc");

      const data = qdata.map(function (el) {
        el.created_at = moment(el.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return el;
      });

      const fields = [{
          label: "Date",
          value: "created_at"
        },
        {
          label: "ID",
          value: "payment_id"
        },
        {
          label: "Processing Fee",
          value: "processing_fee"
        },
        {
          label: "Deposit Amount",
          value: "deposit_amount"
        },
        {
          label: "Amount",
          value: "amount"
        },
        {
          label: "Status",
          value: "status"
        }
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(data);
    }
    return csv;
  }
  // async GenerateTransaction(id) {
  //   let csv;
  //   const DownloadData = await Downloads.query().with("user").where("downloads.id", id).fetch();
  //   const RDownloadData = DownloadData.toJSON();
  //   const start = moment(RDownloadData[0].start).startOf("day").toISOString();
  //   const end = moment(RDownloadData[0].end).endOf("day").toISOString();
  //   if (RDownloadData[0].user.type === "STAFF") {
  //     const transactions = await transaction
  //       .query()
  //       .whereBetween("transactions.created_at", [start, end])
  //       .with("histories")
  //       .with("supply")
  //       .with("user")
  //       .fetch();

  //     const fields = [{
  //         label: "Name",
  //         value: "fullname"
  //       },
  //       {
  //         label: "Payment ID",
  //         value: "payment_id"
  //       },
  //       {
  //         label: "Status",
  //         value: "status"
  //       },
  //       {
  //         label: "Processing Fee",
  //         value: "processing_fee"
  //       },
  //       {
  //         label: "Deposit Amount",
  //         value: "deposit_amount"
  //       },
  //       {
  //         label: "Amount",
  //         value: "amount"
  //       },
  //       {
  //         label: "Detail",
  //         value: "detail"
  //       },
  //       {
  //         label: "Created At",
  //         value: "created_at"
  //       }
  //     ];
  //     const json2csvParser = new Parser({
  //       fields,
  //     });
  //     csv = json2csvParser.parse(data);
  //   } else if (RDownloadData[0].user.type === "BUYER") {
  //     // const data = await Deposit.query()
  //     // 	.select("id", "user_id", "payment_id", "amount", "status", "detail", "created_at")
  //     // 	.with("user")
  //     // 	.where("deposit_logs.user_id", RDownloadData[0].user.id)
  //     // 	.whereBetween("deposit_logs.created_at", [ start, end ])
  //     // 	.orderBy("deposit_logs.created_at", "desc")
  //     // 	.fetch();
  //     // const fields = [ "payment_id", "amount", "status", "detail", "created_at" ];
  //     let data = await Database.table(table_model)
  //       .select("u.fullname", "d.payment_id", "d.status",
  //         Database.raw(`coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0) as processing_fee`),
  //         Database.raw(`(d.amount - coalesce((select l.debit from ledgers as l where split_part(l.remark, ' ', 3) = d.payment_id),0)) as deposit_amount`),
  //         "d.amount", "d.detail", "d.created_at"
  //       )
  //       .leftJoin("users as u", "d.user_id", "u.id")
  //       .leftJoin("ledgers as l", "d.id", "l.deposit_ref")
  //       .whereBetween("d.created_at", [start, end])
  //       .whereRaw(`d.user_id = '${RDownloadData[0].user.id}'`)
  //       .orderBy("d.created_at", "desc");

  //     const fields = [{
  //         label: "Name",
  //         value: "fullname"
  //       },
  //       {
  //         label: "Payment ID",
  //         value: "payment_id"
  //       },
  //       {
  //         label: "Status",
  //         value: "status"
  //       },
  //       {
  //         label: "Processing Fee",
  //         value: "processing_fee"
  //       },
  //       {
  //         label: "Deposit Amount",
  //         value: "deposit_amount"
  //       },
  //       {
  //         label: "Amount",
  //         value: "amount"
  //       },
  //       {
  //         label: "Detail",
  //         value: "detail"
  //       },
  //       {
  //         label: "Created At",
  //         value: "created_at"
  //       }
  //     ];
  //     const json2csvParser = new Parser({
  //       fields,
  //     });
  //     csv = json2csvParser.parse(data);
  //   }
  //   return csv;
  // }
  async GenerateTransaction(id) {
    let csv;
    const DownloadData = await Downloads.query().with("user").where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();
    const start = moment(RDownloadData[0].start).startOf("day").toISOString();
    const end = moment(RDownloadData[0].end).endOf("day").toISOString();

    let query = `
      SELECT
        u.fullname,
        s.supplier_code,
        t.product_code,
        t.target,
        t.denom,
        t.poin,
        t.origin_price,
        t.cost,
        t.sell_price,
        t.margin_pre,
        t.margin_post,
        t.remark,
        t.supplier_trx_id,
        t.directpay_id,
        t.created_at,
        t.reference,
        tref.status
      FROM (
        SELECT th1.*, th2.status AS refstatus, to_char(th1.created_at, 'YYYY-MM-DD') AS thday
        FROM transaction_histories th1
        LEFT JOIN transaction_histories th2 ON th2.trx_id=th1.trx_id AND th2.created_at > th1.created_at
        WHERE th2.status IS null
        order by th1.created_at asc
      ) as tref
      join transactions as t on t.id=tref.trx_id
      left join users as u on t.buyer_id=u.id
      left join supplies as s on t.supply_id=s.id
      where
        t.created_at between '${start}' and '${end}'`;

    if (RDownloadData[0].user.type === "STAFF") {
      const trx = await Database.raw(query);
      const fields = [{
          value: "fullname",
          label: "Name",
        },
        {
          value: "supplier_code",
          label: "Supplier Code",
        },
        {
          value: "product_code",
          label: "Product Code",
        },
        {
          value: "target",
          label: "Target",
        },
        {
          value: "denom",
          label: "Denom",
        },
        {
          value: "origin_price",
          label: "Origin Price"
        },
        {
          value: "cost",
          label: "Cost",
        },
        {
          value: "sell_price",
          label: "Sell Price",
        },
        {
          value: "margin_pre",
          label: "Margin Pre",
        },
        {
          value: "margin_post",
          label: "Margin Post",
        },
        {
          value: "poin",
          label: "Redeem Point"
        },
        {
          value: "remark",
          label: "Remark",
        },
        {
          value: "supplier_trx_id",
          label: "Supplier Transaction ID",
        },
        {
          value: "directpay_id",
          label: "Direct Pay ID",
        },
        {
          value: "created_at",
          label: "Created at",
        },
        {
          value: "reference",
          label: "Reference",
        },
        {
          value: "status",
          label: "Status",
        },
      ];
      // console.log(formatted)
      const json2csvParser = new Parser({
        fields,
      });

      const reformattedData = trx.rows.map((x) => {
        x.created_at = moment(x.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return x;
      })

      csv = json2csvParser.parse(reformattedData);
    } else if (RDownloadData[0].user.type === "SUPPLIER") {
      const trx = await Database.raw(`
        ${query}
        and s.supplier_code='${RDownloadData[0].user.supplier_code}'
      `);
      const fields = [{
          label: "Product Code",
          value: "product_code",
        },
        {
          label: "Target",
          value: "target",
        },
        {
          label: "Denom",
          value: "denom",
        },
        {
          label: "Status",
          value: "status",
        },
        {
          label: "Created at",
          value: "created_at",
        },
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(trx.rows);
    } else {
      const trx = await Database.raw(`
        ${query}
        and t.buyer_id='${RDownloadData[0].user.id}'
      `);
      const trsMap = trx.rows.map((data, index, array) => {
        data.created_at = moment(data.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return data
      });
      const fields = [{
          label: "Product Code",
          value: "product_code",
        },
        {
          label: "Target",
          value: "target",
        },
        {
          label: "Denom",
          value: "denom",
        },
        {
          label: "Status",
          value: "status",
        },
        {
          label: "Created at",
          value: "created_at",
        },
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(trsMap);
    }
    return csv;
  }
  async GenerateStatement(id) {
    let csv;
    const DownloadData = await Downloads.query().with("user").where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();
    const start = moment(RDownloadData[0].start).startOf("day").toISOString();
    const end = moment(RDownloadData[0].end).endOf("day").toISOString();
    if (RDownloadData[0].user.type === "STAFF") {
      const data = await Statement.query()
        .select("user_id", "credit", "debit", "deposit_ref", "transaction_ref", "remark", "created_at")
        .with("deposit")
        .with("transactionHistory")
        .with("user")
        .whereBetween("ledgers.created_at", [start, end])
        .orderBy("ledgers.created_at", "desc")
        .fetch();

      const remappedData = data.toJSON().map((x) => {
        x.created_at = moment(x.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return x;
      })

      const fields = [{
          label: "Name",
          value: "user.fullname",
        },
        {
          label: "Type",
          value: "user.type",
        },
        {
          label: "Credit",
          value: "credit",
        },
        {
          label: "Debit",
          value: "debit",
        },
        {
          label: "Deposit Reference",
          value: "deposit_ref",
        },
        {
          label: "Transaction Reference",
          value: "transaction_ref",
        },
        {
          label: "Remark",
          value: "remark",
        },
        {
          label: "Created at",
          value: "created_at",
        },
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(remappedData);
    } else {
      const data = await Statement.query()
        .select("user_id", "credit", "debit", "deposit_ref", "remark", "transaction_ref", "created_at")
        .with("deposit")
        .with("transactionHistory")
        .with("user")
        .where("ledger.user_id", RDownloadData[0].user.id)
        .whereBetween("ledgers.created_at", [start, end])
        .orderBy("ledgers.created_at", "desc")
        .fetch();

      const remappedData = data.toJSON().map((x) => {
        x.created_at = moment(x.created_at).format("YYYY-MM-DD HH:mm:ss Z");
        return x;
      })

      const fields = [{
          label: "Name",
          value: "user.fullname",
        },
        {
          label: "Credit",
          value: "credit",
        },
        {
          label: "Debit",
          value: "debit",
        },
        {
          label: "Deposit Reference",
          value: "deposit_ref",
        },
        {
          label: "Transaction Reference",
          value: "transaction_ref",
        }, ,
        {
          label: "Remark",
          value: "remark",
        },
        {
          label: "Created at",
          value: "created_at",
        },
      ];
      const json2csvParser = new Parser({
        fields,
      });
      csv = json2csvParser.parse(remappedData);
    }
    return csv;
  }
  async GenerateUser(id) {
    let csv;
    const DownloadData = await Downloads.query().where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();

    const start = moment(RDownloadData[0].start).startOf("day").toISOString();
    const end = moment(RDownloadData[0].end).endOf("day").toISOString();
    let initial_db = await User
      .query()
      .select("id", "email", "fullname", "type", "supplier_code", "enable", "created_at", "msisdn")
      .whereBetween("created_at", [start, end])
      .orderBy("created_at", "desc")
      .fetch();
    // initial_db = initial_db.toJSON();

    //calculate time user actve balance
    const userData = await User.query().where("type", "BUYER").getCount();

    var balance = new Array();
    for (var i = 0; i < userData; i++) {
      const redisData = await Cache.get(i)
      balance[i] = redisData
    }

    const data = initial_db.rows.map((data, index, array) => {
      console.log(data.id);

      let obj_redis = balance.find(el => {
        if (!el) {
          return false
        }
        return el.id === data.id
      });
      let redis_balance = obj_redis ? obj_redis.amount : 0;
      return {
        email: data.email,
        fullname: data.fullname,
        msisdn: data.msisdn || '-',
        type: data.type,
        supplier_code: data.supplier_code || '-',
        enable: data.enable === 1 ? 'Enable' : 'Disable',
        created_at: moment(data.created_at).format("YYYY-MM-DD HH:mm:ss Z"),
        balance: numeral(redis_balance).format("0,0.00")
      }
    });

    const fields = [{
        label: "Email",
        value: "email"
      },
      {
        label: "Name",
        value: "fullname"
      },
      {
        label: "MSISDN",
        value: "msisdn"
      },
      {
        label: "Type",
        value: "type"
      },
      {
        label: "Supplier",
        value: "supplier_code"
      },
      {
        label: "Status",
        value: "enable"
      },
      {
        label: "Regristration Time",
        value: "created_at"
      },
      {
        label: "Balance",
        value: "balance"
      }
    ];
    const json2csvParser = new Parser({
      fields,
    });
    csv = json2csvParser.parse(data);

    return csv;
  }

  async GenerateTransferBalance(id) {
    let csv;
    const DownloadData = await Downloads.query().where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();

    const start = moment(RDownloadData[0].start).startOf("day").toISOString();
    const end = moment(RDownloadData[0].end).endOf("day").toISOString();
    let query = `
      select l1.created_at, l1.debit, u1.email as originating, u2.email as destination, u1.is_salesforce as salesforce, 
      case when u2.is_salesforce = false then 'NO' else 'YES' END AS sales
      from ledgers as l1
      join ledgers as l2 on l1.remark=l2.remark and l1.debit != 0 and l2.credit != 0
      left join users as u1 on l1.user_id=u1.id
      left join users as u2 on l2.user_id=u2.id
      where
        l1.created_at between '${start}' and '${end}'
      order by l1.created_at asc
    `;

    const data = (await Database.raw(query));
    const remappedData = data.rows.map(x => {
      x.created_at = moment(x.created_at).format("YYYY-MM-DD HH:mm:ss Z");
      return x;
    })
    const fields = [{
        label: "Originating",
        value: "originating"
      },
      {
        label: "Destination",
        value: "destination"
      },
      {
        label: "Amount",
        value: "debit"
      },
      {
        label: "SalesForce",
        value: "sales"
      },
      {
        label: "Time",
        value: "created_at"
      },
    ];
    const json2csvParser = new Parser({
      fields,
    });
    csv = json2csvParser.parse(remappedData);
    return csv;
  }

  async GeneratePoin(id) {
    let csv;
    const DownloadData = await Downloads.query().where("downloads.id", id).fetch();
    const RDownloadData = DownloadData.toJSON();

    const poin_validity = Env.get("POIN_VALIDITY");
    const start = moment(RDownloadData[0].start, "YYYY-MM-DD").add(poin_validity, "months").startOf("month").toISOString();
    const end = moment(RDownloadData[0].end, "YYYY-MM-DD").add(poin_validity, "months").endOf("month").toISOString();
    const data = (await Poin
      .query()
      .from('poins as p')
      .select('u.fullname', 'u.email', 'p.user_id',
        Database.raw('sum(p.poin) as poin'),
        Database.raw('sum(p.consumed) as consumed')
      )
      .whereBetween('p.expiry', [start, end])
      .leftJoin('users as u', 'p.user_id', 'u.id')
      .groupByRaw('user_id, email, fullname')
      .orderBy('u.fullname')
      .fetch()).toJSON();

    const fields = [{
        label: "Name",
        value: "fullname"
      },
      {
        label: "Email",
        value: "email"
      },
      {
        label: "Poin",
        value: "poin"
      },
      {
        label: "Consumed",
        value: "consumed"
      }
    ];
    const json2csvParser = new Parser({
      fields,
    });
    csv = json2csvParser.parse(data);
    return csv;
  }
}
module.exports = new DepositDownload();
