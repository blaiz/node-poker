var poker = require('../../lib/node-poker');

exports.exampleFromReadme = function(test) {
    // instantiate a new table with values for smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn
    var table = new poker.Table(50, 100, 4, 10, 100, 1000);

    // add a few players, each with a starting value of 1000
    table.AddPlayer('lisa', 1000);
    table.AddPlayer('jane', 1000);
    table.AddPlayer('dylan', 1000);
    table.AddPlayer('john', 1000);

    // don't wait for more players, start the game now
    table.StartGame();

    // control player action by calling methods on their object
    table.players[3].Call(); // player under-the-gun starts
    table.players[0].Bet(200); // dealer add 200 to her current bet (which is 0 right now)
    table.players[1].Call(); // player with small blind calls
    table.players[2].Call(); // player with big blind calls
    table.players[3].Call(); // player under-the-gun calls

    // check the state of the table, the game and all players at any time
//    console.info(table);
//    console.info(table.game);
//    console.info(table.players);

    // flop round
    table.players[1].Check();
    table.players[2].Check();
    table.players[3].Check();
    table.players[0].Check();

    // turn round
    table.players[1].Check();
    table.players[2].Bet(100);
    table.players[3].Fold();
    table.players[0].Fold();
    table.players[1].Bet(200);
    table.players[2].Call();

    // river round
    table.players[1].Check();
    table.players[2].AllIn();
    table.players[1].Call();

    // showdown happens automatically, players are assigned to winners or losers arrays
//    console.info(table.gameWinners); // player(s) who won the pot
//    console.info(table.gameLosers); // player(s) who lost all their chips

    // after the showdown, start a new round
    table.initNewRound();

    test.done();
};

exports.handRanks = function(test){
    // Params: smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn
    var table = new poker.Table(1, 2, 2, 2, 200, 200);
    table.AddPlayer('levi', 200);
    table.AddPlayer('june', 200);

    // get to "River" round
    table.players[0].Call();
    table.players[1].Check();
    table.players[0].Check();
    table.players[1].Check();
    table.players[0].Check();
    table.players[1].Check();

    // rig the game to pick a winner
    table.game.board = ['AC', 'AD', 'AS', 'AH', '2S'];
    table.game.deck = [];
    table.players[0].cards = ['7S', '8H'];
    table.players[1].cards = ['4D', '5C'];
    table.players[0].Check();
    table.players[1].Check();

    // make sure hands were ranked properly and the right player won
    test.equal(table.gameWinners.length, 1);
    test.equal(table.gameWinners[0].playerName, 'levi');
    test.done();
};

exports.testHeadsUp = function(test){
    // Params: smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn
    var table = new poker.Table(1, 2, 2, 2, 200, 200);

    test.equal(table.smallBlind, 1);
    test.equal(table.bigBlind, 2);
    test.equal(table.minPlayers, 2);
    test.equal(table.maxPlayers, 2);
    test.equal(table.players.length, 0);
    test.equal(table.dealer, 0);
    test.equal(table.minBuyIn, 200);
    test.equal(table.maxBuyIn, 200);

    // buy in is exactly 200
    test.throws(function() { table.AddPlayer('not enough chips', 199) }, 'InvalidActionError');
    test.throws(function() { table.AddPlayer('too many chips', 201) }, 'InvalidActionError');
    test.equal(table.playersToAdd.length, 0);

    table.AddPlayer('levi', 200);
    test.equal(table.players.length, 0);
    test.equal(table.playersToAdd.length, 1);
    test.equal(table.playersToAdd[0].playerName, 'levi');
    test.equal(table.playersToAdd[0].chips, 200);

    table.AddPlayer('june', 200);
    // we now reached the max number of players, the game starts automatically
    // table.StartGame() is called implicitly

    // GAME STARTED
    // DEAL ROUND
    test.equal(table.game.roundName, 'Deal');
    test.equal(table.game.pot, 0);
    test.equal(table.game.deck.length, 48); // 52 cards minus 2 per player

    test.equal(table.players.length, 2);

    var levi = table.players[0];
    test.equal(levi.playerName, 'levi');
    // dealer is player 0
    // in heads-up (2 players), the dealer posts the small blind, not the player next to them
    test.equal(levi.chips, 199);

    var june = table.players[1];
    test.equal(june.playerName, 'june');
    // therefore, the other player posts the big blind
    test.equal(june.chips, 198);

    // current player's turn should be the dealer since they posted the small blind
    test.equal(table.currentPlayer, 0);

    test.throws(function(){ levi.Check() }, 'InvalidActionError'); // small blind can't check!

    test.throws(function(){ levi.Bet(1) }, 'InvalidActionError'); // not a valid raise, although a valid call
    levi.Call();
    test.equal(levi.chips, 198);

    // Levi played, it's now June's turn
    test.equal(table.currentPlayer, 1);

    june.Bet(6);
    test.equal(june.chips, 192);
    test.equal(table.game.lastRaise, 6);

    test.equal(table.currentPlayer, 0);

    // can't raise only 4 more, last raise was 6 more; every raise from this point needs to be at least this amount
    test.throws(function(){ levi.Bet(4) }, 'InvalidActionError');
    test.equal(levi.chips, 198);
    // still not a valid raise since this current player's bet is 2, this adds 10 for a total of 12
    // the previous player bet a total of 8 with a raise of 6 more, which means the next raise needs to be a least 8 + 6 = 14
    test.throws(function(){ levi.Bet(10) }, 'InvalidActionError');

    levi.Bet(14);
    test.equal(levi.chips, 184);
    test.equal(table.game.lastRaise, 8);

    june.Call();
    test.equal(june.chips, 184);

    //now that both bet amounts are the same, we should get a flop!
    // FLOP ROUND
    test.equal(table.game.roundName, 'Flop');
    test.equal(table.game.board.length, 3);
    test.equal(table.game.lastRaise, 0); // after a round is over, the min raise is back to 0
    test.equal(table.game.pot, 32);

    test.throws(function(){ levi.Bet(1) }, 'InvalidActionError'); // can't bet less than the big blind

    levi.Check();
    june.Check();

    // TURN ROUND
    test.equal(table.game.roundName, 'Turn');
    test.equal(table.game.board.length, 4);
    levi.Check();
    june.Bet(8);
    test.throws(function(){ levi.Bet(14) }, 'InvalidActionError'); // last bet was 8, so min raise here would be 16
    levi.Bet(18);
    june.Call();

    // RIVER ROUND
    test.equal(table.game.roundName, 'River');
    test.equal(table.game.board.length, 5);
    levi.Bet(10);
    june.Fold();

    // SHOWDOWN!
    test.equal(table.game.roundName, 'Showdown');
    test.equal(table.gameWinners.length, 1);
    test.equal(table.gameWinners[0].playerName, 'levi');
    test.equal(table.gameWinners[0].chips, 234);

    // Start a new hand
    table.initNewRound();

    test.equal(table.dealer, 1); // now june should be the dealer this time
    test.equal(levi.chips, 232); // levi is now the big blind and has 234 chips minus the big blind (2) = 232
    test.equal(june.chips, 165); // june is now the small blind and has 166 chips minus the small blind (1) = 165

    test.done();
};
