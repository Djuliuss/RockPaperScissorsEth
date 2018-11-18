pragma solidity 0.4.24;
import "./SafeMath.sol";

contract RockPaperScissors {
    
    using SafeMath for uint;
    //The commits of the game can have the following values:
    enum Status {Initialised, // player has not yet declared their move
                 Declared,    // player has declared their move 
                 Verified}    // move has been verified
    //The game goes through three stages:
    enum GameStage {PreGame,  // there is no game created yet
                    Play,     // players declare their moves.
                    Validate, // players reveal their moves and the contract validate they are correct
                    Resolve}  // the contract declares the winner
                    
    struct Commit {
        address player;
        bytes32 action;
        Status commitStatus;
    }
    
    struct Game { 
        uint wager;
        uint playStageEnd;
        uint validateStageEnd;
        GameStage gameStage;
        mapping(uint => Commit) commits;
    }
    
    uint public numGames;
    mapping(uint => Game) public games;
    mapping(address => uint) public earnings;
    
    event LogCreateGame (
        uint indexed gameID,
        address indexed  player0,
        address indexed player1,
        uint wager,
        uint playStageEnd,
        uint validateStageEnd
    );

    event LogDeclareCommit(
        uint indexed gameID,
        uint indexed numPlayer,
        bytes32 hashedChoice
    );

    event LogPlayStageFinished (
        uint indexed gameID
    );

    event LogRevealCommit(
        uint indexed gameID,
        uint indexed numPlayer
    );

    event LogPotUpdated(
        uint indexed gameID,
        address indexed winner,
        uint amount
    );

    event LogDraw(uint indexed GameID,
        address indexed player0,
        address indexed player1,
        uint amount
    );
    
    event LogWithdraw (
	    address indexed player,
	    uint amount
	);
	
	event LogClaimWager (
	    uint indexed gameID,    
	    address indexed player,
	    uint amount
	);
	
	event LogClaimWagerAfterValidate (
	    uint indexed gameID,    
	    address indexed player,
	    uint amount
	);
	
	event LogDeleteUnusedGame(
	    uint gameID,
	    address sender
	);
	
	modifier onlyBefore(uint _time) { require(now < _time); _; }
    modifier onlyAfter(uint _time) { require(now > _time); _; }
    
    function createGame (address _player0, address _player1, uint _wager, uint durationGame, uint durationReveal) public returns (uint gameID) {
        require (_player0 != _player1);
        require (durationGame < durationReveal);
        gameID = numGames++;
        games[gameID] = Game ({
            wager: _wager,
            playStageEnd: now.add(durationGame),
            validateStageEnd: now.add(durationReveal),
            gameStage: GameStage.Play
        });
        games[gameID].commits[0].player = _player0 ;
        games[gameID].commits[1].player = _player1 ;
        emit LogCreateGame(gameID, _player0, _player1, _wager, now.add(durationGame), now.add(durationReveal));
    }
    
    function declareCommit(uint gameID, bytes32 hashedChoice) onlyBefore(games[gameID].playStageEnd) 
    public payable {
        Game storage game  = games[gameID];
        address player0 = game.commits[0].player;
        address player1 = game.commits[1].player;
        require(msg.value == game.wager);
        uint index;
        if (msg.sender == player0) {
            index = 0;
        } else if (msg.sender == player1) {
            index = 1;
        } else {
            revert("Unauthorized player");
        }
        require(game.gameStage == GameStage.Play);
        game.commits[index].action = hashedChoice;  
        game.commits[index].commitStatus = Status.Declared;
        emit LogDeclareCommit(gameID, index, hashedChoice); 
        if (game.commits[1 - index].commitStatus == Status.Declared) {
            game.gameStage = GameStage.Validate;         
            emit LogPlayStageFinished(gameID);    
        } 
    }
    
    function revealCommit(uint gameID, bytes32 choice, bytes32 secret) public {
        require((choice == "rock") || (choice == "paper") || (choice == "scissors"));
        Game storage game = games[gameID];
        require(game.gameStage == GameStage.Validate);
        address player0 = game.commits[0].player;
        address player1 = game.commits[1].player;
        uint index;
        if (msg.sender == player0) {
            index = 0;
        } else if (msg.sender == player1) {
            index = 1;
        } else {
            revert("Unauthorized player");   
        }
        require(game.commits[index].commitStatus == Status.Declared);
        require(game.commits[index].action == computeHash(gameID, choice, secret)); 
        game.commits[index].action = choice;  
        game.commits[index].commitStatus = Status.Verified; 
        emit LogRevealCommit(gameID, index);
        if (game.commits[1 - index].commitStatus == Status.Verified) {
            game.gameStage = GameStage.Resolve;         
            uint resultGame = declareWinner(game.commits[0].action, game.commits[1].action);
            uint wager = game.wager;
            if (resultGame < 2) { 
                address player = resultGame == 0?player0:player1; 
                earnings[player] = earnings[player].add(wager.mul(2));
                emit LogPotUpdated(gameID, player, wager.mul(2));
            } else if (resultGame == 2) {
                earnings[player0] = earnings[player0].add(wager);
                earnings[player1] = earnings[player1].add(wager);
                emit LogDraw(gameID, player0, player1, wager);
            } else {
                revert();
            }
        delete games[gameID];
        delete games[gameID].commits[0];
        delete games[gameID].commits[1];
        }
    }
    
    function declareWinner(bytes32 action0, bytes32 action1) pure public returns (uint result) {
        // 0 : player 0 wins
        // 1 : player 1 wins
        // 2 : draw
        if ( action0 == action1)  {
            //draw
            return (2);
        }
        if (action0 == "rock") {    
            return (action1 == "scissors"?0:1);
        } else if (action0 == "paper") {
            return (action1 == "rock"?0:1);
        } else if (action0 == "scissors") {
            return (action1 == "paper"?0:1);
        } else {
            revert("error at declaring winner");
        }    
    }
    
    function claimWager(uint gameID) public onlyAfter(games[gameID].playStageEnd) {
    // to allow to claim back wager when the other player has failed to DECLARE his move
        Game storage game = games[gameID];
        address player0 = game.commits[0].player;
        address player1 = game.commits[1].player;
        Status status0 = game.commits[0].commitStatus;
        Status status1 = game.commits[1].commitStatus;
        uint wager = game.wager; 
        address player;
        if ((status0 == Status.Declared) && (status1 == Status.Initialised)) {
            player = player0;
        } else if ((status0 == Status.Initialised) && (status1 == Status.Declared)) {
            player = player1;
        } else {
            revert();
        }
        earnings[player] = earnings[player].add(wager);    
        emit LogClaimWager(gameID,player,wager);
        delete games[gameID];
        delete games[gameID].commits[0];
        delete games[gameID].commits[1];
    }
    
    function claimWagerAfterValidate(uint gameID) public onlyAfter(games[gameID].validateStageEnd) {
    // to allow to claim back wager when the other player has failed to VALIDATE his move
        Game storage game = games[gameID];
        address player0 = game.commits[0].player;
        address player1 = game.commits[1].player;
        Status status0 = game.commits[0].commitStatus;
        Status status1 = game.commits[1].commitStatus;
        uint wager = game.wager;
        address player;
        if ((status0 == Status.Verified) && (status1 != Status.Verified)) {
            player = player0;         
        } else if ((status0 != Status.Verified) && (status1 == Status.Verified)) {
            player = player1;
        } else {
            revert();
        }
        earnings[player] = earnings[player].add(wager.mul(2));    
        emit LogClaimWagerAfterValidate(gameID, player, wager.mul(2));
        delete games[gameID];
        delete games[gameID].commits[0];
        delete games[gameID].commits[1];
    }

    function deleteUnusedGame(uint gameID) public onlyAfter(games[gameID].playStageEnd) {
        Game storage game = games[gameID];
        require(game.gameStage == GameStage.Play);
        require((game.commits[0].commitStatus == Status.Initialised) && (game.commits[1].commitStatus == Status.Initialised));
        emit LogDeleteUnusedGame(gameID, msg.sender);
        delete games[gameID];
        delete games[gameID].commits[0];
        delete games[gameID].commits[1];
    }

    function computeHash(uint gameId, bytes32 a, bytes32 b) public view returns (bytes32 hash) {
        return keccak256(abi.encodePacked(address(this), gameId, msg.sender, a, b));
	} 	
	
	function withdraw() public {
	    uint balance = earnings[msg.sender]; 
        require (balance > 0,"account has zero earnings");
        earnings[msg.sender] = 0;
	    emit LogWithdraw(msg.sender, balance);
	    msg.sender.transfer(balance);
	}
}
        
