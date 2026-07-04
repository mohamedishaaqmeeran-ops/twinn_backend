const axios = require("axios");

async function getCountry(ip) {
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`);

    return data.countryCode; // IN, US, AE, GB...
  } catch {
    return "US";
  }
}

module.exports = getCountry;