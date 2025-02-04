/* Magic Mirror
 * Module: MMM-DynamicWeather
 *
 * By Scott Lewis - https://github.com/scottcl88/MMM-DynamicWeather
 * MIT Licensed.
 *
 * Extension helper module to call external resources
 */

const NodeHelper = require("node_helper");
const https = require('https');

module.exports = NodeHelper.create({
  start: function () { },

  callApi: function (url) {
    console.info("[MMM-DynamicWeather] Getting Weather API data");

    https.get(url, (res) => {
      let body = '';

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { this.handleApiResponse(res, body, url); });

    }).on('error', (error) => {
      console.error("[MMM-DynamicWeather] Failed getting api: ", error);
    });
  },

  handleApiResponse: function (res, body, url) {
    let success = false;
    let result = JSON.parse(body);

    if (res.statusCode !== 200) {
      console.error("[MMM-DynamicWeather] Failed getting api: ", res.statusCode);
    } else {
      console.info("[MMM-DynamicWeather] Received successful Weather API data");
      success = true;
    }

    this.sendSocketNotification("API-Received", { url, result, success });
  },

  callHoliday: function () {
    const url = "https://www.timeanddate.com/holidays/us/?hol=43122559";
    console.info("[MMM-DynamicWeather] Getting Holiday data");

    https.get(url, (res) => {
      let body = '';

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { this.handleHolidayResponse(res, body); });

    }).on('error', (error) => {
      console.error("[MMM-DynamicWeather] Failed getting holidays: ", error);
    });
  },

  handleHolidayResponse: function (res, body) {
    let success = false;

    if (res.statusCode !== 200) {
      console.error("[MMM-DynamicWeather] Failed getting holidays: ", res.statusCode);
    } else {
      console.info("[MMM-DynamicWeather] Received successful Holiday data");
      success = true;
    }

    this.sendSocketNotification("Holiday-Received", { result: { holidayBody: body }, success });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "API-Fetch") {
      this.callApi(payload);
    } else if (notification === "Holiday-Fetch") {
      this.callHoliday();
    }
  }
});
