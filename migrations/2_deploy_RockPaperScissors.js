var RockPaperScissors = artifacts.require("./RockPaperScissors.sol");

module.exports = function(deployer) {
	deployer.deploy(RockPaperScissors,{gas:5000000});
};

