var handEvaluator = require('poker-evaluator');

function Table (smallBlind, bigBlind, minPlayers, maxPlayers, minBuyIn, maxBuyIn) {
    //  The blinds amounts
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minPlayers = minPlayers;
    this.maxPlayers =  maxPlayers;
    this.players = [];

    this.minBuyIn = minBuyIn;
    this.maxBuyIn = maxBuyIn;
    //  Keep track of all the events so we can display in the console
    this.events = [];

    //Validate acceptable value ranges.
    //  Require at least two players to start a game.
    if (minPlayers < 2) { 
        throw new Error(101, 'Parameter [minPlayers] must be a postive integer of a minimum value of 2.');
    } else if (maxPlayers > 10) { //hard limit of 10 players at a table.
        throw new Error(102, 'Parameter [maxPlayers] must be a positive integer less than or equal to 10.');
    } else if (minPlayers > maxPlayers) { //Without this we can never start a game!
        throw new Error(103, 'Parameter [minPlayers] must be less than or equal to [maxPlayers].');
    }
}

function Game () {
    //  The blinds indexes, not amounts
    this.smallBlind = 0;
    this.bigBlind = 1;
    //Track the dealer position between games
    this.dealer = 0;
    // tracks if the game is over
    this.over = false;
    // Track whose turn it is
    this.turn = 0;
    this.pot = 0;
    this.lastRaise = 0; // Value of the last bet/raise (excluding incomplete all-ins)
    //Start the first round
    this.roundName = 'Deal';
    //bet,raise,re-raise,cap
    this.betName = 'Bet'; 
    //  Holds the bet amounts of each player via index, ie. If player0 posted small blind of 50 then bets[0] = 50
    this.bets = [];
    this.roundBets = [];
    this.deck = [];
    this.board = [];
    
    fillDeck(this.deck);
}

function Player (userID, playerID, playerName, chips, table) {
    this.userID = userID;
    this.playerID = playerID;
    this.playerName = playerName;
    this.chips = chips;
    this.folded = false;
    this.allIn = false;
    //  Has a player acted yet
    this.acted = false;
    // Just added player shouldn't be able to play until next hand
    this.justAdded = true;
    this.table = table; //Circular reference to allow reference back to parent object.
    this.cards = [];
}

function InvalidActionError(message) {
    this.message = message;
    this.name = "InvalidActionError";
}

function fillDeck (deck) {
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
    for (var i = 0; i < deck.length; i += 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = deck[j];
        deck[j] = deck[i];
        deck[i] = temp;
    }
}

function getMaxBet (bets) {
    var maxBet = 0;
    for (var i = 0; i < bets.length; i += 1) {
        if (bets[i] > maxBet) {
            maxBet = bets[i];
        }
    }
    return maxBet;
}

function checkForEndOfRound (table) {
    var endOfRound = true;
    var maxBet = getMaxBet(table.game.bets);

    //For each player, check
    for (var i = 0; i < table.players.length; i += 1) {
        if (table.players[i].justAdded === true) {
            continue;
        }
        if (table.players[i].folded === false) {
            if (table.players[i].acted === false || table.game.bets[i] !== maxBet) {
                if (table.players[i].allIn === false) {
                    endOfRound = false;
                }
            }
        }
    }

    return endOfRound;
}

function checkForAllInPlayer (table, winners) {
    var allInPlayer = [];
    for (var i = 0; i < winners.length; i += 1) {
        if (table.players[winners[i]].allIn === true) {
            allInPlayer.push(winners[i]);
        }
    }
    return allInPlayer;
}

function checkForWinner (table) {
    //Identify winner(s)
    var winners = [];
    var maxRank = 0;

    for (var k = 0; k < table.players.length; k += 1) {
        if (table.players[k].justAdded === true) {
            continue;
        }
        if (table.players[k].hand.rank === maxRank && table.players[k].folded === false) {
            winners.push(k);
        }
        if (table.players[k].hand.rank > maxRank && table.players[k].folded === false) {
            maxRank = table.players[k].hand.rank;
            winners.splice(0, winners.length);
            winners.push(k);
        }
    }

    var part = 0;
    var prize = 0;
    var allInPlayer = checkForAllInPlayer(table, winners);

    if (allInPlayer.length > 0) {
        var minBets = table.game.roundBets[winners[0]];
        for (var j = 1; j < allInPlayer.length; j += 1) {
            if (table.game.roundBets[winners[j]] !== 0 && table.game.roundBets[winners[j]] < minBets) {
                minBets = table.game.roundBets[winners[j]];
            }
        }
        part = parseInt(minBets, 10);
    } else {
        part = parseInt(table.game.roundBets[winners[0]], 10);

    }

    for (var l = 0; l < table.game.roundBets.length; l += 1) {
        if (table.game.roundBets[l] > part) {
            prize += part;
            table.game.roundBets[l] -= part;
        } else {
            prize += table.game.roundBets[l];
            table.game.roundBets[l] = 0;
        }
    }

    for (var i = 0; i < winners.length; i += 1) {
        table.players[winners[i]].chips += prize / winners.length;

        if (table.game.roundBets[winners[i]] === 0) {
            table.players[winners[i]].folded = true;
        }

        table.AddEvent('Dealer', table.players[winners[i]].playerName + ' wins !!');
    }

    var roundEnd = true;

    for (var l = 0; l < table.game.roundBets.length; l += 1) {
        if (table.game.roundBets[l] !== 0) {
            roundEnd = false;
        }
    }
    if (roundEnd === false) {
        checkForWinner(table);
    }
}

function checkForBankrupt (table) {
    for (var i = 0; i < table.players.length; i += 1) {
        if (table.players[i].justAdded === true) {
            continue;
        }
        if (table.players[i].chips === 0) {
            table.AddEvent('Dealer', table.players[winners[i]].playerName + ' has been eliminated');
            // Remove a player when they have no more chips
            table.players.splice(i, 1);
        }
    }
}

function updateTurn (table) {
    if (table.game) {
        // skip players that were just added and shouldn't play just yet
        do {
            table.game.turn += 1;
        } while (table.players[table.game.turn] !== undefined && table.players[table.game.turn].justAdded !== true);
        if (table.game.turn >= table.players.length) {
            table.game.turn -= table.players.length;
        }
    }
}

// Attempt to move the game along to the next round
// This gets called after each player makes a move or a new player is added
function progress (table) {
    if (table.game) {
        if (checkForEndOfRound(table) === true) {
            //Move all roundBets to the pot
            for (var i = 0; i < table.game.bets.length; i += 1) {
                table.game.pot += parseInt(table.game.bets[i], 10);
                table.game.roundBets[i] += parseInt(table.game.bets[i], 10);
            }

            switch (table.game.roundName) {
                case 'River':
                    table.game.roundName = 'Showdown';
                    table.AddEvent('Dealer', '** Showdown **');
                    table.game.bets.splice(0, table.game.bets.length);
                    table.game.turn = null;

                    //Evaluate each hand
                    for (var j = 0; j < table.players.length; j += 1) {
                        if (table.players[j].justAdded === true) {
                            continue;
                        }
                        var cards = table.players[j].cards.concat(table.game.board);
                        var hand = new Hand(cards);
                        var handEvaluation = handEvaluator.evalHand(hand.cards);
                        table.players[j].hand = {rank: handEvaluation.handRank, message: handEvaluation.handName};
                    }
                    checkForWinner(table);
                    checkForBankrupt(table);

                    // If we still have enough players start a new round
                    if (table.players.length >= table.minPlayers) {
                        table.initNewRound();
                    } else {
                        // game over
                        table.AddEvent('Dealer', 'Game is over');
                        table.game.over = true;
                    }
                    break;

                case 'Turn':
                    table.game.roundName = 'River';
                    table.AddEvent('Dealer', 'Dealing river card');
                    prepareNextBettingRound(table, 1);
                    break;

                case 'Flop':
                    table.game.roundName = 'Turn';
                    table.AddEvent('Dealer', 'Dealing turn card');
                    prepareNextBettingRound(table, 1);
                    break;

                //  On the start of the game this is where we begin
                case 'Deal':
                    table.game.roundName = 'Flop';
                    table.AddEvent('Dealer', 'Dealing flop');
                    prepareNextBettingRound(table, 3);
            }
        }
    }
}

function prepareNextBettingRound(table, numOfCards) {
    table.game.deck.pop(); //Burn a card
    // Set the turn to the first position after the dealer
    table.game.turn = table.game.dealer + 1;

    for (var i = 0; i < numOfCards; i += 1) { //Turn numOfCards cards
        table.game.board.push(table.game.deck.pop());
    }

    for (var i = 0; i < table.game.bets.length; i += 1) {
        table.game.bets[i] = 0;
    }
    for (var i = 0; i < table.players.length; i += 1) {
        table.players[i].acted = false;
    }
}


//  This gets called when a new round is started. ie. after a showdown
Table.prototype.initNewRound = function () {
    //  Move the button
    this.game.dealer += 1;

    if (this.game.dealer >= this.players.length) {
        this.game.dealer = 0;
    }

    this.game.pot = 0;
    this.game.roundName = 'Deal'; //Start the first round
    this.game.betName = 'Bet'; //bet,raise,re-raise,cap
    this.game.bets.splice(0, this.game.bets.length);
    this.game.deck.splice(0, this.game.deck.length);
    this.game.board.splice(0, this.game.board.length);

    for (var i = 0; i < this.players.length; i += 1) {
        this.players[i].folded = false;
        this.players[i].acted = false;
        this.players[i].allIn = false;
        this.players[i].justAdded = false;
        this.players[i].cards.splice(0, this.players[i].cards.length);
    }

    fillDeck(this.game.deck);
    this.NewRound();
};

Table.prototype.StartGame = function () {
    //If there is no current game and we have enough players, start a new game.
    if (!this.game && this.players.length >= this.minPlayers) {
        this.game = new Game();
        // Pick a player at random to be the first dealer
        this.game.dealer = Math.floor(Math.random() * this.players.length);
        this.AddEvent('Dealer','Start Game');
        this.NewRound();
    }
};

Table.prototype.AddPlayer = function (userID, playerID, playerName, chips) {
    if (this.players.length < this.maxPlayers && chips >= this.minBuyIn && chips <= this.maxBuyIn) {
        var player = new Player(userID, playerID, playerName, chips, this);
        this.players.push(player);

        progress(this);
    }
};

Table.prototype.AddEvent = function (name, event) {
    this.events.push({
        time: Date.now(), 
        name: name,
        event: event
    });
};

// Returns the summation of all the bets currently active
Game.prototype.Pot = function () {
    var pot = this.pot;

    //Move all bets to the pot
    for (i = 0; i < this.bets.length; i += 1) {
        pot += parseInt(this.bets[i], 10);
    }

    return pot;
};

Table.prototype.NewRound = function() {
    this.AddEvent('Dealer','Starting new round');
    this.AddEvent('Dealer','Dealing hold cards');

    //Deal 2 cards to each player
    //go around the table 2 times and give out one card to each player each time, needs 2 loops for that
    //we could give out the top 2 cards to each player in one loop but that wouldn't be proper Poker
    for (var i = 0; i < this.players.length; i += 1) {
        this.players[i].cards.push(this.game.deck.pop());
        this.game.bets[i] = 0;
        this.game.roundBets[i] = 0;
    }
    for (var i = 0; i < this.players.length; i += 1) {
        this.players[i].cards.push(this.game.deck.pop());
    }

    //  Identify Small and Big Blind player indexes
    if (this.players.length === 2) {
        this.game.smallBlind = this.game.dealer;
    } else {
        this.game.smallBlind = this.game.dealer + 1;
    }
    
    if (this.game.smallBlind >= this.players.length) {
        this.game.smallBlind = 0;
    }

    if (this.players.length === 2) {
        this.game.bigBlind = this.game.dealer + 1;
    } else {
        this.game.bigBlind = this.game.dealer + 2;
    }
    
    if (this.game.bigBlind >= this.players.length) {
        this.game.bigBlind -= this.players.length;
    }

    //  Set whose turn it is
    // Heads up has different blinds positions (sb=dealer and acts first at the start)
    if (this.players.length === 2) {
        this.game.turn = this.game.dealer;
    } else {
        this.game.turn = this.game.dealer + 3;
    }

    if (this.game.turn > this.players.length) {
        this.game.turn -= this.players.length;
    }

    //Force Blind Bets
    this.players[this.game.smallBlind].chips -= this.smallBlind;
    this.AddEvent(this.players[this.game.smallBlind].playerName, 'small blind of ' + this.smallBlind);
    this.players[this.game.bigBlind].chips -= this.bigBlind;
    this.AddEvent(this.players[this.game.bigBlind].playerName, 'big blind of ' + this.bigBlind);
    this.game.bets[this.game.smallBlind] = this.smallBlind;
    this.game.bets[this.game.bigBlind] = this.bigBlind;
};

//  Returns an array or the possible plays a player has [call,raise,re-raise,check,fold,allin]
Player.prototype.Options = function() {
    // Default options
    var options = {
        'FOLD': {
            allowed: false
        },
        'CHECK': {
            allowed: false
        },
        'CALL': {
            allowed: false
        },
        'BET': {
            allowed: false
        },
        'RAISE': {
            allowed: false
        }
    };

    //  If its not the players turn return an empty array since they have no options yet
    if (this.table.game.turn === this.playerID) {
        if (this.canFold()) {
            options['FOLD'] = {
                allowed: true,
                name: 'FOLD'
            }
        }

        if (this.canCheck()) {
            options['CHECK'] = {
                allowed: true,
                name: 'CHECK'
            }
        }

        if (this.canCall()) {
            var maxBet = getMaxBet(this.table.game.bets);
            var callAmount = maxBet - this.table.game.bets[this.playerID];

            options['CALL'] = {
                allowed: true,
                name: 'CALL',
                amount: callAmount
            }
        }

        if (this.canBet()) {

            options['BET'] = {
                allowed: true,
                name: 'BET',
                min:0,
                max: this.chips,
                amount:0
            }
        }

        if (this.canRaise()) {
            options['RAISE'] = {
                allowed: true,
                name: "RAISE",
                min:this.table.bigBlind,
                max: this.chips,
                amount:this.table.bigBlind
            }
        }
    }

    return options;
};

Player.prototype.canCheck = function() {
    // A player can only check if no-one has bet yet
    // Moreover, the player that posted the big blind can check if no one else raised during the Deal round
    return (
        this.table.game.roundName == 'Deal' && // If this is the deal round...
        getMaxBet(this.table.game.bets) <= this.table.game.bigBlind && // and no one raised...
        this.table.game.bigBlind === this.playerID // and the current player posted the big blind
    ) ||
    // Otherwise, check is possible if the maximum bet posted so far is 0
    (getMaxBet(this.table.game.bets) === 0);
};

Player.prototype.canBet = function() {
    // A player can make a bet if no other bets are active. Otherwise it would be a raise.
    return (getMaxBet(this.table.game.bets) === 0);
};

Player.prototype.canRaise = function() {
    var maxBet = getMaxBet(this.table.game.bets);
    var bet = this.table.game.bets[this.playerID];

    // Can raise if a bet has been made to the pot
    // raise. The player will be given an opportunity to raise if his bet is
    // lower than the highest bet on the table or if he did not yet talk in this
    // betting round (for instance if he payed the big blind or a late blind).
    return (maxBet != 0 && this.chips > maxBet && (this.acted == false || bet < maxBet ));
};

Player.prototype.canCall = function() {
    var maxBet = getMaxBet(this.table.game.bets);
    var canCheck = this.canCheck();

    return (this.chips > maxBet && canCheck == false);
};

Player.prototype.canFold = function() {
    // A player can fold at any stage during the game, if it's their turn of course
    return true
};

Player.prototype.Check = function() {
    // Only set this to 0 if not checking on the big blind
    if (this.table.game.bigBlind !== this.playerID) {
        this.table.game.bets[this.playerID] = 0;
    }
    this.acted = true;

    updateTurn(this.table);
    //Attempt to progress the game
    progress(this.table);
};

Player.prototype.Fold = function() {
    this.acted = true;
    //Mark the player as folded
    this.folded = true;

    this.table.game.betName = 'Fold';
    updateTurn(this.table);
    //Attempt to progress the game
    progress(this.table);
};

Player.prototype.Bet = function(bet) {
    if (this.chips < bet) {
        throw new InvalidActionError("This player doesn't have enough chips for this raise; fold, try a lower raise or go all-in instead.");
    }

    // a bet can never be for an amount smaller than the big blind
    // e.g. in the flop round, the minimum amount that can be bet is the big blind, even thought the min raise is 0
    else if (bet < this.table.game.bigBlind) {
        throw new InvalidActionError("Bet or raise can't for an amount less than the big blind.")
    }

    // Bet() is used to opening bets and raises only; checks, calls and all-ins should be done through their respective methods
    // e.g. if the current highest bet is 10, and this is a bet that will bring this player's total to 10, this is just a call
    else if (bet + this.table.game.bets[this.playerID] <= getMaxBet(this.table.game.bets)) {
        throw new InvalidActionError("Amount of raise is too low; if this was intended as a call, then use the Call() method instead.")
    }

    // the total amount of this raise (current raise + any previous bets/raises/calls made) needs to be more than
    // the highest bet so far + min legal raise amount; e.g. flop turn, player A bets 5 (min raise amount now 5),
    // player B bets 15 (min raise amount now 10), player A should bet at least 20 for a legal raise (min raise
    // amount would be last bet + min raise = 15 + 10 = 25; current player already bet 5 before, so 5 + 20 = 25 would
    // meet the requirements for a min raise)
    else if (bet + this.table.game.bets[this.playerID] < this.table.game.lastRaise + getMaxBet(this.table.game.bets)) {
        throw new InvalidActionError("Amount of raise is too low; player must raise at least "+this.table.game.lastRaise+" more.");
    }

    console.info('-------------------------------------------------------------------\n');
    console.info(bet);

    // the new min raise amount should be the total amount of this raise (bet amount + any previous bets/raises/calls
    // made by this player) minus the highest previous bet made; e.g. previous bet was 15, this bet's total is 25,
    // then new min raise amount is 10
    this.table.game.lastRaise = bet + this.table.game.bets[playerIndex] - getMaxBet(this.table.game.bets);
    this.table.game.bets[this.playerID] += bet;
    this.chips -= bet;
    this.acted = true;

    console.info(JSON.stringify(this.table.game.bets));

    updateTurn(this.table);
    //Attempt to progress the game
    progress(this.table);
    this.table.game.betName = 'Bet';
};

Player.prototype.Raise = function(bet) {
    this.Bet(bet);
    this.table.game.betName = 'Raise';
};

Player.prototype.ReRaise = function(bet) {
    this.Bet(bet);
    this.table.game.betName = 'Re-raise';
};

Player.prototype.Call = function() {
    var maxBet = getMaxBet(this.table.game.bets);

    if (this.chips < maxBet) {
        throw new InvalidActionError("This player doesn't have enough chips to call; fold or go all-in instead.");
    }

    //Match the highest bet
    this.chips += this.table.game.bets[this.playerID];
    this.chips -= maxBet;
    this.table.game.bets[this.playerID] = maxBet;
    this.acted = true;
    this.table.game.betName = 'Bet';

    updateTurn(this.table);
    //Attempt to move the game along
    progress(this.table);
};

Player.prototype.AllIn = function() {
    if (this.chips !== 0) {
        //if dealing with an "incomplete raise all-in" (all-in amount that is less than previous raise amount),
        //then the raise amount stays the same; for more info, see
        // http://neilwebber.com/notes/2013/07/25/the-most-misunderstood-poker-rule-nlhe-incomplete-raise-all-in/
        //otherwise the all-in is a valid raise and the value of lastRaise is increased like any other raise
        if (this.chips > this.lastRaise) {
            this.table.game.lastRaise = this.chips;
        }

        this.table.game.bets[this.playerID] += this.chips;
        this.chips = 0;
        this.allIn = true;
        this.acted = true;
    }

    this.table.game.betName = 'Allin';
    updateTurn(this.table);
    //Attempt to progress the game
    progress(this.table);

};

exports.Table = Table;