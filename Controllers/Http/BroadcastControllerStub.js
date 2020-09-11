const sinon = use("sinon");
const Logger = use("Logger");
const firebaseAdmin = use("FirebaseAdmin");
const Broadcast = use("App/Models/Broadcast");

class BroadcastControllerStub {
  constructor(stubTarget) {
    /**
     * Stub store
     */
    sinon.stub(stubTarget, "store").callsFake(async inputData => {
      /// email Boss mykedai
      // const arrEmail = ["601142088427@telin.com.my"];
      // const firebaseTopicName = arrEmail.map(el => `mykedai_${el.replace(/[^0-9a-zA-Z]/gi, "_")}`);
      // const req = inputData.request._all;
      // for (const key in firebaseTopicName) {
      //   const pushContent = {
      //     notification: {
      //       body: req.message,
      //       title: req.title,
      //     },
      //     data: {
      //       context: "",
      //       title: req.title,
      //       message: req.message,
      //     },
      //   };
      //   Logger.info(`pushNotify broadcast ${firebaseTopicName}`, pushContent);
      //   // await firebaseAdmin.firebase.messaging().sendToTopic(firebaseTopicName[key], pushContent);
      //   // returnnya firebase { messageId: 7908775263459539000 }
      // }
      const {title, message, target} = inputData.request._all;
      const save_data = new Broadcast()
      save_data.title = title;
      save_data.message = message;
      save_data.user_id = inputData.auth.user.id;
      save_data.target = JSON.stringify(target);
      await save_data.save();
      return {
        status: true,
        data: inputData.request._all
      };
    });
  }
}

module.exports = BroadcastControllerStub;
