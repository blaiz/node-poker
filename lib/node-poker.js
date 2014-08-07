var events = require('events'),
    handEvaluator = require('poker-evaluator');

function Table(smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn) {
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minPlayers = minPlayers;
    this.maxPlayers =  maxPlayers;
    this.players = [];
    this.dealer = 0; //Track the dealer position between games
    this.minBuyIn = minBuyIn;
    this.maxBuyIn = maxBuyIn;
    this.playersToRemove = [];
    this.playersToAdd = [];
    this.eventEmitter = new events.EventEmitter();
    this.turnBet = {};
    this.gameWinners = [];
    this.gameLosers = [];

    //Validate acceptable value ranges.
    if (minPlayers < 2) { //require at least two players to start a game.
        throw new Error(101, 'Parameter [minPlayers] must be a postive integer of a minimum value of 2.');
    } else if (maxPlayers > 10) { //hard limit of 10 players at a table.
        throw new Error(102, 'Parameter [maxPlayers] must be a positive integer less than or equal to 10.');
    } else if (minPlayers > maxPlayers) { //Without this we can never start a game!
        throw new Error(103, 'Parameter [minPlayers] must be less than or equal to [maxPlayers].');
    }
}

function Player(playerName, chips, table) {
    this.playerName = playerName;
    this.chips = chips;
    this.folded = false;
    this.allIn = false;
    this.talked = false;
    this.table = table; //Circular reference to allow reference back to parent object.
    this.cards = [];
}

function InvalidActionError(message) {
  this.message = message;
  this.name = "InvalidActionError";
}

function fillDeck(deck) {
    deck.push('AS');
    deck.push('KS');
    deck.push('QS');
    deck.push('JS');
    deck.push('TS');
    deck.push('9S');
    deck.push('8S');
    deck.push('7S');
    deck.push('6S');
    deck.push('5S');
    deck.push('4S');
    deck.push('3S');
    deck.push('2S');
    deck.push('AH');
    deck.push('KH');
    deck.push('QH');
    deck.push('JH');
    deck.push('TH');
    deck.push('9H');
    deck.push('8H');
    deck.push('7H');
    deck.push('6H');
    deck.push('5H');
    deck.push('4H');
    deck.push('3H');
    deck.push('2H');
    deck.push('AD');
    deck.push('KD');
    deck.push('QD');
    deck.push('JD');
    deck.push('TD');
    deck.push('9D');
    deck.push('8D');
    deck.push('7D');
    deck.push('6D');
    deck.push('5D');
    deck.push('4D');
    deck.push('3D');
    deck.push('2D');
    deck.push('AC');
    deck.push('KC');
    deck.push('QC');
    deck.push('JC');
    deck.push('TC');
    deck.push('9C');
    deck.push('8C');
    deck.push('7C');
    deck.push('6C');
    deck.push('5C');
    deck.push('4C');
    deck.push('3C');
    deck.push('2C');

    //Shuffle the deck array with Fisher-Yates
    var i, j, temp;
    for (i = 0; i < deck.length; i += 1) {
        j = Math.floor(Math.random() * (i + 1));
        temp = deck[j];
        deck[j] = deck[i];
        deck[i] = temp;
    }
}

function getMaxBet(bets) {
    var maxBet, i;
    maxBet = 0;
    for (i = 0; i < bets.length; i += 1) {
        if (bets[i] > maxBet) {
            maxBet = bets[i];
        }
    }
    return maxBet;
}

function checkForEndOfRound(table) {
    var maxBet, i, endOfRound;
    endOfRound = true;
    maxBet = getMaxBet(table.game.bets);
    //For each player, check
    for (i = 0; i < table.players.length; i += 1) {
        if (table.players[i].folded === false) {
            if (table.players[i].talked === false || table.game.bets[i] !== maxBet) {
                if (table.players[i].allIn === false) {
                  table.currentPlayer = i;
                  endOfRound = false;
                }
            }
        }
    }
    return endOfRound;
}

function checkForAllInPlayer(table, winners) {
    var i, allInPlayer;
    allInPlayer = [];
    for (i = 0; i < winners.length; i += 1) {
        if (table.players[winners[i]].allIn === true) {
            allInPlayer.push(winners[i]);
        }
    }
    return allInPlayer;
}

function checkForWinner(table) {
    var i, j, k, l, maxRank, winners, part, prize, allInPlayer, minBets, roundEnd;
    //Identify winner(s)
    winners = [];
    maxRank = 0;
    for (k = 0; k < table.players.length; k += 1) {
        if (table.players[k].hand.rank === maxRank && table.players[k].folded === false) {
            winners.push(k);
        }
        if (table.players[k].hand.rank > maxRank && table.players[k].folded === false) {
            maxRank = table.players[k].hand.rank;
            winners.splice(0, winners.length);
            winners.push(k);
        }
    }

    part = 0;
    prize = 0;
    allInPlayer = checkForAllInPlayer(table, winners);
    if (allInPlayer.length > 0) {
        minBets = table.game.roundBets[winners[0]];
        for (j = 1; j < allInPlayer.length; j += 1) {
            if (table.game.roundBets[winners[j]] !== 0 && table.game.roundBets[winners[j]] < minBets) {
                minBets = table.game.roundBets[winners[j]];
            }
        }
        part = parseInt(minBets, 10);
    } else {
        part = parseInt(table.game.roundBets[winners[0]], 10);

    }
    for (l = 0; l < table.game.roundBets.length; l += 1) {
        if (table.game.roundBets[l] > part) {
            prize += part;
            table.game.roundBets[l] -= part;
        } else {
            prize += table.game.roundBets[l];
            table.game.roundBets[l] = 0;
        }
    }

    for (i = 0; i < winners.length; i += 1) {
      var winnerPrize = prize / winners.length;
      var winningPlayer = table.players[winners[i]];
      winningPlayer.chips += winnerPrize;
        if (table.game.roundBets[winners[i]] === 0) {
            winningPlayer.folded = true;
            table.gameWinners.push( {
              playerName: winningPlayer.playerName,
              amount: winnerPrize,
              hand: winningPlayer.hand,
              chips: winningPlayer.chips
            });
        }
        console.info('player ' + table.players[winners[i]].playerName + ' wins !!');
    }

    roundEnd = true;
    for (l = 0; l < table.game.roundBets.length; l += 1) {
        if (table.game.roundBets[l] !== 0) {
            roundEnd = false;
        }
    }
    if (roundEnd === false) {
        checkForWinner(table);
    }
}

function checkForBankrupt(table) {
    var i;
    for (i = 0; i < table.players.length; i += 1) {
        if (table.players[i].chips === 0) {
          table.gameLosers.push( table.players[i] );
            console.info('player ' + table.players[i].playerName + ' is going bankrupt');
            table.players.splice(i, 1);
        }
    }
}

function Hand(cards) {
    this.cards = cards;
}

function progress(table) {
    table.eventEmitter.emit( "turn" );
    var i, j, cards, hand, handEvaluation;
    if (table.game && checkForEndOfRound(table) === true) {
        table.currentPlayer = (table.currentPlayer >= table.players.length - 1) ? (table.currentPlayer - table.players.length + 1) : (table.currentPlayer + 1);
        //Move all bets to the pot
        for (i = 0; i < table.game.bets.length; i += 1) {
            table.game.pot += parseInt(table.game.bets[i], 10);
            table.game.roundBets[i] += parseInt(table.game.bets[i], 10);
        }
        // decide what to do next
        switch (table.game.roundName) {
            case 'River':
                table.game.roundName = 'Showdown';
                table.game.bets.splice(0, table.game.bets.length);
                //Evaluate each hand
                for (j = 0; j < table.players.length; j += 1) {
                    cards = table.players[j].cards.concat(table.game.board);
                    hand = new Hand(cards);
                    handEvaluation = handEvaluator.evalHand(hand.cards);
                    table.players[j].hand = {rank: handEvaluation.handRank, message: handEvaluation.handName};
                }
                checkForWinner(table);
                checkForBankrupt(table);
                table.eventEmitter.emit( "gameOver" );
                break;
            case 'Turn':
                console.info('effective turn');
                table.game.roundName = 'River';
                prepareNextBettingRound(table, 1);
                break;
            case 'Flop':
                console.info('effective flop');
                table.game.roundName = 'Turn';
                prepareNextBettingRound(table, 1);
                break;
            case 'Deal':
                console.info('effective deal');
                table.game.roundName = 'Flop';
                prepareNextBettingRound(table, 3);
        }
    }
}

function prepareNextBettingRound(table, numOfCards) {
  table.game.deck.pop(); //Burn a card
  for (var i = 0; i < numOfCards; i += 1) { //Turn numOfCards cards, either 1 or 3
    table.game.board.push(table.game.deck.pop());
  }
  for (var i = 0; i < table.game.bets.length; i += 1) {
    table.game.bets[i] = 0;
  }
  for (var i = 0; i < table.players.length; i += 1) {
    table.players[i].talked = false;
  }
  table.game.lastRaise = 0; // after a round is over, the min raise becomes the bigBlind again
  table.eventEmitter.emit( "deal" );
}

function Game(smallBlind, bigBlind) {
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.smallBlindPlayer = 0;
    this.bigBlindPlayer = 0;
    this.pot = 0;
    this.lastRaise = bigBlind; //Value of the last bet/raise (excluding incomplete all-ins); starts with bigBlind
    this.roundName = 'Deal'; //Start the first round
    this.betName = 'bet'; //bet,raise,re-raise,cap
    this.bets = [];
    this.roundBets = [];
    this.deck = [];
    this.board = [];
    fillDeck(this.deck);
}

/*
 * Helper Methods Public
 */
// newRound helper
Table.prototype.getHandForPlayerName = function( playerName ){
  for( var i in this.players ){
    if( this.players[i].playerName === playerName ){
      return this.players[i].cards;
    }
  }
  return [];
};

Table.prototype.getDeal = function(){
  return this.game.board;
};

Table.prototype.getEventEmitter = function() {
  return this.eventEmitter;
};

Table.prototype.getCurrentPlayer = function(){
  return this.players[ this.currentPlayer ].playerName;
};

Table.prototype.getPreviousPlayerAction = function(){
  return this.turnBet;
};

Table.prototype.getWinners = function(){
  return this.gameWinners;
};

Table.prototype.getLosers = function(){
  return this.gameLosers;
};

Table.prototype.getAllHands = function(){
  var all = this.losers.concat( this.players );
  var allHands = [];
  for( var i in all ){
    allHands.push({
      playerName: all[i].playerName,
      chips: all[i].chips,
      hand: all[i].cards,
    });
  }
  return allHands;
};

Table.prototype.initNewRound = function () {
    var i;
    this.dealer += 1;
    if (this.dealer >= this.players.length) {
        this.dealer = 0;
    }
    this.game.pot = 0;
    this.game.roundName = 'Deal'; //Start the first round
    this.game.betName = 'bet'; //bet,raise,re-raise,cap
    this.game.bets.splice(0, this.game.bets.length);
    this.game.deck.splice(0, this.game.deck.length);
    this.game.board.splice(0, this.game.board.length);
    for (i = 0; i < this.players.length; i += 1) {
        this.players[i].folded = false;
        this.players[i].talked = false;
        this.players[i].allIn = false;
        this.players[i].cards.splice(0, this.players[i].cards.length);
    }
    fillDeck(this.game.deck);
    this.NewRound();
};

Table.prototype.StartGame = function () {
    //If there is no current game and we have enough players, start a new game.
    if (!this.game) {
        this.game = new Game(this.smallBlind, this.bigBlind);
        this.NewRound();
    }
};

Table.prototype.AddPlayer = function (playerName, chips) {
  if ( chips >= this.minBuyIn && chips <= this.maxBuyIn) {
    var player = new Player(playerName, chips, this);
    this.playersToAdd.push( player );
  }
  else
  {
    throw new InvalidActionError("Wrong chip count; player not added!")
  }
  if ( this.players.length === 0 && this.playersToAdd.length === this.maxPlayers ){
    this.StartGame();
  }
};

Table.prototype.removePlayer = function (playerName){
  for( var i in this.players ){
    if( this.players[i].playerName === playerName ){
      this.playersToRemove.push( i );
      this.players[i].Fold();
    }
  }
  for( var i in this.playersToAdd ){
    if( this.playersToAdd[i].playerName === playerName ){
      this.playersToAdd.splice(i, 1);
    }
  }
};

Table.prototype.NewRound = function() {
  // Add players in waiting list
  var removeIndex = 0;
  for( var i in this.playersToAdd ){
    if( removeIndex < this.playersToRemove.length ){
      var index = this.playersToRemove[ removeIndex ];
      this.players[ index ] = this.playersToAdd[ i ];
      removeIndex += 1;
    }else{
      this.players.push( this.playersToAdd[i] );
    }
  }
  this.playersToRemove = [];
  this.playersToAdd = [];
  this.gameWinners = [];
  this.gameLosers = [];


  var i, smallBlind, bigBlind;
  //Deal 2 cards to each player
  //go around the table 2 times and give out one card to each player each time, needs 2 loops
  //we could give out the top 2 cards to each player in one loop but that wouldn't be proper
  for (i = 0; i < this.players.length; i += 1) {
      this.players[i].cards.push(this.game.deck.pop());
      this.game.bets[i] = 0;
      this.game.roundBets[i] = 0;
  }
  for (i = 0; i < this.players.length; i += 1) {
      this.players[i].cards.push(this.game.deck.pop());
  }

  //Identify Small and Big Blind player indexes
  if (this.players.length == 2) { //Special case for heads-up (2 players) where dealer posts small blind
    smallBlind = this.dealer;
    bigBlind = + !this.dealer; // opposite of dealer (if dealer is 0, this is 1; if dealer is 0, this is 0)
  } else {
    smallBlind = this.dealer + 1;
    if (smallBlind >= this.players.length) {
      smallBlind = 0;
    }
    bigBlind = this.dealer + 2;
    if (bigBlind >= this.players.length) {
      bigBlind -= this.players.length;
    }
  }

  //Force Blind Bets
  this.players[smallBlind].chips -= this.smallBlind;
  this.players[bigBlind].chips -= this.bigBlind;
  this.game.bets[smallBlind] = this.smallBlind;
  this.game.bets[bigBlind] = this.bigBlind;
  this.game.smallBlindPlayer = smallBlind;
  this.game.bigBlindPlayer = bigBlind;

  // get currentPlayer
  this.currentPlayer = bigBlind + 1;
  if( this.currentPlayer >= this.players.length ) {
    this.currentPlayer -= this.players.length;
  }

  this.eventEmitter.emit( "newRound" );
};

Player.prototype.GetChips = function(cash) {
    this.chips += cash;
};

// Player actions: Check(), Fold(), Bet(bet), Call(), AllIn()
Player.prototype.Check = function() {
    var checkAllow, playerIndex;
    playerIndex = this.table.players.indexOf(this);
    //A player can only check if no-one has bet yet, or the player that posted the big blind can check if no-one else
    // raised during the Deal round
    if (
        this.table.game.roundName == 'Deal' &&
        getMaxBet(this.table.game.bets) <= this.table.game.bigBlind &&
        this.table.game.bigBlindPlayer === playerIndex
    ) {
        checkAllow = true;
    } else {
        //Check is possible is the maximum bet posted so far is 0
        checkAllow = (getMaxBet(this.table.game.bets) === 0);
    }
    if (checkAllow) {
        this.table.game.bets[playerIndex] = this.table.game.roundName == 'Deal' ? this.table.game.bigBlind : 0;
        this.talked = true;
        //Attempt to progress the game
        this.turnBet = {action: "check", playerName: this.playerName};
        progress(this.table);
    } else {
        throw new InvalidActionError("Check not allowed, replay please");
    }
};

Player.prototype.Fold = function() {
    var bet, playerIndex;
    playerIndex = this.table.players.indexOf(this);

    //Move any current bet into the pot
    bet = parseInt(this.table.game.bets[playerIndex], 10);
    this.table.game.bets[playerIndex] = 0;
    this.table.game.pot += bet;
    this.talked = true;

    //Mark the player as folded
    this.folded = true;
    this.turnBet = {action: "fold", playerName: this.playerName};

    //Attempt to progress the game
    progress(this.table);
};

Player.prototype.Bet = function(bet) {
    var playerIndex;
    playerIndex = this.table.players.indexOf(this);

    if (this.chips < bet) {
        throw new InvalidActionError("This player doesn't have enough chips for this raise; fold, try a lower raise or go all-in instead.");
    }

    // a bet can never be for an amount smaller than the big blind
    // e.g. in the flop round, the minimum amount that can be bet is the big blind, even thought he min raise is 0
    else if (bet < this.table.game.bigBlind) {
        throw new InvalidActionError("Bet or raise can't for an amount less than the big blind.")
    }

    // Bet() is used to opening bets and raises only; checks, calls and all-ins should be done through their respective methods
    // e.g. if the current highest bet is 10, and this is a bet that will bring this player's total to 10, this is just a call
    else if (bet + this.table.game.bets[playerIndex] <= getMaxBet(this.table.game.bets)) {
        throw new InvalidActionError("Amount of raise is too low; if this was intended as a call, then use the Call() method instead.")
    }

    // the total amount of this raise (current raise + any previous bets/raises/calls made) needs to be more than
    // the highest bet so far + min legal raise amount; e.g. flop turn, player A bets 5 (min raise amount now 5),
    // player B bets 15 (min raise amount now 10), player A should bet at least 20 for a legal raise (min raise
    // amount would be last bet + min raise = 15 + 10 = 25; current player already bet 5 before, so 5 + 20 = 25 would
    // meet the requirements for a min raise)
    else if (bet + this.table.game.bets[playerIndex] < this.table.game.lastRaise + getMaxBet(this.table.game.bets)) {
        throw new InvalidActionError("Amount of raise is too low; player must raise at least "+this.table.game.lastRaise+" more.");
    }

    // the new min raise amount should be the total amount of this raise (bet amount + any previous bets/raises/calls
    // made by this player) minus the highest previous bet made; e.g. previous bet was 15, this bet's total is 25,
    // then new min raise amount is 10
    this.table.game.lastRaise = bet + this.table.game.bets[playerIndex] - getMaxBet(this.table.game.bets);
    this.table.game.bets[playerIndex] += bet;
    this.chips -= bet;
    this.talked = true;

    //Attempt to progress the game
    this.turnBet = {action: "bet", playerName: this.playerName, amount: bet};
    progress(this.table);
};

Player.prototype.Call = function() {
    var maxBet, playerIndex;
    maxBet = getMaxBet(this.table.game.bets);

    if (this.chips < maxBet) {
        throw new InvalidActionError("This player doesn't have enough chips to call; fold or go all-in instead.");
    }

    //Match the highest bet
    playerIndex = this.table.players.indexOf(this);
    if (this.table.game.bets[playerIndex] >= 0) {
        this.chips += this.table.game.bets[playerIndex];
    }
    this.chips -= maxBet;
    this.table.game.bets[playerIndex] = maxBet;
    this.talked = true;

    //Attempt to progress the game
    this.turnBet = {action: "call", playerName: this.playerName, amount: maxBet};
    progress(this.table);
};

Player.prototype.AllIn = function() {
    var allInValue = 0, playerIndex;
    playerIndex = this.table.players.indexOf(this);
    if (this.table.players[playerIndex].chips !== 0) {
        allInValue = this.table.players[playerIndex].chips;

        //if dealing with an "incomplete raise all-in" (all-in amount that is less than previous raise amount),
        //then the raise amount stays the same; for more info, see
        // http://neilwebber.com/notes/2013/07/25/the-most-misunderstood-poker-rule-nlhe-incomplete-raise-all-in/
        //otherwise the all-in is a valid raise and the value of lastRaise is increased like any other raise
        if (allInValue > this.lastRaise) {
            this.table.game.lastRaise = allInValue;
        }

        this.table.game.bets[playerIndex] += this.table.players[playerIndex].chips;
        this.table.players[playerIndex].chips = 0;

        this.allIn = true;
        this.talked = true;
    }

    //Attempt to progress the game
    this.turnBet = {action: "allin", playerName: this.playerName, amount: allInValue};
    progress(this.table);
};

exports.Table = Table;
