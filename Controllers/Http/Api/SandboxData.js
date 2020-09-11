module.exports.History = () => {
  return [
    {
      id: "TRXDEMO003",
      product: "AS2IN1",
      origin: "IDR",
      target: "6011242345678",
      denom: "100.00",
      price: "96.04",
      status: "SUCCESS",
      data: {
        pin: "1213512515151515",
        amount: "100.00"
      },
      purchased_at: "2019-04-05T20:03:02.234Z",
      updated_at: "2019-04-05T20:06:02.234Z"
    },
    {
      id: "TRXDEMO002",
      product: "AS2IN1",
      origin: "IDR",
      target: "6011242345678",
      denom: "100.00",
      price: "96.04",
      status: "PENDING",
      data: {},
      purchased_at: "2019-04-05T19:02:02.234Z",
      updated_at: "2019-04-05T19:06:02.234Z"
    },
    {
      id: "TRXDEMO001",
      product: "AS2IN1",
      origin: "IDR",
      target: "6011242345678",
      denom: "100.00",
      price: "96.04",
      status: "FAILED",
      data: {},
      purchased_at: "2019-04-03T20:03:02.234Z",
      updated_at: "2019-04-03T20:06:02.234Z"
    }
  ];
};
