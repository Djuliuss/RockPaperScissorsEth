const RockPaperScissors = artifacts.require("./RockPaperScissors.sol");
const BigNumber = require('bignumber.js')
const Promise = require("bluebird");
const expectedExceptionPromise = require("../test/expectedException.js");
const addEvmFunctions = require("../test/evmFunctions.js");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });
addEvmFunctions(web3);
Promise.promisifyAll(web3.evm, { suffix: "Promise" });

contract('RockPaperScissors', function(accounts) { 
    const owner = accounts[0];
    const Alice = accounts[1];
    const Bob = accounts[2];
    let instance;
    
    const choice1 = "rock";
    const secret1 = "123";
    let hashedChoice1;
    const choice2 = "scissors";
    const secret2 = "4567";
    let hashedChoice2;

    beforeEach("should create a RockPaperScissors contract", function() {
		return RockPaperScissors.new({from: owner, gas:5000000 })
		.then(_instance => instance = _instance)
    })

    describe ("should process a new game", function() {
        let wager = web3.toWei(0.5, "ether");
        let playStageEnd = 60;
        let validateStageEnd = 120;
        it ("should process create a new game", function () {
            return instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd, {from:owner})
            .then ( txObj => {
                assert.equal(txObj.receipt.status,1, "createGame failed");
                assert.equal(txObj.receipt.logs.length,1, "createGame emitted an incorrect number of events at receipt");
                assert.equal(txObj.logs.length,1, "createGame emitted an incorrect number of events");
                assert.equal(txObj.logs[0].event, "LogCreateGame", "wrong event emitted at createPayment");		
                assert.equal(txObj.logs[0].args.gameID,0, "should be zero");
                //....
            })
        })
    })

    describe ("should process commits", function() {
        let wager = web3.toWei(0.5, "ether");
        let playStageEnd = 60;
        let validateStageEnd = 120;
        let gameID;
        
        beforeEach ("create one game to interact with", function(){
            return instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd, {from:owner})
            .then( txObj => gameID = txObj.logs[0].args.gameID)
        })
        
        it ("should process one commit", function () {
            return instance.computeHash(gameID, choice1, secret1)
            .then (hash => {
                hashedChoice1 = hash; 
                return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager})
            })
            .then ( txObj => {
                assert.equal(txObj.receipt.status,1, "declareCommit failed");
                assert.equal(txObj.receipt.logs.length,1, "declareCommit emitted an incorrect number of events at receipt");
                assert.equal(txObj.logs.length,1, "declareCommit emitted an incorrect number of events");
                assert.equal(txObj.logs[0].event,"LogDeclareCommit", "wrong event emitted at declareCommit");		
                assert.equal(txObj.logs[0].args.gameID,0, "gameID should be zero");
                assert.equal(txObj.logs[0].args.numPlayer,0, "numplayer should be zero");
                assert.equal(txObj.logs[0].args.hashedChoice,hashedChoice1, "hashed choice should be hashed_choice1"); 
            })
        })
        it ("should process two commits", function () {
            return instance.computeHash(gameID, choice1, secret1)
            .then (hash => {
                    hashedChoice1 = hash; 
                    return instance.computeHash(gameID, choice2, secret2);
            })
            .then (hash => {
                    hashedChoice2 = hash;        
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager})
            })
            .then ( () => instance.declareCommit(gameID, hashedChoice2, {from:Bob, value:wager})
            )
            .then ( txObj => {
                    assert.equal(txObj.receipt.status, 1, "declareCommit failed");
                    assert.equal(txObj.receipt.logs.length, 2, "declareCommit emitted an incorrect number of events at receipt");
                    assert.equal(txObj.logs.length, 2, "declareCommit emitted an incorrect number of events");
                    assert.equal(txObj.logs[1].event, "LogPlayStageFinished", "wrong event emitted at declareCommit");		
                    assert.equal(txObj.logs[1].args.gameID, 0, "gameID should be zero");
            })
        })
    
        it ("should not allow commit if wrong wager submitted", function (){
            return instance.computeHash(gameID, choice1, secret1)
            .then (hash => {
                hashedChoice1 = hash; 
                return expectedExceptionPromise(function () {
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager / 2});
                }, 3000000);
            })
        })

        it ("should not allow commit if play stage has ended", function () {
            return instance.computeHash(gameID, choice1, secret1)
            .then (hash => {
                hashedChoice1 = hash; 
                return web3.evm.increaseTimePromise(playStageEnd + 10);
            })  
            .then ( () => 
                expectedExceptionPromise(function () {
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager});
                }, 3000000)
            )
        })
    })

    describe ("should reveal commits", function() {
        let wager = web3.toWei(0.5, "ether");
        let playStageEnd = 60;
        let validateStageEnd = 120;
        let gameID;
        beforeEach ("players declare their commits", function(){
            return instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd, {from:owner})
            .then ( txObj => {
                    gameID = txObj.logs[0].args.gameID;
                    return instance.computeHash(gameID, choice1, secret1, {from:Alice})
            })
            .then (hash => {
                    hashedChoice1 = hash; 
                    return instance.computeHash(gameID, choice2, secret2, {from:Bob});
            })
            .then (hash => {
                    hashedChoice2 = hash;        
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager})
            })
            .then ( () => instance.declareCommit(gameID, hashedChoice2, {from:Bob, value:wager})
            )
        })

        it ("should reveal commit if hash matches", function () {
            return instance.revealCommit(gameID, choice1, secret1, {from:Alice})
            .then ( txObj => {
                    assert.equal(txObj.receipt.status, 1, "revealCommit failed");
                    assert.equal(txObj.receipt.logs.length, 1, "revealCommit emitted an incorrect number of events at receipt");
                    assert.equal(txObj.logs.length, 1, "revealCommit emitted an incorrect number of events");
                    assert.equal(txObj.logs[0].event, "LogRevealCommit", "wrong event emitted at declareCommit");		
                    assert.equal(txObj.logs[0].args.gameID, 0, "gameID should be zero");
                    assert.equal(txObj.logs[0].args.numPlayer, 0, "numPlayer should be 0");
            })
        })

        it("should not reveal if hash does not match", function () {
            return expectedExceptionPromise(function () {
                    return instance.revealCommit(gameID, choice1, "foobar", {from:Alice});
                    }, 3000000);
        })

        it("should not reveal if reveal time has finished", function () {
            return web3.evm.increaseTimePromise(validateStageEnd + 10)
            then (() =>             
                    expectedExceptionPromise(function () {
                        return instance.revealCommit(gameID, choice1, secret1, {from:Alice});
                    }, 3000000)
            )        
        })
    })

    describe("should declare winner",function () {
        let wager = web3.toWei(0.5, "ether");
        let playStageEnd = 60;
        let validateStageEnd = 120;
        let gameID;
        beforeEach ("players declare their commits and player 1 reveals",function(){
            return instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd, {from:owner})
            .then ( txObj => {
                    gameID = txObj.logs[0].args.gameID;
                    return instance.computeHash(gameID, choice1, secret1, {from:Alice})
            })
            .then (hash => {
                    hashedChoice1 = hash; 
                    return instance.computeHash(gameID, choice2, secret2, {from:Bob});
            })
            .then (hash => {
                    hashedChoice2 = hash;        
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager})
            })
            .then ( () => instance.declareCommit(gameID, hashedChoice2, {from:Bob, value:wager})
            )
            .then ( () => instance.revealCommit(gameID, choice1, secret1, {from:Alice})
            )
        })
  
        it("should reveal second commit and declare winner", function () {
            return instance.revealCommit(gameID, choice2, secret2, {from:Bob})
            .then ( txObj => {        
                assert.equal(txObj.receipt.status, 1, "payWinner failed");
                assert.equal(txObj.receipt.logs.length, 2, "payWinner emitted an incorrect number of events at receipt");
                assert.equal(txObj.logs.length, 2, "payWinner emitted an incorrect number of events");
                assert.equal(txObj.logs[1].event, "LogPotUpdated", "wrong event emitted at declareCommit");		
                assert.equal(txObj.logs[1].args.gameID, 0, "gameID should be zero");
                assert.equal(txObj.logs[1].args.winner, Alice, "should be Alice");
            })
        })
    })
    
    describe("should process withdraw", function () {
        let wager = web3.toWei(0.5, "ether");
        let price = 2 * wager;
        let playStageEnd = 60;
        let validateStageEnd = 120;
        let gameID;
        beforeEach ("process commits and reveals", function(){
            return instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd,{from:owner})
            .then ( txObj => {
                    gameID = txObj.logs[0].args.gameID;
                    return instance.computeHash(gameID, choice1, secret1, {from:Alice})
            })
            .then (hash => {
                    hashedChoice1 = hash; 
                    return instance.computeHash(gameID, choice2, secret2, {from:Bob});
            })
            .then (hash => {
                    hashedChoice2 = hash;        
                    return instance.declareCommit(gameID, hashedChoice1, {from:Alice,value:wager})
            })
            .then ( () => instance.declareCommit(gameID, hashedChoice2, {from:Bob,value:wager})
            )
            .then ( () => instance.revealCommit(gameID, choice1, secret1, {from:Alice})
            )
            .then ( () => instance.revealCommit(gameID, choice2, secret2, {from:Bob})
            )
        })

        it ("should allow winner to withdraw",function(){ 
            let balanceAliceBefore, balanceAliceAfter, fee;
            return web3.eth.getBalancePromise(Alice)
            .then ( balance => {
                    balanceAliceBefore = balance;
                    return instance.withdraw({from:Alice})
            })
            .then ( txObj => {        
                assert.equal(txObj.receipt.status, 1, "withdraw failed");
                assert.equal(txObj.receipt.logs.length, 1, "withdraw emitted an incorrect number of events at receipt");
                assert.equal(txObj.logs.length, 1, "withdraw emitted an incorrect number of events");
                assert.equal(txObj.logs[0].event, "LogWithdraw", "wrong event emitted at withdraw");		
                assert.equal(txObj.logs[0].args.player,Alice, "should be Alice");
                let amountTransferred = new BigNumber(txObj.logs[0].args.amount);
                let amountExpected = new BigNumber (price);
                assert.isTrue(amountTransferred.eq(amountExpected), "wrong amount withdrawn");
                return calculateFee(txObj);
            }) 
            .then ( _fee => {
                fee = _fee;
                return web3.eth.getBalancePromise(Alice);
            })
            .then ( balance => {
                balanceAliceAfter = balance;
                let price = 2 * wager;
                let amountExpected = new BigNumber (price);
                assert.isTrue(balanceAliceAfter.eq(balanceAliceBefore.plus(amountExpected).minus(fee)),"wrong amount transferred");
            })
        })

        it ("should not allow loser to withdraw",function(){ 
            return expectedExceptionPromise(function () {
                return instance.withdraw({from:Bob});}, 300000);
        })
    })

    describe("let's calculate gas consumption for a game", async () => {
        let wager = web3.toWei(0.5, "ether");
        let playStageEnd = 60;
        let validateStageEnd = 120;
        let gameID;
        it("should calculate gas consumption",  async () => {
            let gasUsed = 0, txObj, gameID;
            txObj =  await instance.createGame (Alice, Bob, wager, playStageEnd, validateStageEnd,{from:owner});                        
            gasUsed += txObj.receipt.gasUsed;
            gameID = txObj.logs[0].args.gameID
//          computeHash is a view function therefore no gas consumption
            hashedChoice1 = await instance.computeHash(gameID, choice1, secret1, {from:Alice});
            hashedChoice2 = await instance.computeHash(gameID, choice2, secret2, {from:Bob});
            txObj = await instance.declareCommit(gameID, hashedChoice1, {from:Alice, value:wager})
            gasUsed += txObj.receipt.gasUsed;
            txObj = await instance.declareCommit(gameID, hashedChoice2, {from:Bob, value:wager})
            gasUsed += txObj.receipt.gasUsed;
            txObj = await instance.revealCommit(gameID, choice1, secret1, {from:Alice});
            gasUsed += txObj.receipt.gasUsed;
            txObj = await instance.revealCommit(gameID, choice2, secret2, {from:Bob});
            gasUsed += txObj.receipt.gasUsed;
            txObj = await instance.withdraw({from:Alice});
            gasUsed += txObj.receipt.gasUsed;
            console.log("gas used:",gasUsed);
        })
    })
})
 
function calculateFee(txObj) {
    let GasPrice, fee;
    return web3.eth.getTransactionPromise(txObj.tx).
    then ( tx => {
           gasPrice = new BigNumber (tx.gasPrice);
           fee = new BigNumber(txObj.receipt.gasUsed).times(gasPrice);
           return fee;
    });
}