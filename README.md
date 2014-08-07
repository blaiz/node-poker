# Poker Texas Hold 'em No Limit engine for node.js

## Example usage

```js
// require the library
var poker = require('./lib/node-poker');

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
console.info(table);
console.info(table.game);
console.info(table.players);

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
console.info(table.gameWinners); // player(s) who won the pot
console.info(table.gameLosers); // player(s) who lost all their chips

// after the showdown, start a new round
table.initNewRound(); 
```
