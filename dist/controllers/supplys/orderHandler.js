"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeleteAspecificOrder = exports.handleGetOrders = exports.handlePlaceOrder = void 0;
const orders_1 = require("../../models/orders/orders");
const helper_1 = require("../../../helper");
const handlePlaceOrder = (request, response) => {
    (0, orders_1.placeOrder)(request, response);
};
exports.handlePlaceOrder = handlePlaceOrder;
const handleGetOrders = async (request, response) => {
    try {
        const orders = await (0, orders_1.getOrders)(request.query);
        response.send({ result: orders, status: "success", statusCode: 200 });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.handleGetOrders = handleGetOrders;
const handleDeleteAspecificOrder = async (request, response) => {
    try {
        const { productordersid } = request.body;
        const isDeleted = await (0, orders_1.deleteAspecificOrder)(productordersid, response);
        return isDeleted
            ? response.send({
                status: "success",
                message: "Order deleted successfully",
                statusCode: 200,
            })
            : response.send({
                status: "success",
                message: "Order delete operation failed",
                statusCode: 200,
            });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.handleDeleteAspecificOrder = handleDeleteAspecificOrder;
