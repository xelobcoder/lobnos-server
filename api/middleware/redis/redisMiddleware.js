const client = require("../../models/redisclient");
const useRedisCollection = require("./functionCollections");

module.exports = function (request, response, next) {
     if (!request.method == "GET") return next();
     async function gRedisStockCategory(request, response, next) {
          useRedisCollection(request, response, next, "STOCKS_CATEGORY")
     }
     const url = request.url;
     const BASEURL = "/api/v1";
     const definers = [{ endpoint: `${BASEURL}/stock/category`, callback: gRedisStockCategory }];
     var found = definers.find((a, i) => a.endpoint == url)
     if (found) return found.callback(request, response, next)
     else next()
}
