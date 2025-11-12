// Test script to verify stock consumption API using fetch
async function testStockConsumption() {
     const baseURL = 'http://localhost:5000'; // Adjust if your server runs on different port

     try {
          console.log('Testing stock consumption API...\n');

          // First, let's get available stock details for an item
          console.log('1. Getting available stock details...');
          const stockResponse = await fetch(`${baseURL}/api/inventory/stock-details/1?tenantId=1`); // Replace 1 with actual item ID
          const stockData = await stockResponse.json();
          console.log('Available stock:', JSON.stringify(stockData, null, 2));

          // Test FIFO consumption
          console.log('\n2. Testing FIFO consumption...');
          const fifoConsumption = {
               item_id: '1', // Replace with actual item ID
               quantity: 50,
               performed_by: 1,
               reason: 'Test FIFO consumption'
          };

          console.log('Sending FIFO consumption request:', fifoConsumption);
          const fifoResponse = await fetch(`${baseURL}/api/inventory/consume?tenantId=1`, {
               method: 'POST',
               headers: {
                    'Content-Type': 'application/json'
               },
               body: JSON.stringify(fifoConsumption)
          });
          const fifoData = await fifoResponse.json();
          console.log('FIFO consumption response:', JSON.stringify(fifoData, null, 2));

          // Check stock after consumption
          console.log('\n3. Checking stock after FIFO consumption...');
          const stockAfterFifoResponse = await fetch(`${baseURL}/api/inventory/stock-details/1?tenantId=1`);
          const stockAfterFifo = await stockAfterFifoResponse.json();
          console.log('Stock after FIFO consumption:', JSON.stringify(stockAfterFifo, null, 2));

          // Test manual consumption with specific batch
          if (stockAfterFifo.data?.available_batches && stockAfterFifo.data.available_batches.length > 0) {
               console.log('\n4. Testing manual consumption with specific batch...');
               const manualConsumption = {
                    item_id: '1',
                    quantity: 10,
                    batch_number: stockAfterFifo.data.available_batches[0].batch_number,
                    performed_by: 1,
                    reason: 'Test manual consumption'
               };

               console.log('Sending manual consumption request:', manualConsumption);
               const manualResponse = await fetch(`${baseURL}/api/inventory/consume?tenantId=1`, {
                    method: 'POST',
                    headers: {
                         'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(manualConsumption)
               });
               const manualData = await manualResponse.json();
               console.log('Manual consumption response:', JSON.stringify(manualData, null, 2));

               // Check stock after manual consumption
               console.log('\n5. Checking stock after manual consumption...');
               const stockAfterManualResponse = await fetch(`${baseURL}/api/inventory/stock-details/1?tenantId=1`);
               const stockAfterManual = await stockAfterManualResponse.json();
               console.log('Stock after manual consumption:', JSON.stringify(stockAfterManual, null, 2));
          }

          console.log('\n✅ All tests completed successfully!');

     } catch (error) {
          console.error('❌ Test failed:', error.message);
     }
}

// Run the test
testStockConsumption();