# FLOW #
- order request received;
- order are placed in groups
-create a transactionid
- for each,Check order Exist to the same supplier using the supplierid, stockid and recieved status 
IF
- stockid && supplierid && recieved = false, response --- order present
ELSE 
- Add new Orders
- foreach add to ordertransaction summary using triggers, on duplicate key we want to update.
send response , if a http request;


## Receiving Order ##
 - check for the order using the transaction id 
 - 
