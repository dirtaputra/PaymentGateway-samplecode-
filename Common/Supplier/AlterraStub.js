const sinon = use("sinon");

class AlterraStub {
  constructor(stubTarget) {
    sinon.stub(stubTarget, "balance").callsFake(async (denom, target) => {
      console.log("stubhere");
      console.log([denom, target]);
      return {
        data: 48500000,
      };
    });

    sinon.stub(stubTarget, "getProducts").callsFake(async () => {
      console.log("stub here");
      return {
        data: [{
            product_id: "99",
            type: "mobile",
            label: "Telkomsel Rp 100.000",
            operator: "telkomsel",
            nominal: "100000",
            price: 99500,
            enabled: "1",
            field_denom: "100000.00",
          },
          {
            product_id: "6",
            type: "mobile",
            label: "Indosat Rp 100.000",
            operator: "indosat",
            nominal: "100000",
            price: "97280",
            enabled: "1",
            field_denom: "100000.00",
            field_paket_data: false,
          },
          {
            product_id: "5",
            type: "mobile",
            label: "Indosat Rp 50.000",
            operator: "indosat",
            nominal: "50000",
            price: "47280",
            enabled: "1",
            field_denom: "50000.00",
            field_paket_data: false,
          },
          {
            product_id: "1",
            type: "mobile",
            label: "Tri Rp50,000",
            operator: "tri",
            nominal: "50000",
            price: "49000",
            enabled: "1",
            field_denom: "50000.00",
            field_paket_data: false,
          },
          {
            product_id: "6",
            type: "mobile",
            label: "Indosat Rp 100.000",
            operator: "indosat",
            nominal: "100000",
            price: "100000",
            enabled: "0",
            field_denom: "100000.00",
            field_paket_data: false,
          },
          {
            product_id: "9",
            type: "mobile",
            label: "Telkomsel Rp 50,000",
            operator: "telkomsel",
            nominal: "50000",
            price: "50000",
            enabled: "1",
            field_denom: "50000.00",
            field_paket_data: false,
          },
          {
            product_id: "10",
            type: "mobile",
            label: "Telkomsel Rp 100,000",
            operator: "telkomsel",
            nominal: "100000",
            price: "100800",
            enabled: "1",
            field_denom: "100000.00",
            field_paket_data: false,
          },
          {
            product_id: "11",
            type: "mobile",
            label: "XL Rp. 50,000",
            operator: "xl",
            nominal: "50000",
            price: "50000",
            enabled: "1",
            field_denom: "50000.00",
            field_paket_data: false,
          },
          {
            product_id: "12",
            type: "mobile",
            label: "XL Rp. 1.000.000",
            operator: "xl",
            nominal: "1000000",
            price: "1000000",
            enabled: "1",
            field_denom: "1000000.00",
            field_paket_data: false,
          },
          {
            product_id: "21",
            type: "mobile",
            label: "Telkomsel Rp 5.000",
            operator: "telkomsel",
            nominal: "5000",
            price: "6000",
            enabled: "1",
            field_denom: "5000.00",
            field_paket_data: false,
          },
          {
            product_id: "22",
            type: "mobile",
            label: "Telkomsel Rp 10.000",
            operator: "telkomsel",
            nominal: "10000",
            price: "10950",
            enabled: "0",
            field_denom: "10000.00",
            field_paket_data: false,
          },
          {
            product_id: "25",
            type: "electricity",
            label: "PLN Prepaid Rp. 50,000",
            operator: "pln",
            nominal: "50000",
            price: "50000",
            enabled: "1",
          },
          {
            product_id: "26",
            type: "electricity",
            label: "PLN Prepaid Rp. 200,000",
            operator: "pln",
            nominal: "200000",
            price: "200000",
            enabled: "1",
          },
          {
            product_id: "27",
            type: "electricity",
            label: "PLN Prepaid Rp. 100,000",
            operator: "pln",
            nominal: "100000",
            price: "100000",
            enabled: "0",
          },
          {
            product_id: "31",
            type: "multi",
            label: "Mega Auto Finance",
            operator: "FNMAF",
            nominal: "0",
            price: "2000",
            enabled: "1",
          },
          {
            product_id: "32",
            type: "multi",
            label: "Mega Central Finance",
            operator: "FNMEGA",
            nominal: "0",
            price: "2000",
            enabled: "1",
          },
          {
            product_id: "33",
            type: "multi",
            label: "Wahana Ottomitra Multiartha",
            operator: "FNWOM",
            nominal: "0",
            price: "2000",
            enabled: "1",
          },
          {
            product_id: "34",
            type: "bpjs_kesehatan",
            label: "BPJS Kesehatan",
            operator: "bpjs_kesehatan",
            nominal: "2500",
            price: "2500",
            enabled: "1",
          },
          {
            product_id: "44",
            type: "game",
            label: "33 Shell / 1.000 Cash",
            operator: "garena",
            nominal: "33",
            price: "10000",
            enabled: "1",
          },
          {
            product_id: "80",
            type: "electricity_postpaid",
            label: "PLN POSTPAID",
            operator: "pln_postpaid",
            nominal: "200",
            price: "2750",
            enabled: "1",
          },
          {
            product_id: "82",
            type: "telkom_postpaid",
            label: "Telkom Postpaid",
            operator: "telkom_postpaid",
            nominal: "1",
            price: "2000",
            enabled: "1",
          },
          {
            product_id: "84",
            type: "mobile",
            label: "Pulsa Internet Telkomsel Rp25.000",
            operator: "telkomsel",
            nominal: "9910",
            price: "25000",
            enabled: "1",
            field_denom: "25000.00",
            field_paket_data: true,
          },
          {
            product_id: "87",
            type: "pdam",
            label: "PDAM",
            operator: "pdam",
            nominal: "0",
            price: "50",
            enabled: "1",
          },
          {
            product_id: "88",
            type: "mobile",
            label: "Indosat Freedom Internet Plus 1Gb",
            operator: "indosat",
            nominal: "1",
            price: "40000",
            enabled: "1",
            field_denom: "40000.00",
            field_paket_data: true,
          },
          {
            product_id: "99",
            type: "mobile",
            label: "XL Rp 100.000",
            operator: "xl",
            nominal: "100000",
            price: "100000",
            enabled: "1",
            field_denom: "100000.00",
            field_paket_data: false,
          },
          {
            product_id: "113",
            type: "mobile_postpaid",
            label: "Telkomsel Halo",
            operator: "telkomsel",
            nominal: "1000",
            price: "2050",
            enabled: "1",
          },
          {
            product_id: "124",
            type: "electricity",
            label: "PLN Prepaid Rp. 20.000",
            operator: "pln",
            nominal: "20000",
            price: "20000",
            enabled: "1",
          },
          {
            product_id: "135",
            type: "electricity",
            label: "PLN Prepaid Rp. 500,000",
            operator: "pln",
            nominal: "500000",
            price: "500000",
            enabled: "1",
          },
          {
            product_id: "136",
            type: "electricity",
            label: "PLN Prepaid Rp. 1,000,000",
            operator: "pln",
            nominal: "1000000",
            price: "1000000",
            enabled: "1",
          },
          {
            product_id: "188",
            type: "game",
            label: "Snapask 5 Questions",
            operator: "garena",
            nominal: "5",
            price: "10000",
            enabled: "1",
          },
          {
            product_id: "193",
            type: "game",
            label: "Razer PIN Rp 20.000",
            operator: "molpoint",
            nominal: "20000",
            price: "10",
            enabled: "1",
          },
        ],
      };
    });

    sinon.stub(stubTarget, "inquiry").callsFake(async (data) => {
      const {
        type,
        target
      } = data;

      if (type === "BPJS") {
        switch (target) {
          case "0000001430071801":
            return {
              status: true,
                data: {
                  "trx_type": "2100",
                  "product_type": "BPJS-KESEHATAN",
                  "stan": "90518024",
                  "premi": "51000",
                  "admin_charge": "2500",
                  "amount": "53500",
                  "datetime": "20170125123152",
                  "merchant_code": "6012",
                  "rc": "0000",
                  "no_va": "0000001430071801",
                  "periode": "01",
                  "name": "SEPULSAWATI (PST:  2)",
                  "kode_cabang": "1101",
                  "nama_cabang": "SEMARANG",
                  "sisa": "000000000000",
                  "va_count": "1",
                  "no_va_kk": "0000001430071801",
                  "trx_id": "",
                  "status": true,
                  "response_code": "00"
                }
            }

            case "0000001430071802":
              return {
                status: true,
                  data: {
                    "trx_type": "",
                    "product_type": "BPJS-KESEHATAN",
                    "stan": "825118",
                    "premi": "51000",
                    "admin_charge": "2500",
                    "amount": "53500",
                    "datetime": "20190909104633",
                    "merchant_code": "6021",
                    "no_va": "0000001430071802",
                    "no_va_kk": "0000001430071802",
                    "periode": "01",
                    "name": "ENO K (PST: 1)",
                    "va_count": "1",
                    "kode_cabang": "0901",
                    "nama_cabang": "Jakarta Pusat",
                    "sisa": "000000000000",
                    "sw_reff": "825118",
                    "kode_loket": "HTH16010028",
                    "nama_loket": "PT SEPULSA TEKNOLOGI INDONESIA",
                    "alamat_loket": "Jakarta",
                    "phone_loket": "08129753113",
                    "kode_kab_kota": "3171",
                    "status": true,
                    "response_code": "00",
                    "message": "Success",
                    "rc": "00",
                    "trx_id": ""
                  }
              }

              default:
                return {
                  status: false,
                    data: {
                      "status": false,
                      "response_code": "20",
                      "message": "Failed",
                      "rc": "20",
                      "trx_id": "",
                      "desc": "Failed",
                    }
                }
        }
      }

      if (type === "PLNBILL") {
        switch (target) {
          case "512345610000":
            return {
              status: true,
                data: {
                  "amount": "100000",
                  "admin_charge": "1600",
                  "trx_id": "",
                  "stan": "000000084849",
                  "datetime": "20161004151947",
                  "merchant_code": "6021",
                  "bank_code": "4510017",
                  "rc": "0000",
                  "terminal_id": "0000000000000048",
                  "material_number": "",
                  "subscriber_id": "512345600003",
                  "subscriber_name": "SEWATI",
                  "switcher_refno": "0SYM212162998631447328B515061028",
                  "subscriber_segmentation": "R1",
                  "power": 900,
                  "outstanding_bill": "0",
                  "bill_status": "1",
                  "blth_summary": "JAN17",
                  "stand_meter_summary": "00027135 - 00027588",
                  "bills": [{
                    "bill_period": "201103",
                    "produk": "PLNPOSTPAID",
                    "due_date": "20100220",
                    "meter_read_date": "00000000",
                    "total_electricity_bill": "00000040500",
                    "incentive": "00000000000",
                    "value_added_tax": "0000000000",
                    "penalty_fee": "000000000",
                    "previous_meter_reading1": "00017822",
                    "current_meter_reading1": "00017915",
                    "previous_meter_reading2": "00000000",
                    "current_meter_reading2": "00000000",
                    "previous_meter_reading3": "00000000",
                    "current_meter_reading3": "00000000"
                  }],
                  "status": true,
                  "response_code": "00"
                }
            }

            case "512345600003":
              return {
                status: true,
                  data: {
                    "trx_id": "",
                    "stan": "000000084849",
                    "amount": "300000",
                    "datetime": "20161004151947",
                    "merchant_code": "6021",
                    "bank_code": "4510017",
                    "rc": "0000",
                    "terminal_id": "0000000000000048",
                    "material_number": "",
                    "subscriber_id": "512345600003",
                    "subscriber_name": "ABDUL GHALIB",
                    "switcher_refno": "0SYM212162998631447328B515061028",
                    "subscriber_segmentation": "R1",
                    "power": 900,
                    "admin_charge": "4800",
                    "outstanding_bill": "0",
                    "bill_status": "3",
                    "blth_summary": "DES09, JAN10, FEB10",
                    "stand_meter_summary": "00027135 - 00027588",
                    "bills": [{
                        "bill_period": "200912",
                        "produk": "PLNPOSTPAID",
                        "due_date": "20091221",
                        "meter_read_date": "00000000",
                        "total_electricity_bill": "00000085875",
                        "incentive": "00000000000",
                        "value_added_tax": "0000000000",
                        "penalty_fee": "000016000",
                        "previous_meter_reading1": "00027135",
                        "current_meter_reading1": "00027280",
                        "previous_meter_reading2": "00000000",
                        "current_meter_reading2": "00000000",
                        "previous_meter_reading3": "00000000",
                        "current_meter_reading3": "00000000"
                      },
                      {
                        "bill_period": "201001",
                        "produk": "PLNPOSTPAID",
                        "due_date": "20100122",
                        "meter_read_date": "00000000",
                        "total_electricity_bill": "00000088935",
                        "incentive": "00000000000",
                        "value_added_tax": "0000000000",
                        "penalty_fee": "000000000",
                        "previous_meter_reading1": "00027280",
                        "current_meter_reading1": "00027431",
                        "previous_meter_reading2": "00000000",
                        "current_meter_reading2": "00000000",
                        "previous_meter_reading3": "00000000",
                        "current_meter_reading3": "00000000"
                      },
                      {
                        "bill_period": "201002",
                        "produk": "PLNPOSTPAID",
                        "due_date": "20100220",
                        "meter_read_date": "00000000",
                        "total_electricity_bill": "00000091995",
                        "incentive": "00000000000",
                        "value_added_tax": "0000000000",
                        "penalty_fee": "000000000",
                        "previous_meter_reading1": "00027431",
                        "current_meter_reading1": "00027588",
                        "previous_meter_reading2": "00000000",
                        "current_meter_reading2": "00000000",
                        "previous_meter_reading3": "00000000",
                        "current_meter_reading3": "00000000"
                      }
                    ],
                    "status": true,
                    "response_code": "00"
                  }
              }

              default:
                return {
                  status: false,
                    data: {
                      "trx_id": "",
                      "rc": "0014",
                      "status": false,
                      "response_code": "20",
                      "message": "NOMOR METER/IDPEL YANG ANDA MASUKKAN SALAH, MOHON TELITI KEMBALI."
                    }
                }

        }
      }

      if (target === "01428800700") {
        return {
          status: true,
          data: {
            admin_charge: 0,
            trx_id: "",
            stan: "590723",
            datetime: "20190603140809",
            terminal_id: "JTL53L3",
            material_number: "01428800700",
            subscriber_id: "547104409005",
            pln_refno: "DC0C67631AECC99BA083FED0EA5E387E",
            switcher_refno: "0509C2E088DFC1DAD1AEDC5B4C01E54D",
            subscriber_name: "SEWATI",
            subscriber_segmentation: "R1",
            power: 1300,
            distribution_code: "51",
            service_unit: "51106",
            service_unit_phone: "021222222      ",
            max_kwh_unit: "06000",
            total_repeat: "0",
            power_purchase_unsold: "0",
            power_purchase_unsold2: "0",
            merchant_code: "6021",
            bank_code: "008",
            rc: "0000",
            status: true,
            response_code: "00",
          },
        };
      } else if (target === "01428800701") {
        return {
          status: false,
          data: {
            response_code: "20",
            message: "IDPEL YANG ANDA MASUKKAN SALAH, MOHON TELITI KEMBALI",
          },
        };
      } else {
        return {
          status: false,
          data: {
            response_code: "20",
            message: "IDPEL YANG ANDA MASUKKAN SALAH, MOHON TELITI KEMBALI",
          },
        };
      }
      //console.log("stubhere");
    });

    sinon.stub(stubTarget, "transaction").callsFake(async (data) => {
      console.log(data);
      const {
        type,
        target
      } = data;

      if (type === "BPJS") {
        switch (target) {
          case "0000001430071801":
            return {
              status: "success",
                data: {
                  "transaction_id": "1",
                  "type": "bpjs_kesehatan",
                  "created": "1473332820",
                  "changed": "1473332820",
                  "customer_number": "08123456789",
                  "order_id": "ORDER-001",
                  "price": "5000",
                  "status": "success",
                  "response_code": "00",
                  "serial_number": "",
                  "amount": "0",
                  "product_id": {
                    "product_id": "99",
                    "type": "bpjs_kesehatan",
                    "label": "BPJS Kesehatan",
                    "operator": "BPJS",
                    "nominal": "0",
                    "price": 2000,
                    "enabled": "1"
                  },
                  "payment_period": "01",
                  "data": ""
                }
            }

            case "0000001430071802":
              return {
                status: "failed",
                  data: {
                    "transaction_id": "38690",
                    "type": "bpjs_kesehatan",
                    "created": "1568001096",
                    "changed": "1568001096",
                    "customer_number": "0000001430071802",
                    "product_id": {
                      "product_id": "34",
                      "type": "bpjs_kesehatan",
                      "label": "BPJS Kesehatan",
                      "operator": "bpjs_kesehatan",
                      "nominal": "2500",
                      "price": 2500,
                      "enabled": "1"
                    },
                    "order_id": "ORDER-111",
                    "price": "53500",
                    "status": "failed",
                    "response_code": "21",
                    "payment_period": "01",
                    "serial_number": null,
                    "amount": "53500",
                    "token": null,
                    "data": null
                  }
              }
        }
      }

      if (type === "PLNBILL") {
        switch (target) {
          case "512345610000":
            return {
              status: "success",
                data: {
                  "transaction_id": "1",
                  "type": "electricity_postpaid",
                  "created": "1473332820",
                  "changed": "1473332820",
                  "customer_number": "512345610000",
                  "order_id": "ORDER-001",
                  "price": "100000",
                  "status": "success",
                  "response_code": "00",
                  "serial_number": "1234567890",
                  "amount": "0",
                  "product_id": {
                    "product_id": "99",
                    "type": "electricity_postpaid",
                    "label": "PLN Postpaid",
                    "operator": "PLN",
                    "nominal": "0",
                    "price": "2000",
                    "enabled": "1"
                  },
                  "data": {
                    "amount": "136856",
                    "admin_charge": "1600",
                    "trx_id": "",
                    "stan": "000000084849",
                    "datetime": "20161004151947",
                    "merchant_code": "6021",
                    "bank_code": "4510017",
                    "rc": "0000",
                    "terminal_id": "0000000000000048",
                    "material_number": "",
                    "subscriber_id": "512345600003",
                    "subscriber_name": "SEPULSAWATI",
                    "switcher_refno": "0SYM212162998631447328B515061028",
                    "subscriber_segmentation": "R1",
                    "power": 900,
                    "outstanding_bill": "0",
                    "bill_status": "1",
                    "blth_summary": "JAN17",
                    "stand_meter_summary": "00027135 - 00027588",
                    "bills": [{
                      "bill_period": [
                        "201103"
                      ],
                      "due_date": [
                        "20100220"
                      ],
                      "meter_read_date": [
                        "00000000"
                      ],
                      "total_electricity_bill": [
                        "00000040500"
                      ],
                      "incentive": [
                        "00000000000"
                      ],
                      "value_added_tax": [
                        "0000000000"
                      ],
                      "penalty_fee": [
                        "000000000"
                      ],
                      "previous_meter_reading1": [
                        "00017822"
                      ],
                      "current_meter_reading1": [
                        "00017915"
                      ],
                      "previous_meter_reading2": [
                        "00000000"
                      ],
                      "current_meter_reading2": [
                        "00000000"
                      ],
                      "previous_meter_reading3": [
                        "00000000"
                      ],
                      "current_meter_reading3": [
                        "00000000"
                      ]
                    }],
                    "payment_status": "1",
                    "payment_date": "20170422",
                    "payment_time": "132944",
                    "pln_refno": "FBCDB3A48BAC49AF992B5AD6CAF6CBAA",
                    "service_unit": "53511",
                    "service_unit_phone": "123",
                    "info_text": "Informasi Hubungi Call Center 123 Atau Hub PLN Terdekat"
                  }
                }
            }

            case "512345600003":
              return {
                status: "success",
                  data: {
                    "transaction_id": "1",
                    "type": "electricity_postpaid",
                    "created": "1473332820",
                    "changed": "1473332820",
                    "customer_number": "512345610000",
                    "order_id": "ORDER-002",
                    "price": "5000",
                    "status": "success",
                    "response_code": "00",
                    "serial_number": "1234567890",
                    "amount": "0",
                    "product_id": {
                      "product_id": "99",
                      "type": "electricity_postpaid",
                      "label": "PLN Postpaid",
                      "operator": "PLN",
                      "nominal": "0",
                      "price": "2000",
                      "enabled": "1"
                    },
                    "data": {
                      "amount": "136856",
                      "admin_charge": "1600",
                      "trx_id": "",
                      "stan": "000000084849",
                      "datetime": "20161004151947",
                      "merchant_code": "6021",
                      "bank_code": "4510017",
                      "rc": "0000",
                      "terminal_id": "0000000000000048",
                      "material_number": "",
                      "subscriber_id": "512345600003",
                      "subscriber_name": "SEPULSAWATI 2",
                      "switcher_refno": "0SYM212162998631447328B515061028",
                      "subscriber_segmentation": "R1",
                      "power": 900,
                      "outstanding_bill": "0",
                      "bill_status": "1",
                      "blth_summary": "JAN17",
                      "stand_meter_summary": "00027135 - 00027588",
                      "bills": [{
                        "bill_period": [
                          "201103"
                        ],
                        "due_date": [
                          "20100220"
                        ],
                        "meter_read_date": [
                          "00000000"
                        ],
                        "total_electricity_bill": [
                          "00000040500"
                        ],
                        "incentive": [
                          "00000000000"
                        ],
                        "value_added_tax": [
                          "0000000000"
                        ],
                        "penalty_fee": [
                          "000000000"
                        ],
                        "previous_meter_reading1": [
                          "00017822"
                        ],
                        "current_meter_reading1": [
                          "00017915"
                        ],
                        "previous_meter_reading2": [
                          "00000000"
                        ],
                        "current_meter_reading2": [
                          "00000000"
                        ],
                        "previous_meter_reading3": [
                          "00000000"
                        ],
                        "current_meter_reading3": [
                          "00000000"
                        ]
                      }],
                      "payment_status": "1",
                      "payment_date": "20170422",
                      "payment_time": "132944",
                      "pln_refno": "FBCDB3A48BAC49AF992B5AD6CAF6CBAA",
                      "service_unit": "53511",
                      "service_unit_phone": "123",
                      "info_text": "Informasi Hubungi Call Center 123 Atau Hub PLN Terdekat"
                    }
                  }
              }
        }
      }

      if (type === "PLN") {
        if (data.target === "01428800700") {
          return {
            status: "success",
            data: {
              transaction_id: "12075",
              type: "electricity",
              created: "1559546264",
              changed: "1559546264",
              customer_number: "08123456789",
              product_id: {
                product_id: "25",
                type: "electricity",
                label: "PLN Prepaid Rp. 50,000",
                operator: "pln",
                nominal: "50000",
                price: 50000,
                enabled: "1",
              },
              order_id: "ORDER-011",
              price: "50000",
              status: "success",
              response_code: "00",
              serial_number: null,
              amount: "100000",
              meter_number: "01428800700",
              token: "764876345",
              data: null,
            },
          };
        } else if (data.target === "01428800701") {
          return {
            status: "success",
            data: {
              transaction_id: "12075",
              type: "electricity",
              created: "1559546264",
              changed: "1559546264",
              customer_number: "08123456789",
              product_id: {
                product_id: "25",
                type: "electricity",
                label: "PLN Prepaid Rp. 100,000",
                operator: "pln",
                nominal: "100000.00",
                price: "100000.00",
                enabled: "1",
              },
              order_id: "ORDER-011",
              price: "100000",
              status: "success",
              response_code: "00",
              serial_number: null,
              amount: "100000",
              meter_number: "01428800701",
              token: "486597634576",
              data: null,
            },
          };
        } else if (data.target === "01428800702") {
          return {
            status: "failed",
            data: {
              transaction_id: "12075",
              type: "electricity",
              created: "1559546264",
              changed: "1559546264",
              customer_number: "08123456789",
              product_id: {
                product_id: "25",
                type: "electricity",
                label: "PLN Prepaid Rp. 100,000",
                operator: "pln",
                nominal: "100000.00",
                price: "100000.00",
                enabled: "1",
              },
              order_id: "ORDER-011",
              price: "100000",
              status: "failed",
              response_code: "99",
              serial_number: null,
              amount: "100000",
              meter_number: "01428800702",
              token: null,
              data: null,
            },
          };
        } else if (data.target === "01428800703") {
          return {
            status: "failed",
            data: {
              transaction_id: "12075",
              type: "electricity",
              created: "1559546264",
              changed: "1559546264",
              customer_number: "08123456789",
              product_id: {
                product_id: "25",
                type: "electricity",
                label: "PLN Prepaid Rp. 50,000",
                operator: "pln",
                nominal: "50000.00",
                price: "50000.00",
                enabled: "1",
              },
              order_id: "ORDER-011",
              price: "50000",
              status: "failed",
              response_code: "99",
              serial_number: null,
              amount: "50000",
              meter_number: "01428800703",
              token: null,
              data: null,
            },
          };
        }
      } else if (data.type === "MOBILE") {
        switch (data.target) {
          case "081234567891":
            return {
              status: "success",
                data: {
                  transaction_id: "12071",
                  type: "mobile",
                  created: "1559546264",
                  changed: "1559546264",
                  customer_number: "081234567891",
                  product_id: {
                    product_id: "35",
                    type: "mobile",
                    label: "TSEL Prepaid Rp. 100,000",
                    operator: "tsel",
                    nominal: "10000.00",
                    price: "10000.00",
                    enabled: "1",
                  },
                  order_id: "ORDER-011",
                  price: "10000",
                  status: "success",
                  response_code: "00",
                  serial_number: null,
                  amount: "10000",
                  token: null,
                  data: null,
                },
            };

          case "085706749886":
            return {
              status: "success",
                data: {
                  transaction_id: "12075",
                  type: "mobile",
                  created: "1559546264",
                  changed: "1559546264",
                  customer_number: "08123456789",
                  product_id: {
                    product_id: "35",
                    type: "mobile",
                    label: "ISAT pinless topup Rp. 100,000",
                    operator: "ISAT",
                    nominal: "100000.00",
                    price: "100000.00",
                    enabled: "1",
                  },
                  order_id: "ORDER-011",
                  price: "50000",
                  status: "success",
                  response_code: "00",
                  serial_number: null,
                  amount: "100000",
                  //meter_number: "01428800700",
                  token: null,
                  data: null,
                },
            };

          case "085706749887":
            return {
              status: "failed",
                data: {
                  transaction_id: "12075",
                  type: "mobile",
                  created: "1559546264",
                  changed: "1559546264",
                  customer_number: "08123456789",
                  product_id: {
                    product_id: "35",
                    type: "mobile",
                    label: "ISAT pinless topup Rp. 100,000",
                    operator: "ISAT",
                    nominal: "100000.00",
                    price: "100000.00",
                    enabled: "1",
                  },
                  order_id: "ORDER-011",
                  price: "100000",
                  status: "success",
                  response_code: "99",
                  serial_number: null,
                  amount: "100000",
                  // meter_number: "01428800700",
                  token: null,
                  data: null,
                },
            };

          case "083123456789":
            return {
              status: "success",
                data: {
                  transaction_id: "12075",
                  type: "mobile",
                  created: "1559546264",
                  changed: "1559546264",
                  customer_number: "08123456789",
                  product_id: {
                    product_id: "35",
                    type: "mobile",
                    label: "Axis Pinless Topup",
                    operator: "axis",
                    nominal: "100000.00",
                    price: "100000.00",
                    enabled: "1",
                  },
                  order_id: "ORDER-011",
                  price: "-",
                  status: "success",
                  response_code: "00",
                  serial_number: null,
                  amount: "100000",
                  //meter_number: "01428800700",
                  token: null,
                  data: null,
                },
            };

          case "083123456788":
            return {
              status: "failed",
                data: {
                  transaction_id: "12075",
                  type: "mobile",
                  created: "1559546264",
                  changed: "1559546264",
                  customer_number: "08123456789",
                  product_id: {
                    product_id: "35",
                    type: "mobile",
                    label: "ISAT Prepaid Rp. 100,000",
                    operator: "pln",
                    nominal: "100000.00",
                    price: "100000.00",
                    enabled: "1",
                  },
                  order_id: "ORDER-011",
                  price: "100000",
                  status: "success",
                  response_code: "99",
                  serial_number: null,
                  amount: "100000",
                  // meter_number: "01428800700",
                  token: null,
                  data: null,
                },
            };
        }
      }
    });

    sinon.stub(stubTarget, "transDetail").callsFake(async () => {
      throw new Error("Stub enforce to Pending");
    });
  }
}

module.exports = AlterraStub;
