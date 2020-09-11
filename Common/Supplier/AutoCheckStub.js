const sinon = use("sinon");

class AutoCheckStub {
  constructor(stubTarget) {
    sinon.stub(stubTarget, "alterraProduct").callsFake(async () => {
      return {
        data: {
          data: [{
              "product_id": "1",
              "type": "mobile",
              "label": "Tri Rp50,000",
              "operator": "tri",
              "nominal": "50000",
              "price": "49000",
              "enabled": "1",
              "field_denom": "50000.00",
              "field_paket_data": false
            },
            {
              product_id: "5",
              type: "mobile",
              label: "Indosat Rp 50.000",
              operator: "indosat",
              nominal: "50000",
              price: "50000",
              enabled: "1",
              field_denom: "50000.00",
              field_paket_data: false
            },
            {
              product_id: "6",
              type: "mobile",
              label: "Indosat Rp 100.000",
              operator: "indosat",
              nominal: "100000",
              price: "100000",
              enabled: "1",
              field_denom: "100000.00",
              field_paket_data: false
            },
            {
              "product_id": "9",
              "type": "mobile",
              "label": "Telkomsel Rp 50,000",
              "operator": "telkomsel",
              "nominal": "50000",
              "price": "50000",
              "enabled": "1",
              "field_denom": "50000.00",
              "field_paket_data": false
            },
            {
              "product_id": "10",
              "type": "mobile",
              "label": "Telkomsel Rp 100,000",
              "operator": "telkomsel",
              "nominal": "100000",
              "price": "100800",
              "enabled": "1",
              "field_denom": "100000.00",
              "field_paket_data": false
            },
            {
              "product_id": "11",
              "type": "mobile",
              "label": "XL Rp. 50,000",
              "operator": "xl",
              "nominal": "50000",
              "price": "50000",
              "enabled": "1",
              "field_denom": "50000.00",
              "field_paket_data": false
            },
            {
              "product_id": "12",
              "type": "mobile",
              "label": "XL Rp. 1.000.000",
              "operator": "xl",
              "nominal": "1000000",
              "price": "1000000",
              "enabled": "1",
              "field_denom": "1000000.00",
              "field_paket_data": false
            },
            {
              "product_id": "21",
              "type": "mobile",
              "label": "Telkomsel Rp 5.000",
              "operator": "telkomsel",
              "nominal": "5000",
              "price": "6000",
              "enabled": "1",
              "field_denom": "5000.00",
              "field_paket_data": false
            },
            {
              "product_id": "22",
              "type": "mobile",
              "label": "Telkomsel Rp 10.000",
              "operator": "telkomsel",
              "nominal": "10000",
              "price": "10950",
              "enabled": "0",
              "field_denom": "10000.00",
              "field_paket_data": false
            },
            {
              "product_id": "25",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 50,000",
              "operator": "pln",
              "nominal": "50000",
              "price": "50000",
              "enabled": "1"
            },
            {
              "product_id": "26",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 200,000",
              "operator": "pln",
              "nominal": "200000",
              "price": "200000",
              "enabled": "1"
            },
            {
              "product_id": "27",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 100,000",
              "operator": "pln",
              "nominal": "100000",
              "price": "100000",
              "enabled": "0"
            },
            {
              "product_id": "31",
              "type": "multi",
              "label": "Mega Auto Finance",
              "operator": "FNMAF",
              "nominal": "0",
              "price": "2000",
              "enabled": "1"
            },
            {
              "product_id": "32",
              "type": "multi",
              "label": "Mega Central Finance",
              "operator": "FNMEGA",
              "nominal": "0",
              "price": "2000",
              "enabled": "1"
            },
            {
              "product_id": "33",
              "type": "multi",
              "label": "Wahana Ottomitra Multiartha",
              "operator": "FNWOM",
              "nominal": "0",
              "price": "2000",
              "enabled": "1"
            },
            {
              "product_id": "34",
              "type": "bpjs_kesehatan",
              "label": "BPJS Kesehatan",
              "operator": "bpjs_kesehatan",
              "nominal": "2500",
              "price": "2500",
              "enabled": "1"
            },
            {
              "product_id": "44",
              "type": "game",
              "label": "33 Shell / 1.000 Cash",
              "operator": "garena",
              "nominal": "33",
              "price": "10000",
              "enabled": "1"
            },
            {
              "product_id": "80",
              "type": "electricity_postpaid",
              "label": "PLN POSTPAID",
              "operator": "pln_postpaid",
              "nominal": "200",
              "price": "2750",
              "enabled": "1"
            },
            {
              "product_id": "82",
              "type": "telkom_postpaid",
              "label": "Telkom Postpaid",
              "operator": "telkom_postpaid",
              "nominal": "1",
              "price": "2000",
              "enabled": "1"
            },
            {
              "product_id": "84",
              "type": "mobile",
              "label": "Pulsa Internet Telkomsel Rp25.000",
              "operator": "telkomsel",
              "nominal": "9910",
              "price": "25000",
              "enabled": "1",
              "field_denom": "25000.00",
              "field_paket_data": true
            },
            {
              "product_id": "87",
              "type": "pdam",
              "label": "PDAM",
              "operator": "pdam",
              "nominal": "0",
              "price": "50",
              "enabled": "1"
            },
            {
              "product_id": "88",
              "type": "mobile",
              "label": "Indosat Freedom Internet Plus 1Gb",
              "operator": "indosat",
              "nominal": "1",
              "price": "40000",
              "enabled": "1",
              "field_denom": "40000.00",
              "field_paket_data": true
            },
            {
              "product_id": "99",
              "type": "mobile",
              "label": "XL Rp 100.000",
              "operator": "xl",
              "nominal": "100000",
              "price": "100000",
              "enabled": "1",
              "field_denom": "100000.00",
              "field_paket_data": false
            },
            {
              "product_id": "113",
              "type": "mobile_postpaid",
              "label": "Telkomsel Halo",
              "operator": "telkomsel",
              "nominal": "1000",
              "price": "2050",
              "enabled": "1"
            },
            {
              "product_id": "124",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 20.000",
              "operator": "pln",
              "nominal": "20000",
              "price": "20000",
              "enabled": "1"
            },
            {
              "product_id": "135",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 500,000",
              "operator": "pln",
              "nominal": "500000",
              "price": "500000",
              "enabled": "1"
            },
            {
              "product_id": "136",
              "type": "electricity",
              "label": "PLN Prepaid Rp. 1,000,000",
              "operator": "pln",
              "nominal": "1000000",
              "price": "1000000",
              "enabled": "1"
            },
            {
              "product_id": "188",
              "type": "game",
              "label": "Snapask 5 Questions",
              "operator": "garena",
              "nominal": "5",
              "price": "10000",
              "enabled": "1"
            },
            {
              "product_id": "193",
              "type": "game",
              "label": "Razer PIN Rp 20.000",
              "operator": "molpoint",
              "nominal": "20000",
              "price": "10",
              "enabled": "1"
            }
          ]
        }
      }
    });

  }
}

module.exports = AutoCheckStub;
