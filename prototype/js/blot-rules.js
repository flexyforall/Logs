// Blot rules engine (from Blot_Rules_EN.pdf). Pure logic, no DOM: the table screen will
// drive the game through window.BlotRules. Nothing here is wired to the UI yet.
//
// Seats are named by where they sit on screen. Partners sit opposite each other:
// team "us" = bottom + top, team "them" = left + right. "Next" always means clockwise,
// which on the top-down table is bottom -> left -> top -> right.
(function (root) {
  var SEATS = ['bottom', 'left', 'top', 'right'];           // clockwise
  var TEAM = { bottom: 'us', top: 'us', left: 'them', right: 'them' };
  var SUITS = ['C', 'D', 'H', 'S'];                          // clubs, diamonds, hearts, spades
  var NO_TRUMP = 'NT';                                       // "boy": the round is played without trump
  var RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];     // natural order, used for sequences
  var GAME_TARGET = 301;                                     // first team to reach this wins
  var MIN_BID = 8;                                           // lowest opening bid (not set by the rules)
  var MAX_BID = 25;                                          // above this a bid is a kaput
  var PACKETS = [3, 2, 3];                                   // deal: 8 cards each in packets (from the scene)

  // ---------- Cards ----------
  function card(rank, suit) { return { rank: rank, suit: suit, id: rank + suit }; }
  function makeDeck() {
    var d = [];
    SUITS.forEach(function (s) { RANKS.forEach(function (r) { d.push(card(r, s)); }); });
    return d;
  }
  function shuffle(deck, rnd) {
    rnd = rnd || Math.random;
    var a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function next(seat) { return SEATS[(SEATS.indexOf(seat) + 1) % 4]; }
  function partner(seat) { return SEATS[(SEATS.indexOf(seat) + 2) % 4]; }
  function teamOf(seat) { return TEAM[seat]; }
  function other(team) { return team === 'us' ? 'them' : 'us'; }
  // seats in play order starting with the one after `seat`
  function orderAfter(seat) { var o = [], s = seat; for (var i = 0; i < 4; i++) { s = next(s); o.push(s); } return o; }

  // Deal the deck from the top, packet by packet, starting with the player after the dealer.
  // Returns { hands: {seat: [cards]}, sequence: [{seat, card}] } — the sequence is for the animation.
  function deal(deck, dealer) {
    var hands = { bottom: [], left: [], top: [], right: [] }, seq = [], k = 0, order = orderAfter(dealer);
    PACKETS.forEach(function (n) {
      order.forEach(function (seat) {
        for (var i = 0; i < n; i++) { var c = deck[k++]; hands[seat].push(c); seq.push({ seat: seat, card: c }); }
      });
    });
    return { hands: hands, sequence: seq };
  }

  // ---------- Card strength ----------
  var PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];   // weakest -> strongest
  var TRUMP_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
  // Strength of a card within a trick: trumps beat everything, then the led suit; other suits never win.
  function power(c, trump, led) {
    if (trump !== NO_TRUMP && c.suit === trump) return 100 + TRUMP_ORDER.indexOf(c.rank);
    if (c.suit === led) return 10 + PLAIN_ORDER.indexOf(c.rank);
    return 0;
  }
  // plays: [{seat, card}] in the order they were played. Returns the winning play.
  function trickWinner(plays, trump) {
    var led = plays[0].card.suit, best = plays[0];
    plays.forEach(function (p) { if (power(p.card, trump, led) > power(best.card, trump, led)) best = p; });
    return best;
  }

  // ---------- Legal moves ----------
  // hand: cards of the player to move; plays: cards already on the table this trick.
  function legalMoves(hand, plays, trump, seat) {
    if (!plays.length) return hand.slice();
    var led = plays[0].card.suit;
    var isTrump = function (c) { return trump !== NO_TRUMP && c.suit === trump; };
    var best = trickWinner(plays, trump);
    var bestPower = power(best.card, trump, led);
    var overTrumps = hand.filter(function (c) { return isTrump(c) && power(c, trump, led) > bestPower; });

    if (!isTrump(plays[0].card)) {
      var follow = hand.filter(function (c) { return c.suit === led; });
      if (follow.length) return follow;
      // no card of the led suit: must trump in with a trump that beats the table,
      // unless the partner is already winning the trick
      if (overTrumps.length && best.seat !== partner(seat)) return overTrumps;
      return hand.slice();
    }
    // a trump was led: beat it if possible, else any trump, else anything
    if (overTrumps.length) return overTrumps;
    var trumps = hand.filter(isTrump);
    return trumps.length ? trumps : hand.slice();
  }

  // ---------- Card points ----------
  var PLAIN_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
  function cardPoints(c, trump) {
    if (trump === NO_TRUMP) return c.rank === 'A' ? 19 : PLAIN_POINTS[c.rank];
    if (c.suit === trump) { if (c.rank === 'J') return 20; if (c.rank === '9') return 14; }
    return PLAIN_POINTS[c.rank];
  }
  function stockPoints(cards, trump) { return cards.reduce(function (s, c) { return s + cardPoints(c, trump); }, 0); }
  var LAST_TRICK_BONUS = 10, KAPUT_POINTS = 250;

  // ---------- Combinations ----------
  // Types, strongest first. Points are in game units (1 unit = 10 card points).
  var COMBO_RANK = { four: 4, hundred: 3, fifty: 2, terz: 1 };
  var FOUR_HEAD_ORDER = ['Q', 'K', '10', 'A', '9', 'J', '8'];     // weakest -> strongest
  var SEQ_HEAD_ORDER = ['9', '10', 'J', 'Q', 'K', 'A'];           // weakest -> strongest
  function fourPoints(rank, trump) {
    if (rank === 'J') return 20;
    if (rank === '9') return trump === NO_TRUMP ? 10 : 14;
    if (rank === 'A') return trump === NO_TRUMP ? 19 : 10;
    if (rank === '8') return 0;   // no points, but outranks every other combination
    return 10;                    // K, Q, 10
  }
  // Every candidate combination in a hand: all 4-of-a-kind (not 7s) and every 3-, 4- or 5-card
  // run inside each same-suit sequence.
  function candidates(hand, trump) {
    var out = [];
    RANKS.forEach(function (r) {
      if (r === '7') return;
      var cs = hand.filter(function (c) { return c.rank === r; });
      if (cs.length === 4) out.push({ type: 'four', head: r, points: fourPoints(r, trump), cards: cs, suit: null });
    });
    SUITS.forEach(function (s) {
      var has = RANKS.map(function (r) { return hand.find(function (c) { return c.rank === r && c.suit === s; }); });
      for (var i = 0; i < 8; i++) for (var len = 3; len <= 5 && i + len <= 8; len++) {
        var run = has.slice(i, i + len);
        if (run.every(Boolean)) {
          var type = len === 3 ? 'terz' : len === 4 ? 'fifty' : 'hundred';
          out.push({ type: type, head: RANKS[i + len - 1], points: { terz: 2, fifty: 5, hundred: 10 }[type], cards: run, suit: s });
        }
      }
    });
    return out;
  }
  // Strength of a single combination for comparison (type, then head, then trump suit).
  function comboStrength(c, trump) {
    var head = c.type === 'four' ? FOUR_HEAD_ORDER.indexOf(c.head) : SEQ_HEAD_ORDER.indexOf(c.head);
    return COMBO_RANK[c.type] * 100 + head * 2 + (c.suit && c.suit === trump ? 1 : 0);
  }
  // The best non-overlapping set of combinations a hand can declare: most points first,
  // then the strongest top combination.
  function bestCombinations(hand, trump) {
    var cand = candidates(hand, trump), best = [], bestKey = [-1, -1];
    (function search(i, chosen, used) {
      if (i === cand.length) {
        var pts = chosen.reduce(function (s, c) { return s + c.points; }, 0);
        var top = chosen.reduce(function (m, c) { return Math.max(m, comboStrength(c, trump)); }, 0);
        if (pts > bestKey[0] || (pts === bestKey[0] && top > bestKey[1])) { bestKey = [pts, top]; best = chosen.slice(); }
        return;
      }
      search(i + 1, chosen, used);
      var c = cand[i];
      if (c.cards.every(function (x) { return !used[x.id]; })) {
        var u = Object.assign({}, used);
        c.cards.forEach(function (x) { u[x.id] = true; });
        search(i + 1, chosen.concat([c]), u);
      }
    })(0, [], {});
    return best;
  }
  // Blot-rebot: trump K and Q in one hand, 2 units, counted regardless of other combinations.
  function hasBlotRebot(hand, trump) {
    if (trump === NO_TRUMP) return false;
    var k = hand.some(function (c) { return c.rank === 'K' && c.suit === trump; });
    var q = hand.some(function (c) { return c.rank === 'Q' && c.suit === trump; });
    return k && q;
  }
  // Which team's combinations count. Only one team scores combinations: the one holding the
  // strongest single combination. Equal strength goes to whoever gets to show first,
  // i.e. who plays first in the first trick (`leader`).
  // combosBySeat: {seat: [combinations]}. Returns { team, points } (team null when nobody has any).
  function comboWinner(combosBySeat, trump, leader) {
    var order = [leader].concat(orderAfter(leader).slice(0, 3)), best = null, bestSeat = null;
    order.forEach(function (seat) {
      (combosBySeat[seat] || []).forEach(function (c) {
        if (!best || comboStrength(c, trump) > comboStrength(best, trump)) { best = c; bestSeat = seat; }
      });
    });
    if (!best) return { team: null, points: 0 };
    var team = teamOf(bestSeat), pts = 0;
    SEATS.forEach(function (s) {
      if (teamOf(s) === team) (combosBySeat[s] || []).forEach(function (c) { pts += c.points; });
    });
    return { team: team, points: pts };
  }

  // ---------- Bidding ----------
  // A bid: { seat, value, suit (C/D/H/S/NT), kaput }. "value" x means "we take at least 10x
  // points, counting our combinations". Pass = null.
  function bidBeats(bid, current) {
    if (!bid.kaput && (bid.value < MIN_BID || bid.value > MAX_BID)) return false;
    if (!current) return true;
    if (current.kaput && !bid.kaput) return false;   // after a kaput bid only kaput bids may follow
    if (bid.kaput && !current.kaput) return true;
    return bid.value > current.value;
  }
  function canDeclareKaput(value) { return value > 25; }

  // ---------- Round result ----------
  // r = {
  //   bid: { team, value, suit, kaput, contra, sur },
  //   stock: { us: [cards], them: [cards] },     // cards taken by each team
  //   lastTrick: 'us' | 'them',                   // who took the 8th trick
  //   combos: { team, points },                   // from comboWinner
  //   blotRebot: 'us' | 'them' | null
  // }
  // Returns { us, them, made, kaput } — points added to each team's game score (game units).
  function roundResult(r) {
    var trump = r.bid.suit, bidder = r.bid.team, def = other(bidder);
    var cards = { us: stockPoints(r.stock.us, trump), them: stockPoints(r.stock.them, trump) };
    cards[r.lastTrick] += LAST_TRICK_BONUS;
    var kaputTeam = !r.stock.us.length ? 'them' : !r.stock.them.length ? 'us' : null;
    if (kaputTeam) { cards[kaputTeam] = KAPUT_POINTS; cards[other(kaputTeam)] = 0; }
    var extra = { us: 0, them: 0 };
    if (r.combos && r.combos.team) extra[r.combos.team] += r.combos.points;
    if (r.blotRebot) extra[r.blotRebot] += 2;
    var units = function (p) { return Math.round(p / 10); };
    var x = r.bid.value, y = units(cards[bidder]) + extra[bidder];
    // a declared kaput is made only by taking every card (more than 25 is out of reach otherwise)
    var made = r.bid.kaput ? kaputTeam === bidder : y >= x;
    var z = extra.us + extra.them;
    var out = { us: 0, them: 0, made: made, kaput: kaputTeam };

    if (r.bid.contra || r.bid.sur) {
      // contra / sur: the side that was wrong scores nothing
      var winner = made ? bidder : def;
      out[winner] = (r.bid.sur ? 4 : 2) * x + 16 + z;
      return out;
    }
    if (made) {
      out[bidder] = x + y;
      out[def] = units(cards[def]) + extra[def];
    } else {
      out[def] = x + 16 + z;
    }
    return out;
  }

  root.BlotRules = {
    SEATS: SEATS, SUITS: SUITS, RANKS: RANKS, NO_TRUMP: NO_TRUMP, GAME_TARGET: GAME_TARGET, PACKETS: PACKETS,
    MIN_BID: MIN_BID, MAX_BID: MAX_BID,
    card: card, makeDeck: makeDeck, shuffle: shuffle, deal: deal,
    next: next, partner: partner, teamOf: teamOf, orderAfter: orderAfter,
    power: power, trickWinner: trickWinner, legalMoves: legalMoves,
    cardPoints: cardPoints, stockPoints: stockPoints,
    bestCombinations: bestCombinations, hasBlotRebot: hasBlotRebot, comboWinner: comboWinner,
    bidBeats: bidBeats, canDeclareKaput: canDeclareKaput, roundResult: roundResult
  };
})(typeof window !== 'undefined' ? window : globalThis);
