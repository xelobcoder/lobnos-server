import { Request, Response } from "express";
import { placeOrder, getunReceivedOrders, deleteAspecificOrder,Orders } from "../../models/orders/orders";
import { responseError } from "../../../helper";



export const handlePlaceOrder = (request: Request, response: Response): void => {
  placeOrder(request, response);
};

export const handleGetOrders = async (request: Request, response: Response) => {
  try {
    const orders = await getunReceivedOrders(request.query as any);
    response.send({ result: orders, status: "success", statusCode: 200 });
  } catch (err) {
    responseError(response);
  }
};



export const handleDeleteAspecificOrder = async (request: Request, response: Response): Promise<Response> => {
  try {
    const { productordersid } = request.body;
    const isDeleted = await deleteAspecificOrder(productordersid, response);
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
  } catch (err) {
    responseError(response);
  }
};




export async function handleTransactionsOrders(request: Request, response: Response) {
  // const { from, end, supplier, stock, page = 1, count = 10 } = request.query;
  const result = await new Orders().getorderTransactionSummary(request.query as any,true);

  response.send(result);
}