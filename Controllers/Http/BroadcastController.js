'use strict'
const Broadcast = use("App/Models/Broadcast");
const Database = use("Database");
const Logger = use("Logger");
const User = use("App/Models/User")
const firebaseAdmin = use("FirebaseAdmin");
const BroadcastControllerStub = use("App/Controllers/Http/BroadcastControllerStub");
const Env = use("Env");
const serializeError = require("serialize-error");
const SK = use("App/Common/StorageKeeper");
const req = require('request');
const csv = require('csvtojson');

class BroadcastController {
  constructor() {
    /// on Sandbox, turn on Stub
    if (Env.get("NODE_ENV") === "sandbox" || Env.get("NODE_ENV") === "development") {
      new BroadcastControllerStub(this);
    }
  }

  async index({
    request,
    response,
    view
  }) {
    try {
      if (request.ajax()) {
        const draw = request.input('draw')
        const start_dt = request.input('start')
        const length_dt = request.input('length')
        const field_order = request.input('columns[' + request.input('order[0][column]') + '][data]')
        const type_order = request.input('order[0][dir]')
        const search = request.input('search[value]')

        const init = Broadcast
          .query()
          .select('users.fullname', 'broadcasts.title', 'broadcasts.message', 'broadcasts.created_at', 'broadcasts.target', 'broadcasts.file')
          .leftJoin('users', 'broadcasts.user_id', Database.raw('users.id::text'))
          .whereRaw(`(
            title ILIKE '%${search}%'
            or message ILIKE '%${search}%'
            )`)
          .orderBy(field_order, type_order)
          .clone()

        let records_total = await Broadcast.query().getCount();
        let records_filtered = search ? await init.getCount() : records_total;
        let initial_db = await init.offset(start_dt).limit(length_dt).fetch();
        const obj_db = initial_db.toJSON();

        const filter_id = obj_db.reduce(function (val, element) {
          if (element.target !== 'All') {
            for (const key in element.target) {
              if (val.includes(element.target[key]) === false) {
                val.push(element.target[key]);
              }
            }
          }
          return val
        }, []);
        const data_user = (await User.query().whereIn('id', filter_id).fetch()).toJSON();
        initial_db = obj_db.map((el) => {
          if (el.target !== 'All') {
            for (const key in el.target) {
              let find_obj = data_user.find(element => element.id === el.target[key]);
              el.target[key] = find_obj.email;
            }
          }
          return el;
        });

        const data_res = {
          'draw': draw,
          'recordsTotal': records_total,
          'recordsFiltered': records_filtered,
          'data': initial_db
        }
        return response.status(200).json(data_res)
      }
      return view.render('pages.broadcast')
    } catch (e) {
      return response.send(e)
    }
  }

  async store({
    request,
    response,
    auth
  }) {
    try {
      const {
        title,
        message,
        target
      } = request.get();
      const save_data = new Broadcast()
      save_data.title = title;
      save_data.message = message;
      save_data.user_id = auth.user.id;
      save_data.target = JSON.stringify(target);
      const res = await save_data.save();

      if (target === "All") {
        // console.log('Targetnya semua')
        // FCM All user
        const firebaseTopicName = 'mykedai_all';
        const pushContent = {
          notification: {
            body: message,
            title: title,
          },
          data: {
            context: "",
            message: message,
            title: title,
          },
        };
        Logger.info(`pushNotify broadcast all ${firebaseTopicName}`, pushContent);
        await firebaseAdmin.firebase.messaging().sendToTopic(firebaseTopicName, pushContent);
      } else {
        // console.log('Targetnya selected')
        // FCM 1 user
        const arrEmail = await User.query().whereIn('id', target).pluck('email');
        const firebaseTopicName = arrEmail.map(el => `mykedai_${el.replace(/[^0-9a-zA-Z]/gi, "_")}`);
        for (const key in firebaseTopicName) {
          const pushContent = {
            notification: {
              body: message,
              title: title,
            },
            data: {
              context: "",
              message: message,
              title: title,
            },
          };
          Logger.info(`pushNotify broadcast selected ${firebaseTopicName[key]}`, pushContent);
          await firebaseAdmin.firebase.messaging().sendToTopic(firebaseTopicName[key], pushContent);
          // returnnya firebase { messageId: 7908775263459539000 }
        }
      }
      return response.status(200).json({
        'status': res
      });
    } catch (e) {
      Logger.error("pushNotify broadcast", e);
    }
  }

  async filter_name({
    request,
    response
  }) {
    const param = request.input("q");
    const res = await User.query()
      .select("id", "fullname as text")
      .whereRaw(`fullname ILIKE '%${param}%'`)
      .where('type', 'BUYER')
      .fetch();
    return response.json({
      items: res.toJSON()
    });
  }

  async import({request, response, auth}){
    try {
      // const url = "https://telinmystore.blob.core.windows.net/rpg-testing/DOVXXX4A7AXY0US0.csv";
      // const { title, message } = request.get();
      const { title, message, url } = request.get();
      const parsedUrl = new URL(url);
      const csvUrl = parsedUrl.origin+parsedUrl.pathname;
      let arrEmail = [];
      let ctn = [];
      await csv({
          noheader:true,
          output: "csv"
        })
        .fromStream(req.get(csvUrl))
        .subscribe((json)=>{
          if (!arrEmail.includes(json[0])){
            arrEmail.push(json[0]);
          }
          ctn.push({
            firebaseTopicName: `mykedai_${json[0].replace(/[^0-9a-zA-Z]/gi, "_")}`,
            message: json[1] ? json[1] : message
          })
        });
      for (const i of ctn) {
        const pushContent = {
          notification: {
            body: i.message,
            title: title,
          },
          data: {
            context: "",
            message: i.message,
            title: title,
          },
        };
        Logger.info(`pushNotify broadcast selected csv ${i.firebaseTopicName}`, pushContent);
        if (Env.get("NODE_ENV") !== "sandbox" && Env.get("NODE_ENV") !== "development") {
          await firebaseAdmin.firebase.messaging().sendToTopic(i.firebaseTopicName, pushContent);
        }
      }
      const target = await User
        .query()
        .whereIn("email", arrEmail)
        .pluck("id");
      
      const save_data = new Broadcast()
      save_data.title = title;
      save_data.message = message;
      save_data.user_id = auth.user.id;
      save_data.file = csvUrl;
      save_data.target = JSON.stringify(target);
      await save_data.save();
      Logger.info("pushNotify broadcast link csv " + csvUrl);
      return response.send({status: true});
    } catch (e) {
      Logger.error("pushNotify broadcast csv", e);
    }
  }

  async generateUploadURL({ request, response }) {
		try {
      const { extension } = request.get();
			const { filename, url, expiry_date } = await SK.generateUploadURL(extension);
			response.send({
				status: "OK",
				data: { filename, url, expiry_date },
			});
		} catch (e) {
			Logger.warning("account::depositCallback", serializeError(e));
			response.send({
				status: "FAIL",
				error: `E991: ${e.message}`,
			});
		}
	}
  // async show ({ params, request, response, view }) {
  //   target::jsonb @>  '["6067922c-dc99-470f-bb4f-ecd434e44d50"]'
  // }
}

module.exports = BroadcastController
