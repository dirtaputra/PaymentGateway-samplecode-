'use strict'

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

const Map = use("App/Models/Map");
const User = use("App/Models/User");
const Database = use("Database");
const Env = use("Env");
const Cache = use("Cache");
const numeral = require("numeral");
class MapController {
  async index({
    request,
    response,
    view
  }) {
    const param = request.get().param;
    let user;
    if (param) {
      user = (await Map
        .query()
        .where('user_id', param)
        .with('user')
        .fetch()
      ).toJSON();
    }

    const userData = await User.getCount();
    var balance = new Array();
    for (var i = 0; i < userData; i++) {
      let redisData = (await Cache.get(i)) || 0;
      balance[i] = redisData;
    }

    const geo = (await Map
      .query()
      .select('geolocation', 'email', 'fullname', 'appversion', 'platform', 'msisdn', 'users.id',
        Database.raw(`
        CASE
          WHEN is_salesforce = false THEN 'No'
          ELSE 'Yes'
        END 
        AS is_salesforce
      `))
      .leftJoin('users', 'users.id', 'maps.user_id')
      .fetch()).toJSON();

    const res = geo.map((data, index, array) => {
      let obj_redis = balance.find(el => el.id === data.id);
      let redis_balance = obj_redis ? obj_redis.amount : 0;
      return {
        param: data.id,
        email: data.email,
        fullname: data.fullname,
        geolocation: data.geolocation,
        appversion: data.appversion,
        platform: data.platform,
        msisdn: data.msisdn,
        is_salesforce: data.is_salesforce,
        balance: numeral(redis_balance).format("0,0.00"),
      };
    });

    return view.render('pages.maps', {
      geo: res,
      zoom: param ? 15 : 5,
      apiMap: Env.get("API_MAPS"),
      center: param ? user[0].geolocation : {lat: 0.886015, lng:110.151565}
    });
  }

  async create({
    request,
    response,
    view
  }) {}

  async store_dummy({
    request,
    response
  }) {
    const ps = [{
        lat: 5.411229,
        lng: 100.335426
      },
      {
        lat: 3.166667,
        lng: 101.7
      },
      {
        lat: 1.4655,
        lng: 103.7578
      },
      {
        lat: 5.399102,
        lng: 100.363818
      },
      {
        lat: 2.196,
        lng: 102.2405
      },
      {
        lat: 4.5841,
        lng: 101.0829
      },
      {
        lat: 1.416667,
        lng: 110.333333
      },
      {
        lat: 5.9749,
        lng: 116.0724
      },
      {
        lat: 6.116667,
        lng: 102.216667
      },
      {
        lat: 3.083333,
        lng: 101.533333
      },
      {
        lat: 5.8402,
        lng: 118.1179
      },
      {
        lat: 2.702,
        lng: 101.9655
      },
      {
        lat: 3.8077,
        lng: 103.326
      },
      {
        lat: 5.615259,
        lng: 100.468041
      },
      {
        lat: 5.3302,
        lng: 103.1408
      },
      {
        lat: 6.121045,
        lng: 100.360137
      },
      {
        lat: 4.2498,
        lng: 117.8871
      },
      {
        lat: 4.85,
        lng: 100.733333
      },
      {
        lat: 4.4148,
        lng: 114.0089
      },
      {
        lat: 2.3,
        lng: 111.816667
      },
      {
        lat: 1.8548,
        lng: 102.9325
      },
      {
        lat: 2.0442,
        lng: 102.5689
      },
      {
        lat: 2.0251,
        lng: 103.3328
      },
      {
        lat: 3.166667,
        lng: 113.033333
      },
      {
        lat: 5.0268,
        lng: 118.327
      },
      {
        lat: 4.0259,
        lng: 101.0213
      },
      {
        lat: 4.25,
        lng: 103.416667
      },
      {
        lat: 6.4414,
        lng: 100.198619
      },
      {
        lat: 3.7899,
        lng: 101.857
      },
      {
        lat: 4.1842,
        lng: 102.0468
      },
      {
        lat: 3.033333,
        lng: 101.45
      },
      {
        lat: 2.7297,
        lng: 101.9381
      },
      {
        lat: 6.030211,
        lng: 102.141257
      },
      {
        lat: 1.55,
        lng: 110.333333
      },
      {
        lat: 5.957008,
        lng: 102.24817
      },
      {
        lat: 6.197755,
        lng: 102.170976
      },
      {
        lat: 5.276667,
        lng: 115.241667
      },
      {
        lat: 6.049337,
        lng: 102.139873
      },
      {
        lat: 6.133275,
        lng: 102.238603
      },
      {
        lat: 5.871332,
        lng: 102.231766
      }
    ];

    const u = await Database
      .table('users')
      .where('type', 'BUYER')
    let i = 0;
    for (const key in u) {
      const obj = new Map();
      obj.user_id = u[key].id;
      obj.appversion = '1.3.0';
      obj.platform = 'android';
      obj.geolocation = ps[i];
      // obj.save()
      // console.log(ps[i], ps.length);
      i++;
      if (i >= (ps.length) - 1) i = 0;
    }
    response.send({
      'status': true
    })
  }

  async show({
    params,
    request,
    response,
    view
  }) {}

  async edit({
    params,
    request,
    response,
    view
  }) {}

  async update({
    params,
    request,
    response
  }) {}

  async destroy({
    params,
    request,
    response
  }) {}
}

module.exports = MapController
