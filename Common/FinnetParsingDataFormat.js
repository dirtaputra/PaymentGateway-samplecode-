"use strict";

class FinnetParsingDataFormat {
  async PLNPostpaid() {
    return {
      "max_repeat": 4,
      "inquiryPayment": [{
          "field": "Nomor Pelanggan",
          "length": 13
        },
        {
          "field": "Kode PLN Postpaid",
          "length": 6
        },
        {
          "field": "Bill",
          "length": 2
        },
        {
          "field": "PLNreferencenumber",
          "length": 32
        },
        {
          "field": "SW reference number",
          "length": 32
        },
        {
          "field": "Nama Pelanggan",
          "length": 25
        },
        {
          "field": "Subscriber Segmen",
          "length": 4
        },
        {
          "field": "Power",
          "length": 9
        },
        {
          "field": "Kode UP",
          "length": 15
        },
        {
          "field": "Telpon UP",
          "length": 15
        }
      ],
      "repeatedly": [{
          "field": "Periode",
          "length": 8
        },
        {
          "field": "TanggalAkhirPeriode",
          "length": 8
        },
        {
          "field": "TanggalBacaMeter",
          "length": 8
        },
        {
          "field": "TagihanListrik",
          "length": 12
        },
        {
          "field": "Insentif",
          "length": 12
        },
        {
          "field": "PPN",
          "length": 12
        },
        {
          "field": "Denda",
          "length": 12
        },
        {
          "field": "MeterLalu",
          "length": 12
        },
        {
          "field": "MeterKini",
          "length": 12
        },
        {
          "field": "Total",
          "length": 12
        }
      ],
      "payment": [{
        "field": "InqReff",
        "length": 32
      }, {
        "field": "Info",
        "length": 100
      }]
    }
  }

  async PLNPrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Pelanggan",
          "length": 13
        },
        {
          "field": "Kode PLN Prepaid",
          "length": 6
        },
        {
          "field": "Bill",
          "length": 1
        },
        {
          "field": "PLN Ref Number",
          "length": 32
        },
        {
          "field": "SW Ref Number",
          "length": 32
        },
        {
          "field": "Meter ID",
          "length": 11
        },
        {
          "field": "Subscriber ID",
          "length": 12
        },
        {
          "field": "Nama Pelanggan",
          "length": 25
        },
        {
          "field": "Subscriber Segmen",
          "length": 4
        },
        {
          "field": "Power",
          "length": 9
        },
        {
          "field": "DistCode",
          "length": 2
        },
        {
          "field": "Kode UP",
          "length": 5
        },
        {
          "field": "Telpon UP",
          "length": 15
        },
        {
          "field": "Maksimal KWH",
          "length": 9
        },
        {
          "field": "Periode",
          "length": 8
        },
        {
          "field": "Tagihan",
          "length": 12
        },
        {
          "field": "Total Tagihan",
          "length": 12
        },
        {
          "field": "Total FEE",
          "length": 12
        },
        {
          "field": "Unsold",
          "length": 1
        },
        {
          "field": "Unsold1",
          "length": 12
        },
        {
          "field": "Unsold2",
          "length": 12
        }
      ],
      "repeatedly": [],
      "payment": [{
        "field": "Administrasi PLN",
        "length": 12
      }, {
        "field": "Materai",
        "length": 12
      }, {
        "field": "PPN",
        "length": 12
      }, {
        "field": "PPJ",
        "length": 12
      }, {
        "field": "Angsuran",
        "length": 12
      }, {
        "field": "Harga Listrik",
        "length": 12
      }, {
        "field": "Jumlah KWH",
        "length": 11
      }, {
        "field": "Token",
        "length": 20
      }, {
        "field": "Inq Reff",
        "length": 32
      }, {
        "field": "Info",
        "length": 100
      }]
    }
  }

  async BPJS() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor pelanggan",
          "length": 20
        },
        {
          "field": "Jumlah Bulan",
          "length": 2
        },
        {
          "field": "Kode Cabang",
          "length": 5
        },
        {
          "field": "Nama Cabang",
          "length": 30
        },
        {
          "field": "Nama Pelanggan",
          "length": 50
        },
        {
          "field": "Premi",
          "length": 12
        },
        {
          "field": "Saldo",
          "length": 12
        },
        {
          "field": "Nomor Telepon",
          "length": 15
        }
      ],
      "repeatedly": [],
      "payment": [{
          "field": "Nomor pelanggan",
          "length": 20
        },
        {
          "field": "Jumlah Bulan",
          "length": 2
        },
        {
          "field": "Kode Cabang",
          "length": 5
        },
        {
          "field": "Nama Cabang",
          "length": 30
        },
        {
          "field": "Nama Pelanggan",
          "length": 50
        },
        {
          "field": "Premi",
          "length": 12
        },
        {
          "field": "Saldo",
          "length": 12
        },
        {
          "field": "Nomor Telepon",
          "length": 15
        },
        {
          "field": "ID Transaksi",
          "length": 18
        }
      ]
    }
  }

  // async BPJSKeluarga() {
  //   return {
  //     "max_repeat": 0,
  //     "inquiryPayment": [{
  //         "field": "Nomor pelanggan",
  //         "length": 20
  //       },
  //       {
  //         "field": "Jumlah Bulan",
  //         "length": 2
  //       },
  //       {
  //         "field": "Kode Cabang",
  //         "length": 5
  //       },
  //       {
  //         "field": "Nama Cabang",
  //         "length": 30
  //       },
  //       {
  //         "field": "Nama Pelanggan",
  //         "length": 50
  //       },
  //       {
  //         "field": "Premi",
  //         "length": 12
  //       },
  //       {
  //         "field": "Saldo",
  //         "length": 12
  //       },
  //       {
  //         "field": "Nomor Telepon",
  //         "length": 15
  //       }
  //     ],
  //     "repeatInquiryPayment": [],
  //     "payment": [{
  //         "field": "Nomor pelanggan",
  //         "length": 20
  //       },
  //       {
  //         "field": "Jumlah Bulan",
  //         "length": 2
  //       },
  //       {
  //         "field": "Kode Cabang",
  //         "length": 5
  //       },
  //       {
  //         "field": "Nama Cabang",
  //         "length": 30
  //       },
  //       {
  //         "field": "Nama Pelanggan",
  //         "length": 50
  //       },
  //       {
  //         "field": "Premi",
  //         "length": 12
  //       },
  //       {
  //         "field": "Saldo",
  //         "length": 12
  //       },
  //       {
  //         "field": "Nomor Telepon",
  //         "length": 15
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       }
  //     ],
  //     "repeatPayment": [{
  //         "field": "ID Transaksi",
  //         "length": 18
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       },
  //       {
  //         "field": "ID Transaksi",
  //         "length": 18
  //       }
  //     ]
  //   }
  // }

  async TelkomselPrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Handphone",
          "length": 13
        },
        {
          "field": "Kode telkomsel",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "Window Period",
          "length": 11
        },
        {
          "field": "Nilai Pulsa",
          "length": 12
        },
        {
          "field": "Voucher Serial Pulsa",
          "length": 16
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }

  async TelkomselHalo() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Pelanggan",
          "length": 13
        },
        {
          "field": "Kode Kartu HALO",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "Bill Reference",
          "length": 11
        },
        {
          "field": "Nilai Tagihan",
          "length": 12
        },
        {
          "field": "Nama Pelanggan",
          "length": 45
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }

  async IndosatPrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Handphone",
          "length": 13
        },
        {
          "field": "Kode Indosat Prepaid",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "Window Period",
          "length": 11
        },
        {
          "field": "Nilai Pulsa",
          "length": 12
        },
        {
          "field": "Voucher Serial Pulsa",
          "length": 9
        },
        {
          "field": "Nomor Resi",
          "length": 12
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }

  async XLPrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Handphone",
          "length": 13
        },
        {
          "field": "Kode XL Prepaid",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "Window Period",
          "length": 11
        },
        {
          "field": "Nilai Pulsa",
          "length": 12
        },
        {
          "field": "Voucher Serial Pulsa",
          "length": 16
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }

  async ThreePrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Handphone",
          "length": 13
        },
        {
          "field": "Kode Three Prepaid",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "Window Period",
          "length": 11
        },
        {
          "field": "Nilai Pulsa",
          "length": 12
        },
        {
          "field": "Voucher Serial Pulsa",
          "length": 16
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }

  async SmartfrenPrepaid() {
    return {
      "max_repeat": 0,
      "inquiryPayment": [{
          "field": "Nomor Handphone",
          "length": 13
        },
        {
          "field": "Kode Smartfren Prepaid",
          "length": 6
        },
        {
          "field": "Jumlah Tagihan",
          "length": 1
        },
        {
          "field": "RefID",
          "length": 32
        },
        {
          "field": "Nilai Pulsa",
          "length": 12
        },
        {
          "field": "Voucher Serial Pulsa",
          "length": 18
        }
      ],
      "repeatedly": [],
      "payment": []
    }
  }
}

module.exports = new FinnetParsingDataFormat();
