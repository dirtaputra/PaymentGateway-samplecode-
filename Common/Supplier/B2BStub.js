const sinon = use("sinon");

const moment = require("moment");

class B2BStub {
  constructor(stubTarget) {
    sinon.stub(stubTarget, "balance").callsFake(async () => {
      return {
        balance: "60300.970"
      };
    });

    sinon.stub(stubTarget, "purchase").callsFake(async (data) => {
      // console.log(JSON.stringify(data))
      console.log(data.request._all.amount)
      const splitData = data.request._all.item_id
      const tmp = splitData.split(":");
      const product_code = tmp[0];
      const amount = data.request._all.amount
      const price = (80 / 100) * parseFloat(data.request._all.amount)
      if (product_code === "PLN" && amount === "100000") {
        return {
          trx_id: "TRXXXX453EKDL6JY",
          response_code: "01",
          message: "pending",
          product: {
            code: product_code,
            item_id: splitData,
            category: product_code === "PLN" ? "PIN" : "ELOAD",
            country: "IDN",
            name: product_code,
            description: product_code,
            denomination: parseFloat(data.request._all.amount).toFixed(2),
            price: price,
            //rrp: data.reference,
            available: true
          }
        }
      } else {
        return {
          response_code: "21",
          message: "product not exist"
        }
      }
    })



    sinon.stub(stubTarget, "transactionList").callsFake(async () => {
      return {
        data: {
          trx_id: "TRXXXX453EKDL6JY",
          response_code: "00",
          message: "pending",
          order_time: moment(x.created_at).toISOString(),
          update_time: moment(x.histories.updated_at).toISOString(),
          product: {
            code: "PLN",
            item_id: `PLN:PLN`,
            category: "PIN",
            country: "IDN",
            name: "PLN Pre PAID",
            description: "PLN Pre PAID",
            denom: "100.000",
            price: "34.00",
            rrp: "40",
            available: true
          }
        }
      }
    })

    sinon.stub(stubTarget, "transactionDetail").callsFake(async () => {
      return {
        data: {
          trx_id: "TRXXXX453EKDL6JY",
          response_code: "00",
          message: "pending",
          order_time: moment(x.created_at).toISOString(),
          update_time: moment(x.histories.updated_at).toISOString(),
          product: {
            code: "PLN",
            item_id: `PLN:PLN`,
            category: "PIN",
            country: "IDN",
            name: "PLN Pre PAID",
            description: "PLN Pre PAID",
            denom: "100.000",
            price: "34.00",
            rrp: "40",
            available: true
          }
        }
      }
    })
  }
}

module.exports = B2BStub;
