//SPDX-License-Identifier: Apache-2.0

/*
  This code is based on code written by the Hyperledger Fabric community.
  Original code can be found here: https://github.com/hyperledger/fabric-samples/blob/release/fabcar/query.js
  and https://github.com/hyperledger/fabric-samples/blob/release/fabcar/invoke.js
 */
  
// call the packages we need  
var express       = require('express');        // call express
var app           = express();                 // define our app using express
var bodyParser    = require('body-parser');
var http          = require('http')
var fs            = require('fs');
var Fabric_Client = require('fabric-client');
var path          = require('path');
var util          = require('util');
var os            = require('os');

module.exports = (function() {
return{
	add_cont: function(req, res){
		console.log("submit recording of a technology : ");

		var array = req.params.groot.split("@");
		console.log(array);

		var technology = array[0]
		var sort = array[1]
		var company = array[2]
		var com_num = array[3]
		var term = array[4]
		var file_name = array[5]
		var file_hash = array[6]
		var enroll_date = array[7]
		var groot_status = array[8]

		var fabric_client = new Fabric_Client();

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);
		var order = fabric_client.newOrderer('grpc://localhost:7050')
		channel.addOrderer(order);

		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;
		
		// chaincode와 연결해주는 코드(user 등록 등등)
		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // get a transaction id object based on the current user assigned to fabric client
		    tx_id = fabric_client.newTransactionID();
		    console.log("Assigning transaction_id: ", tx_id._transaction_id);

		    // add_contract - requires 7 args, technology, sort, company, com_num, term, content, client, cont_term, enroll_date
		    // send proposal to endorser
		    const request = {
		        //targets : --- letting this default to the peers assigned to the channel
		        chaincodeId: 'groot-chaincode',
		        fcn: 'add_cont',
		        args: [technology, sort, company, com_num, term, file_name, file_hash, enroll_date, groot_status],
		        chainId: 'mychannel',
		        txId: tx_id 
		    };

		    return channel.sendTransactionProposal(request);
	      }).then((results) => {
		  var proposalResponses = results[0];
		  var proposal = results[1];
		  let isProposalGood = false;
		  if (proposalResponses && proposalResponses[0].response &&
		      proposalResponses[0].response.status === 200) {
			  isProposalGood = true;
			  console.log('Transaction proposal was good');
		      } else {
			  console.error('Transaction proposal was bad');
		      }
		  if (isProposalGood) {
		      console.log(util.format(
			  'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
			  proposalResponses[0].response.status, proposalResponses[0].response.message));
		      // build up the request for the orderer to have the transaction committed
		      var request = {
			  proposalResponses: proposalResponses,
			  proposal: proposal
		      };
		      // set the transaction listener and set a timeout of 30 sec
		      // if the transaction did not get committed within the timeout period,
		      // report a TIMEOUT status
		      var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
		    var promises = [];
		    
		      var sendPromise = channel.sendTransaction(request);
		      promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
		      // get an eventhub once the fabric client has a user assigned. The user
		      // is required bacause the event registration must be signed
		      //let event_hub = fabric_client.newEventHub();
		    //event_hub.setPeerAddr('grpc://localhost:7053');
		       
		    //let event_hub = channel.newChannelEventHub('localhost:7051');
		    let event_hub = channel.newChannelEventHub(fabric_client.newPeer('grpc://localhost:7051'));
		      // using resolve the promise so that result status may be processed
		      // under the then clause rather than having the catch clause process
		      // the status
		      let txPromise = new Promise((resolve, reject) => {
			  let handle = setTimeout(() => {
			      event_hub.disconnect();
			      resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
			  }, 3000);
			  event_hub.connect();
			  event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
			      
			  clearTimeout(handle);
			  var return_status = {event_status : code, tx_id : transaction_id_string};
			  if (code !== 'VALID') {
			     console.error('The transaction was invalid, code = ' + code);
			     resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
			  } else {
			     console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
			     resolve(return_status);
			  }

			  }, (err) => {
			      //this is the callback if something goes wrong with the event registration or processing
			      reject(new Error('There was a problem with the eventhub ::'+err));
			  });
		      });
		      promises.push(txPromise);
		      return Promise.all(promises);
		  } else {
		      console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		    res.send("The contract already exists");
		    //throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		  }
	      }).then((results) => {
		  console.log('Send transaction promise and event listener promise have completed');
		  // check the results in the order the promises were added to the promise all list
		  if (results && results[0] && results[0].status === 'SUCCESS') {
		      console.log('Successfully sent transaction to the orderer.');
		      //res.send(tx_id.getTransactionID());
		    res.status(200).json(tx_id.getTransactionID());
		    return true;
		 } else {
		      console.error('Failed to order the transaction. Error code: ' + response.status);
		    res.send("The contract already exists");
		 }
		  if(results && results[1] && results[1].event_status === 'VALID') {
		      console.log('Successfully committed the change to the ledger by the peer');
		      //res.send(tx_id.getTransactionID());
		    res.status(200).json(tx_id.getTransactionID());
		    return true;
		 } else {
		      console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
		  }
	      }).catch((err) => {
		  console.error('Failed to invoke successfully :: ' + err);
		 res.send("왜 안되는 것이냐 좀 돼라!!");
	      });
	},

	add_client: function(req, res){
		console.log("submit recording of a technology : ");	
		
		var array = req.params.client.split("@");
		console.log(array);

		var technology = array[0]
		var client = array[1]
		var cont_term = array[2]
		var groot_status = array[3]
		
		var fabric_client = new Fabric_Client();

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);
		var order = fabric_client.newOrderer('grpc://localhost:7050')
		channel.addOrderer(order);

		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;
		
		// chaincode와 연결해주는 코드(user 등록 등등)
		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // get a transaction id object based on the current user assigned to fabric client
		    tx_id = fabric_client.newTransactionID();
		    console.log("Assigning transaction_id: ", tx_id._transaction_id);

		    // add_contract - requires 3 args, technology, client, cont_term
		    // send proposal to endorser
		    const request = {
		        //targets : --- letting this default to the peers assigned to the channel
		        chaincodeId: 'groot-chaincode',
		        fcn: 'add_client',
		        args: [technology, client, cont_term, groot_status],
		        chainId: 'mychannel',
		        txId: tx_id 
		    };

		    return channel.sendTransactionProposal(request);

	      }).then((results) => {
		  var proposalResponses = results[0];
		  var proposal = results[1];
		  let isProposalGood = false;
		  if (proposalResponses && proposalResponses[0].response &&
		      proposalResponses[0].response.status === 200) {
			  isProposalGood = true;
			  console.log('Transaction proposal was good');
		      } else {
			  console.error('Transaction proposal was bad');
		      }
		  if (isProposalGood) {
		      console.log(util.format(
			  'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
			  proposalResponses[0].response.status, proposalResponses[0].response.message));
		      // build up the request for the orderer to have the transaction committed
		      var request = {
			  proposalResponses: proposalResponses,
			  proposal: proposal
		      };
		      // set the transaction listener and set a timeout of 30 sec
		      // if the transaction did not get committed within the timeout period,
		      // report a TIMEOUT status
		      var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
		    var promises = [];
		    
		      var sendPromise = channel.sendTransaction(request);
		      promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
		      // get an eventhub once the fabric client has a user assigned. The user
		      // is required bacause the event registration must be signed
		      //let event_hub = fabric_client.newEventHub();
		    //event_hub.setPeerAddr('grpc://localhost:7053');
		       
		    //let event_hub = channel.newChannelEventHub('localhost:7051');
		    let event_hub = channel.newChannelEventHub(fabric_client.newPeer('grpc://localhost:7051'));
		      // using resolve the promise so that result status may be processed
		      // under the then clause rather than having the catch clause process
		      // the status
		      let txPromise = new Promise((resolve, reject) => {
			  let handle = setTimeout(() => {
			      event_hub.disconnect();
			      resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
			  }, 3000);
			  event_hub.connect();
			  event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
			      
			  clearTimeout(handle);
			  var return_status = {event_status : code, tx_id : transaction_id_string};
			  if (code !== 'VALID') {
			     console.error('The transaction was invalid, code = ' + code);
			     resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
			  } else {
			     console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
			     resolve(return_status);
			  }

			  }, (err) => {
			      //this is the callback if something goes wrong with the event registration or processing
			      reject(new Error('There was a problem with the eventhub ::'+err));
			  });
		      });
		      promises.push(txPromise);
		      return Promise.all(promises);
		  } else {
		      console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		      res.send("The contract already exists");
		      //throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		  }
	      }).then((results) => {
		  console.log('Send transaction promise and event listener promise have completed');
		  // check the results in the order the promises were added to the promise all list
		  if (results && results[0] && results[0].status === 'SUCCESS') {
		      console.log('Successfully sent transaction to the orderer.');
		      //res.send(tx_id.getTransactionID());
		      res.status(200).json(tx_id.getTransactionID());
		      return true;
		 } else {
		      console.error('Failed to order the transaction. Error code: ' + response.status);
		      res.send("The contract already exists");
		 }
		  if(results && results[1] && results[1].event_status === 'VALID') {
		      console.log('Successfully committed the change to the ledger by the peer');
		      //res.send(tx_id.getTransactionID());
		      res.status(200).json(tx_id.getTransactionID());
		      return true;
		 } else {
		      console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
		  }
	      }).catch((err) => {
		  console.error('Failed to invoke successfully :: ' + err);
	          res.send("The contract already exists");
	      });
	   },
		
	 change_term: function(req, res){
                console.log("changing term of technology : ");

                var array = req.params.term.split("@");
                var technology = array[0]
                var term = array[1];
		var groot_status = array[2]

                var fabric_client = new Fabric_Client();

                // setup the fabric network
                var channel = fabric_client.newChannel('mychannel');
                var peer = fabric_client.newPeer('grpc://localhost:7051');
                channel.addPeer(peer);
                var order = fabric_client.newOrderer('grpc://localhost:7050')
                channel.addOrderer(order);

                var member_user = null;
                var store_path = path.join(os.homedir(), '.hfc-key-store');
                console.log('Store path:'+store_path);
                var tx_id = null;

                Fabric_Client.newDefaultKeyValueStore({ path: store_path
                }).then((state_store) => {
                    // assign the store to the fabric client
                    fabric_client.setStateStore(state_store);
                    var crypto_suite = Fabric_Client.newCryptoSuite();
                    // and the crypto store (where the users' keys are kept)
                    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
                    crypto_suite.setCryptoKeyStore(crypto_store);
                    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
                    return fabric_client.getUserContext('user1', true);
                }).then((user_from_store) => {
                    if (user_from_store && user_from_store.isEnrolled()) {
                        console.log('Successfully loaded user1 from persistence');
                        member_user = user_from_store;
                    } else {
                        throw new Error('Failed to get user1.... run registerUser.js');
                    }

                    // get a transaction id object based on the current user assigned to fabric client
                    tx_id = fabric_client.newTransactionID();
                    console.log("Assigning transaction_id: ", tx_id._transaction_id);

		    // change_term - requires 2 args, ex: args: ['apple', '3']
                    // send proposal to endorser
                    var request = {
                        //targets : --- letting this default to the peers assigned to the channel
			chaincodeId: 'groot-chaincode',
			fcn: 'change_term',
                        args: [technology, term, groot_status],
                        chainId: 'mychannel',
                        txId: tx_id
                    };

		    // send the transaction proposal to the peers
                    return channel.sendTransactionProposal(request);
                }).then((results) => {
                    var proposalResponses = results[0];
                    var proposal = results[1];
                    let isProposalGood = false;
                    if (proposalResponses && proposalResponses[0].response &&
                        proposalResponses[0].response.status === 200) {
                            isProposalGood = true;
                            console.error('Transaction proposal was bad');
                        } else {
                            console.error('Transaction proposal was bad');
                        }
                    if (isProposalGood) {
                        console.log(util.format(
				'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                            proposalResponses[0].response.status, proposalResponses[0].response.message));
                        // build up the request for the orderer to have the transaction committed
			var request = {
			    proposalResponses: proposalResponses,
                            proposal: proposal
                        };
			// set the transaction listener and set a timeout of 30 sec
                        // if the transaction did not get committed within the timeout period,
                        // report a TIMEOUT status
                        var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                        // if the transaction did not get committed within the timeout period,
                        var promises = [];

                        var sendPromise = channel.sendTransaction(request);
			promises.push(sendPromise);

                        // get an eventhub once the fabric client has a user assigned. The user
			// is required bacause the event registration must be signed
                        // let event_hub = fabric_client.newEventHub();
                        // event_hub.setPeerAddr('grpc://localhost:7053');
			let event_hub = channel.newChannelEventHub(fabric_client.newPeer('grpc://localhost:7051'));

                        // using resolve the promise so that result status may be processed
                        // under the then clause rather than having the catch clause process
                        // the status
                        let txPromise = new Promise((resolve, reject) => {
			    let handle = setTimeout(() => {
                                event_hub.disconnect();
                                resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                            }, 3000);
                            event_hub.connect();
                            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                                // this is the callback for transaction event status
                                // first some clean up of event listener
                                // event_hub.disconnect();
                                // if (code !== 'VALID') {
                                //     console.error('The transaction was invalid, code = ' + code);
                                // } else {
                                //     resolve(return_status);
                                                clearTimeout(handle);

                                                // now let the application know what happened
                                                var return_status = {event_status : code, tx_id : transaction_id_string}; 
                                                if (code !== 'VALID') {
                                                        console.error('The transaction was invalid, code = ' + code);   
                                                        resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                                                } else {
                                                        console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
                                                        resolve(return_status);
                                                }
                            }, (err) => {
                                reject(new Error('There was a problem with the eventhub ::'+err));
                            });
                        });
                        promises.push(txPromise);

                        return Promise.all(promises);
                    } else {
                        console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                        res.send("Error: no tuna catch found");
                        // throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                    }
                }).then((results) => {
                    console.log('Send transaction promise and event listener promise have completed');
                    // check the results in the order the promises were added to the promise all list
                    if (results && results[0] && results[0].status === 'SUCCESS') {
                        console.log('Successfully sent transaction to the orderer.');
                                // res.json(tx_id.getTransactionID())
                                res.status(200).json(tx_id.getTransactionID())
                                return true;
                    } else {
                        console.error('Failed to order the transaction. Error code: ' + response.status);
                        res.send("Error: no tuna catch found");
                    }

                    if(results && results[1] && results[1].event_status === 'VALID') {
                        console.log('Successfully committed the change to the ledger by the peer');
                                // res.json(tx_id.getTransactionID())
                                res.status(200).json(tx_id.getTransactionID())
                                return true;
                    } else {
                        console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
                    }
                }).catch((err) => {
                    console.error('Failed to invoke successfully :: ' + err);
                    res.send("Error: no tuna catch found");
                });
       	},

	add_content: function(req, res){
		console.log("submit add content of a technology : ");	
		
		var array = req.params.content.split("@");
		console.log(array);

		var technology = array[0]
		var file_name = array[1]
		var file_hash = array[2]
		var groot_status = array[3]
		
		var fabric_client = new Fabric_Client();

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);
		var order = fabric_client.newOrderer('grpc://localhost:7050')
		channel.addOrderer(order);

		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;
		
		// chaincode와 연결해주는 코드(user 등록 등등)
		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // get a transaction id object based on the current user assigned to fabric client
		    tx_id = fabric_client.newTransactionID();
		    console.log("Assigning transaction_id: ", tx_id._transaction_id);

		    // add_contract - requires 3 args, technology, client, cont_term
		    // send proposal to endorser
		    const request = {
		        //targets : --- letting this default to the peers assigned to the channel
		        chaincodeId: 'groot-chaincode',
		        fcn: 'add_content',
		        args: [technology, file_name, file_hash, groot_status],
		        chainId: 'mychannel',
		        txId: tx_id 
		    };

		    return channel.sendTransactionProposal(request);
	      }).then((results) => {
		  var proposalResponses = results[0];
		  var proposal = results[1];
		  let isProposalGood = false;
		  if (proposalResponses && proposalResponses[0].response &&
		      proposalResponses[0].response.status === 200) {
			  isProposalGood = true;
			  console.log('Transaction proposal was good');
		      } else {
			  console.error('Transaction proposal was bad');
		      }
		  if (isProposalGood) {
		      console.log(util.format(
			  'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
			  proposalResponses[0].response.status, proposalResponses[0].response.message));
		      // build up the request for the orderer to have the transaction committed
		      var request = {
			  proposalResponses: proposalResponses,
			  proposal: proposal
		      };
		      // set the transaction listener and set a timeout of 30 sec
		      // if the transaction did not get committed within the timeout period,
		      // report a TIMEOUT status
		      var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
		    var promises = [];
		    
		      var sendPromise = channel.sendTransaction(request);
		      promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
		      // get an eventhub once the fabric client has a user assigned. The user
		      // is required bacause the event registration must be signed
		      //let event_hub = fabric_client.newEventHub();
		    //event_hub.setPeerAddr('grpc://localhost:7053');
		       
		    //let event_hub = channel.newChannelEventHub('localhost:7051');
		    let event_hub = channel.newChannelEventHub(fabric_client.newPeer('grpc://localhost:7051'));
		      // using resolve the promise so that result status may be processed
		      // under the then clause rather than having the catch clause process
		      // the status
		      let txPromise = new Promise((resolve, reject) => {
			  let handle = setTimeout(() => {
			      event_hub.disconnect();
			      resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
			  }, 3000);
			  event_hub.connect();
			  event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
			      
			  clearTimeout(handle);
			  var return_status = {event_status : code, tx_id : transaction_id_string};
			  if (code !== 'VALID') {
			     console.error('The transaction was invalid, code = ' + code);
			     resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
			  } else {
			     console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
			     resolve(return_status);
			  }

			  }, (err) => {
			      //this is the callback if something goes wrong with the event registration or processing
			      reject(new Error('There was a problem with the eventhub ::'+err));
			  });
		      });
		      promises.push(txPromise);
		      return Promise.all(promises);
		  } else {
		      console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		    res.send("The contract already exists");
		    //throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		  }
	      }).then((results) => {
		  console.log('Send transaction promise and event listener promise have completed');
		  // check the results in the order the promises were added to the promise all list
		  if (results && results[0] && results[0].status === 'SUCCESS') {
		      console.log('Successfully sent transaction to the orderer.');
		      //res.send(tx_id.getTransactionID());
		    res.status(200).json(tx_id.getTransactionID());
		    return true;
		 } else {
		      console.error('Failed to order the transaction. Error code: ' + response.status);
		    res.send("The contract already exists");
		 }
		  if(results && results[1] && results[1].event_status === 'VALID') {
		      console.log('Successfully committed the change to the ledger by the peer');
		      //res.send(tx_id.getTransactionID());
		    res.status(200).json(tx_id.getTransactionID());
		    return true;
		 } else {
		      console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
		  }
	      }).catch((err) => {
		  console.error('Failed to invoke successfully :: ' + err);
		 res.send("The contract already exists");
	      });
	},

	get_cert_verify: function(req, res){

		var fabric_client = new Fabric_Client();
		var key = req.params.cert

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);

		//
		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;

		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // getTechnology - requires 1 argument, ex: args: ['orange'], 
		    const request = {
		        chaincodeId: 'groot-chaincode',
		        txId: tx_id,
		        fcn: 'get_cert_verify',
		        args: [key]
		    };

		    // send the query proposal to the peer
		    return channel.queryByChaincode(request);
		}).then((query_responses) => {
		    console.log("Query has completed, checking results");
		    // query_responses could have more than one  results if there multiple peers were used as targets
		    if (query_responses && query_responses.length == 1) {
		        if (query_responses[0] instanceof Error) {
		            console.error("error from query = ", query_responses[0]);
		            res.send("Could not locate tuna")
		            
		        } else {
		            console.log("Response is ", query_responses[0].toString());
		            res.send(query_responses[0].toString())
		        }
		    } else {
		        console.log("No payloads were returned from query");
		        res.send("Could not locate tuna")
		    }
		}).catch((err) => {
		    console.error('Failed to query successfully :: ' + err);
		    res.send("Could not locate tuna")
		});
	},

	get_tech: function(req, res){

		var fabric_client = new Fabric_Client();
		var key = req.params.id

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);

		//
		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;

		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // getTechnology - requires 1 argument, ex: args: ['orange'], 
		    const request = {
		        chaincodeId: 'groot-chaincode',
		        txId: tx_id,
		        fcn: 'get_tech',
		        args: [key]
		    };

		    // send the query proposal to the peer
		    return channel.queryByChaincode(request);
		}).then((query_responses) => {
		    console.log("Query has completed, checking results");
		    // query_responses could have more than one  results if there multiple peers were used as targets
		    if (query_responses && query_responses.length == 1) {
		        if (query_responses[0] instanceof Error) {
		            console.error("error from query = ", query_responses[0]);
		            res.send("Could not locate tuna")
		            
		        } else {
		            console.log("Response is ", query_responses[0].toString());
		            res.send(query_responses[0].toString())
		        }
		    } else {
		        console.log("No payloads were returned from query");
		        res.send("Could not locate tuna")
		    }
		}).catch((err) => {
		    console.error('Failed to query successfully :: ' + err);
		    res.send("Could not locate tuna")
		});
	},
	
	get_all_tech: function(req, res){

		var fabric_client = new Fabric_Client();

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);

		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;

		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // getTechnology - requires 1 argument, ex: args: ['orange'], 
		    const request = {
		        chaincodeId: 'groot-chaincode',
		        txId: tx_id,
		        fcn: 'get_all_tech',
		        args: ['']
		    };

		    // send the query proposal to the peer
		    return channel.queryByChaincode(request);
//		 }).then((block) => {	
//			console.log('Block Number: ' + block.header.number);
//			console.log('Previous Hash: ' + block.header.previous_hash);
//			console.log('Data Hash: ' + block.header.data_hash);
//			console.log('Transactions: ' + block.data.data.length);
//			block.data.data.forEach(transaction => {
//				console.log('Transaction ID: ' + transaction.payload.header.channel_header.tx_id);
//				console.log('Creator ID: ' + transaction.payload.header.signature_header.creator.Mspid);
//				console.log('Data: ');
//				console.log(JSON.stringify(transaction.payload.data));
//			});
//			return channel.queryBlock(blockNumber);
		}).then((query_responses) => {
		    console.log("Query has completed, checking results");
		    // query_responses could have more than one  results if there multiple peers were used as targets
		    if (query_responses && query_responses.length == 1) {
		        if (query_responses[0] instanceof Error) {
		            console.error("error from query = ", query_responses[0]);
		            res.send("Could not locate technology")
		            
		        } else {
		            console.log("Response is ", query_responses[0].toString());
		            res.send(query_responses[0].toString())
		        }
		    } else {
		        console.log("No payloads were returned from query");
		        res.send("Could not locate tuna")
		    }
		}).catch((err) => {
		    console.error('Failed to query successfully :: ' + err);
		    res.send("Could not locate tuna")
		});
	},

	query_tech: function(req, res){

		var fabric_client = new Fabric_Client();

		// setup the fabric network
		var channel = fabric_client.newChannel('mychannel');
		var peer = fabric_client.newPeer('grpc://localhost:7051');
		channel.addPeer(peer);

		var member_user = null;
		var store_path = path.join(os.homedir(), '.hfc-key-store');
		console.log('Store path:'+store_path);
		var tx_id = null;

		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		Fabric_Client.newDefaultKeyValueStore({ path: store_path
		}).then((state_store) => {
		    // assign the store to the fabric client
		    fabric_client.setStateStore(state_store);
		    var crypto_suite = Fabric_Client.newCryptoSuite();
		    // use the same location for the state store (where the users' certificate are kept)
		    // and the crypto store (where the users' keys are kept)
		    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
		    crypto_suite.setCryptoKeyStore(crypto_store);
		    fabric_client.setCryptoSuite(crypto_suite);

		    // get the enrolled user from persistence, this user will sign all requests
		    return fabric_client.getUserContext('user1', true);
		}).then((user_from_store) => {
		    if (user_from_store && user_from_store.isEnrolled()) {
		        console.log('Successfully loaded user1 from persistence');
		        member_user = user_from_store;
		    } else {
		        throw new Error('Failed to get user1.... run registerUser.js');
		    }

		    // getTechnology - requires 1 argument, ex: args: ['orange'], 
		    const request = {
		        chaincodeId: 'groot-chaincode',
		        txId: tx_id,
		        fcn: 'query_tech',
		        args: ['']
		    };

		    // send the query proposal to the peer
		    return channel.queryByChaincode(request);
//		 }).then((block) => {	
//			console.log('Block Number: ' + block.header.number);
//			console.log('Previous Hash: ' + block.header.previous_hash);
//			console.log('Data Hash: ' + block.header.data_hash);
//			console.log('Transactions: ' + block.data.data.length);
//			block.data.data.forEach(transaction => {
//				console.log('Transaction ID: ' + transaction.payload.header.channel_header.tx_id);
//				console.log('Creator ID: ' + transaction.payload.header.signature_header.creator.Mspid);
//				console.log('Data: ');
//				console.log(JSON.stringify(transaction.payload.data));
//			});
//			return channel.queryBlock(blockNumber);
		}).then((query_responses) => {
		    console.log("Query has completed, checking results");
		    // query_responses could have more than one  results if there multiple peers were used as targets
		    if (query_responses && query_responses.length == 1) {
		        if (query_responses[0] instanceof Error) {
		            console.error("error from query = ", query_responses[0]);
		            res.send("Could not locate technology")
		            
		        } else {
		            console.log("Response is ", query_responses[0].toString());
		            res.send(query_responses[0].toString())
		        }
		    } else {
		        console.log("No payloads were returned from query");
		        res.send("Could not locate tuna")
		    }
		}).catch((err) => {
		    console.error('Failed to query successfully :: ' + err);
		    res.send("Could not locate tuna")
		});
	}
}		
})();
