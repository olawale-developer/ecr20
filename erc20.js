const Web3 = require('web3');

const axios = require('axios');

 const provider = new Web3.providers.WebsocketProvider('wss://sepolia.infura.io/ws/v3/af7468d0f18b4e4e922976ab88098c80'); // Replace with your Infura project ID
//  const provider = new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/af7468d0f18b4e4e922976ab88098c80');

// Your Infura project URL or any other provider (like Alchemy)
const web3 = new Web3(provider);

/// The wallet address you want to monitor
// const walletAddress = '0x75eF2EF415184b8Da30B61A6245B39409F45Aa50';


// The ERC-20 contract address (e.g., USDT, DAI)
 const tokenContractAddress = '0xbebe4974c474cd3c78a44740afdeca13a940fed2';
// const tokenContractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT Contract Address



// ABI of the ERC-20 token (you can get this from Etherscan or the token's documentation)
const tokenAbi = [
  // Transfer event ABI
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "from", "type": "address" },
      { "indexed": true, "name": "to", "type": "address" },
      { "indexed": false, "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

// Initialize the contract
const tokenContract = new web3.eth.Contract(tokenAbi, tokenContractAddress);

function checkTransactionsErc20(wallet_address, acct_number, bank_name, bank_code, receiver_name, db, transac_id, timers, crypto_sent, receiver_amount, current_rate) {
    // Subscribe to new blocks
timers[transac_id]['subscription'] = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
        if (error) {
            console.error('Error subscribing to new blocks:', error);
            return;
        }
        console.log(`New block received. Block # ${blockHeader.number}`);
        console.log(`---------------------------------------------------------------------------------------------------------------------`)
        // Subscribe to Transfer events from the contract
        tokenContract.getPastEvents('Transfer', {
            fromBlock: blockHeader.number,
            toBlock: 'latest'
        }, (error, events) => {
            if (error) {
                console.error('Error fetching events:', error);
                return;
            }
            //  console.log(events)
            // Process each transfer event
                events.forEach((event) => {
                const { from, to, value } = event.returnValues;

                // Check if the transfer is to the monitored wallet address
                if (to.toLowerCase() === wallet_address.toLowerCase()) {
                    const amount = web3.utils.fromWei(value, 'ether')
            
                    const actualAmount = Number(amount).toFixed(8)
                    const expectedamount = crypto_sent.replace(/[^0-9.]/g, "");

                    if (actualAmount == expectedamount) { 
                            const amount = receiver_amount.replace(/[^0-9.]/g, "");
                            // Step 2: Remove everything after the dot, including the dot itself
                            const amount_sent = amount.split(".")[0];
                          console.log(`Tokens received: 
                           From: ${from}, 
                           To: ${to}, 
                           Amount: ${web3.utils.fromWei(value, 'ether')} tokens`);
                          clearTimeout(timers[transac_id]['Timeout']);
                          mongoroApi(acct_number, bank_name, bank_code, receiver_name, db, transac_id, amount_sent)
                         subscription(timers,transac_id)
                         // set wallet_address to true in the db
                          setErc20WalletFlag(wallet_address,db)
                        return;
                     }  else {
                                     const rate = current_rate.replace(/[^0-9.]/g, "");     
                                        const naira = actualAmount * rate
                                        let transactionFee;

                                        if (naira <= 100000) { 
                                            transactionFee = 500                                 
                                        } else if (naira <= 1000000) {                                    
                                            transactionFee = 1000                           
                                        } else if (naira <= 2000000) {                                
                                         transactionFee = 1500
                                    }
                                    
                                        
                                        
                                        const nairaValue = naira - transactionFee
                                        if (nairaValue > transactionFee) {
                                        const strNairaValue = nairaValue.toString()
                                       const amount = strNairaValue.replace(/[^0-9.]/g, "");
                                        
                                      // Step 2: Remove everything after the dot, including the dot itself
                                         const amount_sent = amount.split(".")[0];
                                            
                                           clearTimeout(timers[transac_id]['Timeout']);
                                            mongoroApi(acct_number, bank_name, bank_code, receiver_name, db, transac_id, amount_sent)
                                            subscription(timers,transac_id)
                                          // set wallet_address to true in the db
                                            setErc20WalletFlag(wallet_address,db)
                                             return;
                                        } else {
                                           console.log('this amount is very small for the transaction....')
                                             return;
                                        }
                                        
                                       
                           
                                }
                   
                }
            });
        });
    }).on('error', console.error);
}
function setErc20WalletFlag(wallet_address,db) {
     const user = { erc20_flag: 'true' };
     db.query(`UPDATE 2Settle_walletAddress SET ? WHERE eth_bnb_wallet = ?`, [user, wallet_address]);
}

function subscription(timers, transac_id) {
    timers[transac_id]['subscription'].unsubscribe((error, success) => {
            if (success) {
                console.log('Successfully unsubscribed.');
            } else {
                console.error('Error unsubscribing:', error);
            }
        });
}

async function mongoroApi(acct_number, bank_name, bank_code, receiver_name,db,transac_id,amount_sent) {
    console.log(receiver_name)
    const user = {
        accountNumber: acct_number,
        accountBank: bank_code,
        bankName: bank_name,
        amount: amount_sent,
        saveBeneficiary: false,
        accountName: receiver_name,
        narration: "Sirftiech payment",
        currency: "NGN",
        callbackUrl: "http://localhost:3000/payment/success",
        debitCurrency: "NGN",
        pin: "111111"
    };
    
    try {
        const response = await fetch('https://api-biz-dev.mongoro.com/api/v1/openapi/transfer', {
            method: 'POST', // HTTP method
            headers: {
                'Content-Type': 'application/json',    // Content type
                'accessKey': '117da1d3e93c89c3ca3fbd3885e5a6e29b49001a',
                'token': '75bba1c960a6ce7b608e001d9e167c44a9713e40'
            },
            body: JSON.stringify(user) // Data to be sent
        });

        const responseData = await response.json();

        if (!response.ok) {
            
         const messageDetails = [
          `Name: ${receiver_name}`,
          `Bank name: ${bank_name}`,
          `Account number: ${acct_number}`,
          `Receiver Amount: ${amount_sent}`,
        ];

        const menuOptions = [
          [{ text: 'Successful', callback_data: `Transaction_id: ${transac_id} Successful` }]
        ];

            const message = `${messageDetails.join('\n')}}`
             await axios.post('http://127.0.0.1:5000/message', {
                message: message,
                menuOptions: menuOptions,
             })
            
            // throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);

        }
        if (responseData) {
            console.log('working baby')
             const user = { status: 'Successful' };
         db.query(`UPDATE 2settle_transaction_table SET ? WHERE transac_id = ?`, [user, transac_id]);
        }
        console.log('Transaction successful:', responseData);
    } catch (error) {
        console.error('Error:', error);



    }
}

module.exports = {
    checkTransactionsErc20,
    setErc20WalletFlag,
    subscription
}