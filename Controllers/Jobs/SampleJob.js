const delay = require("delay");

class SampleJob {
  get concurrency() {
    return 1;
  }

  async handler({ data }) {
    console.log("SampleJob Handler");
    await delay(100);
    console.log(data);
    await delay(200);
  }
}

module.exports = SampleJob;
