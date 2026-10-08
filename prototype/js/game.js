// Blot game controller: runs whole games on the table screen with the rules from
// js/blot-rules.js. You play the bottom seat; HasmikG (left, Laura's seat), GarikAv (top,
// Don Marco, your partner) and Vazgen1972 (right, Billy) are bots. Animations go through the table's view API (js/table.js),
// the bidding / result panels and the HUD are DOM elements of the table screen.
(function () {
  var R = window.BlotRules;
  var screen = document.querySelector('[data-screen-id="table"]');
  var NAMES = { bottom: 'You', left: 'HasmikG', top: 'GarikAv', right: 'Vazgen1972' };
  var SUIT_SIGN = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
  var RED = { D: true, H: true };
  var COMBO_NAME = { terz: 'Terz', fifty: '50', hundred: '100', four: 'Four' };

  var view = null, tok = 0;
  var game = null;   // { score: {us, them}, dealer, round }
  var log = [];      // round results, for tests (autoplay)

  // ---------- small helpers ----------
  function team(seat) { return R.teamOf(seat); }
  function suitHtml(suit) { return '<span class="tb-suit' + (RED[suit] ? ' is-red' : '') + '">' + SUIT_SIGN[suit] + '</span>'; }
  function bidHtml(b) { return (b.kaput ? 'Kaput ' : b.value + ' ') + suitHtml(b.suit); }
  function alive() { return view && view.alive(tok); }
  function sortHand(hand, trump) {
    var order = ['S', 'H', 'C', 'D'];
    if (trump && trump !== R.NO_TRUMP) order = [trump].concat(order.filter(function (s) { return s !== trump; }));
    return hand.slice().sort(function (a, b) {
      return order.indexOf(a.suit) - order.indexOf(b.suit) || R.RANKS.indexOf(a.rank) - R.RANKS.indexOf(b.rank);
    });
  }
  function ids(cards) { return cards.map(function (c) { return c.id; }); }
  function remove(hand, card) { hand.splice(hand.indexOf(card), 1); }

  // ---------- bots ----------
  // Rough value (in card points) a hand brings its team with `suit` as trump.
  function handValue(hand, suit) {
    var nt = suit === R.NO_TRUMP, v = 0;
    var TRUMP_V = { J: 22, '9': 16, A: 12, '10': 10, K: 6, Q: 5, '8': 3, '7': 3 };
    hand.forEach(function (c) {
      if (!nt && c.suit === suit) v += TRUMP_V[c.rank];
      else if (c.rank === 'A') v += nt ? 22 : 11;
      else if (c.rank === '10') v += hand.some(function (x) { return x.suit === c.suit && x.rank === 'A'; }) ? 9 : 2;
    });
    if (!nt) v += Math.max(0, hand.filter(function (c) { return c.suit === suit; }).length - 3) * 9;
    v += R.bestCombinations(hand, suit).reduce(function (s, c) { return s + c.points * 10; }, 0);
    if (R.hasBlotRebot(hand, suit)) v += 20;
    return v;
  }
  function aiBid(seat, hand, st) {
    var cur = st.current;
    // under contra: the bidding side may answer with sur
    if (st.contra && !st.sur && cur && team(cur.seat) === team(seat)) {
      return handValue(hand, cur.suit) + 35 >= (cur.value + 3) * 10 ? { type: 'sur' } : { type: 'pass' };
    }
    if (st.contra) return { type: 'pass' };
    // a strong defender doubles a big opposing bid
    if (cur && team(cur.seat) !== team(seat) && !cur.kaput && cur.value >= 14 && handValue(hand, cur.suit) >= 60) return { type: 'contra' };
    var best = null;
    R.SUITS.concat([R.NO_TRUMP]).forEach(function (suit) {
      var v = handValue(hand, suit) + 35;   // + what the partner is likely to bring
      if (suit === R.NO_TRUMP && hand.filter(function (c) { return c.rank === 'A'; }).length < 3) return;
      if (!best || v > best.v) best = { suit: suit, v: v };
    });
    var max = Math.min(R.MAX_BID, Math.floor(best.v / 10));
    var partnerHolds = cur && team(cur.seat) === team(seat);
    var need = cur ? cur.value + (partnerHolds ? 2 : 1) : R.MIN_BID;
    if (cur && cur.kaput) return { type: 'pass' };
    if (max < Math.max(R.MIN_BID, need)) return { type: 'pass' };
    var value = cur ? cur.value + 1 : R.MIN_BID;
    return { type: 'bid', bid: { value: value, suit: best.suit, kaput: false } };
  }
  function aiPlay(seat, hand, plays, trump, legal, contract) {
    var isTrump = function (c) { return trump !== R.NO_TRUMP && c.suit === trump; };
    var pts = function (c) { return R.cardPoints(c, trump); };
    var minBy = function (a, f) { return a.reduce(function (m, c) { return f(c) < f(m) ? c : m; }); };
    var maxBy = function (a, f) { return a.reduce(function (m, c) { return f(c) > f(m) ? c : m; }); };
    if (!plays.length) {
      var trumps = legal.filter(isTrump);
      if (team(seat) === team(contract.seat) && trumps.some(function (c) { return c.rank === 'J'; })) {
        return trumps.find(function (c) { return c.rank === 'J'; });
      }
      var ace = legal.find(function (c) { return !isTrump(c) && c.rank === 'A'; });
      if (ace) return ace;
      return minBy(legal, function (c) { return (isTrump(c) ? 50 : 0) + pts(c) * 2 + R.RANKS.indexOf(c.rank); });
    }
    var led = plays[0].card.suit, win = R.trickWinner(plays, trump);
    var power = function (c) { return R.power(c, trump, led); };
    var beating = legal.filter(function (c) { return power(c) > power(win.card); });
    var last = plays.length === 3;
    if (win.seat === R.partner(seat)) {
      var safe = last || (win.card.rank === 'A' && !isTrump(win.card)) || (isTrump(win.card) && (win.card.rank === 'J' || win.card.rank === '9'));
      var plain = legal.filter(function (c) { return !isTrump(c); });
      if (safe) return maxBy(plain.length ? plain : legal, pts);
      return minBy(legal, pts);
    }
    if (beating.length) return last ? minBy(beating, power) : maxBy(beating, power);
    return minBy(legal, function (c) { return pts(c) + (isTrump(c) ? 15 : 0); });
  }

  // Why only some cards are playable, shown when you tap one that is not.
  function moveHint(hand, plays, trump, legal) {
    if (legal.length === hand.length || !plays.length) return 'Play a highlighted card';
    var led = plays[0].card.suit, sign = SUIT_SIGN[led];
    var isTrump = function (c) { return trump !== R.NO_TRUMP && c.suit === trump; };
    if (legal.every(function (c) { return c.suit === led; })) {
      return led === trump ? 'Trump was led: play a higher trump if you can' : 'Follow suit: play a ' + sign;
    }
    if (legal.every(isTrump)) return 'No ' + sign + ': you must trump in';
    return 'Play a highlighted card';
  }

  // ---------- DOM: bidding panel, contract chip, result panel ----------
  var bidEl = screen.querySelector('[data-bid]');
  var resultEl = screen.querySelector('[data-result]');

  // Bid chips next to the players: their latest bid (or "Pass") during the bidding,
  // then only the contract, with ×2 / ×4 for contra / sur.
  function setChip(seat, bid, mods) {
    var el = screen.querySelector('[data-chip="' + seat + '"]');
    if (!bid) { el.hidden = true; return; }
    el.classList.toggle('is-pass', bid === 'pass');
    el.innerHTML = bid === 'pass' ? 'Pass'
      : '<i class="' + (RED[bid.suit] ? 'is-red' : bid.suit === 'NT' ? 'is-nt' : '') + '">' + SUIT_SIGN[bid.suit] + '</i>' +
        (bid.kaput ? 'Kaput' : bid.value) + (mods && mods.sur ? ' <small>×4</small>' : mods && mods.contra ? ' <small>×2</small>' : '');
    el.hidden = false;
  }
  function clearChips() { R.SEATS.forEach(function (s) { setChip(s, null); }); }
  function setContract(c) {
    clearChips();
    if (c) setChip(c.seat, c, c);
  }


  // Your turn to bid. Resolves with {type: 'pass' | 'bid' | 'contra' | 'sur', bid}.
  function humanBid(st) {
    return new Promise(function (res) {
      var cur = st.current, mine = cur && team(cur.seat) === 'us';
      var min = cur ? cur.value + 1 : R.MIN_BID, value = Math.max(R.MIN_BID, min), kaput = false;
      var canBid = !st.contra && !(cur && cur.kaput) && min <= R.MAX_BID;
      var canKaput = !st.contra && !(cur && cur.kaput);
      var q = function (sel) { return bidEl.querySelector(sel); };
      q('[data-bid-current]').innerHTML = cur
        ? NAMES[cur.seat] + ': ' + bidHtml(cur) + (st.sur ? ' · Sur' : st.contra ? ' · Contra' : '')
        : 'No bids yet';
      function render() {
        q('[data-bid-value]').textContent = kaput ? 'Kaput' : value;
        q('[data-bid-minus]').disabled = kaput || value <= min;
        q('[data-bid-plus]').disabled = kaput || value >= R.MAX_BID;
        q('[data-bid-kaput]').setAttribute('aria-pressed', String(kaput));
        q('[data-bid-kaput]').disabled = !canKaput;
        bidEl.querySelectorAll('[data-bid-suit]').forEach(function (b) { b.disabled = !(canBid || (kaput && canKaput)); });
        q('[data-bid-contra]').hidden = !(cur && !mine && !st.contra && !cur.kaput);
        q('[data-bid-sur]').hidden = !(cur && mine && st.contra && !st.sur);
      }
      bidEl.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.matches('[data-bid-minus]')) { value = Math.max(min, value - 1); render(); return; }
        if (b.matches('[data-bid-plus]')) { value = Math.min(R.MAX_BID, value + 1); render(); return; }
        if (b.matches('[data-bid-kaput]')) { kaput = !kaput; render(); return; }
        var out = null;
        if (b.matches('[data-bid-suit]')) {
          var suit = b.getAttribute('data-bid-suit');
          out = { type: 'bid', bid: kaput ? { value: R.MAX_BID + 1, suit: suit, kaput: true } : { value: value, suit: suit, kaput: false } };
        }
        if (b.matches('[data-bid-pass]')) out = { type: 'pass' };
        if (b.matches('[data-bid-contra]')) out = { type: 'contra' };
        if (b.matches('[data-bid-sur]')) out = { type: 'sur' };
        if (!out) return;
        bidEl.hidden = true; bidEl.onclick = null;
        res(out);
      };
      render();
      bidEl.hidden = false;
    });
  }

  function showResult(html, button) {
    return new Promise(function (res) {
      resultEl.querySelector('[data-result-body]').innerHTML = html;
      var b = resultEl.querySelector('[data-result-next]');
      b.textContent = button;
      b.onclick = function () { resultEl.hidden = true; b.onclick = null; res(); };
      resultEl.hidden = false;
    });
  }
  function hidePanels() {
    bidEl.hidden = true; resultEl.hidden = true; bidEl.onclick = null;
  }

  // ---------- game flow ----------
  async function bidding(hands, dealer) {
    var st = { current: null, contra: false, sur: false }, seat = R.next(dealer), passes = 0;
    for (var guard = 0; guard < 60; guard++) {
      if (st.current && passes >= 3) break;
      if (!st.current && passes >= 4) return null;
      // after contra only the bidding side can answer (sur) — then bidding is over
      view.turn(seat);
      var act = seat === 'bottom' && !window.BlotGame.autoplay ? await humanBid(st) : (await view.wait(.9), aiBid(seat, hands[seat], st));
      if (!alive()) return null;
      if (act.type === 'bid' && R.bidBeats(act.bid, st.current) && !st.contra) {
        st.current = { seat: seat, value: act.bid.value, suit: act.bid.suit, kaput: act.bid.kaput };
        passes = 0;
        setChip(seat, act.bid);
      } else if (act.type === 'contra' && st.current && team(st.current.seat) !== team(seat) && !st.contra) {
        st.contra = true; passes = 0;
        view.say(seat, 'Contra!', 'bid');
        // give the bidding side one chance to answer
        var order = R.orderAfter(seat).filter(function (s) { return team(s) === team(st.current.seat); });
        for (var k = 0; k < order.length && !st.sur; k++) {
          view.turn(order[k]);
          var ans = order[k] === 'bottom' && !window.BlotGame.autoplay ? await humanBid(st) : (await view.wait(.9), aiBid(order[k], hands[order[k]], st));
          if (!alive()) return null;
          if (ans.type === 'sur') { st.sur = true; view.say(order[k], 'Sur!', 'bid'); }
          else setChip(order[k], 'pass');
        }
        break;
      } else {
        passes++;
        setChip(seat, 'pass');
      }
      if (st.current) setChip(st.current.seat, st.current, st);
      seat = R.next(seat);
    }
    view.turn(null);
    var c = st.current;
    return { seat: c.seat, team: team(c.seat), value: c.value, suit: c.suit, kaput: c.kaput, contra: st.contra, sur: st.sur };
  }

  async function round() {
    var dealer = game.dealer;
    var deck = R.shuffle(R.makeDeck());
    var dealt = R.deal(deck, dealer);
    var hands = dealt.hands;
    setContract(null);
    window.BlotTable.setLastTrick([]);
    view.say(dealer, 'Dealing');
    await view.deal(tok, deck, dealt.sequence, dealer); if (!alive()) return;
    R.SEATS.forEach(function (s) { if (s !== 'bottom') view.layoutPile(s, ids(hands[s])); });
    hands.bottom = sortHand(hands.bottom);
    await view.layoutHand(ids(hands.bottom)); if (!alive()) return;
    view.showHud();

    // ---- bidding
    var contract = await bidding(hands, dealer); if (!alive()) return;
    if (!contract) {
      view.say(dealer, 'All passed — redeal');
      await view.wait(2.4); if (!alive()) return;
      await view.clear();
      game.dealer = R.next(dealer);
      return 'redeal';
    }
    setContract(contract);
    var trump = contract.suit;
    hands.bottom = sortHand(hands.bottom, trump);
    await view.layoutHand(ids(hands.bottom)); if (!alive()) return;

    // ---- combinations: declared before the first move, only the stronger side counts
    var leader = R.next(dealer), combos = {}, blot = null;
    R.SEATS.forEach(function (s) {
      combos[s] = R.bestCombinations(hands[s], trump);
      if (R.hasBlotRebot(hands[s], trump)) blot = team(s);
    });
    var declared = false;
    for (var o = [leader].concat(R.orderAfter(leader).slice(0, 3)), i = 0; i < 4; i++) {
      var list = combos[o[i]];
      if (list.length) {
        declared = true;
        view.say(o[i], list.map(function (c) { return COMBO_NAME[c.type] + (c.type === 'four' ? ' ' + c.head + 's' : ''); }).join(' + '), 'combo');
        await view.wait(.9); if (!alive()) return;
      }
    }
    var comboWin = R.comboWinner(combos, trump, leader);
    if (declared) await view.wait(.8);

    // ---- eight tricks
    var stock = { us: [], them: [] }, lastTrick = null;
    for (var t = 0; t < 8; t++) {
      var plays = [], seat = leader;
      for (var n = 0; n < 4; n++) {
        var hand = hands[seat], legal = R.legalMoves(hand, plays, trump, seat), card;
        view.turn(seat);
        if (seat === 'bottom' && !window.BlotGame.autoplay) {
          var id = await view.waitHuman(ids(hand), ids(legal), moveHint(hand, plays, trump, legal)); if (!alive()) return;
          card = hand.find(function (c) { return c.id === id; });
        } else {
          await view.wait(.7); if (!alive()) return;
          card = aiPlay(seat, hand, plays, trump, legal, contract);
        }
        remove(hand, card);
        plays.push({ seat: seat, card: card });
        view.turn(null);
        await view.playCard(seat, card.id); if (!alive()) return;
        if (seat === 'bottom') view.layoutHand(ids(hand)); else view.layoutPile(seat, ids(hand));
        seat = R.next(seat);
      }
      var win = R.trickWinner(plays, trump);
      await view.wait(.9); if (!alive()) return;
      await view.collect(win.seat, plays.map(function (p) { return p.card.id; })); if (!alive()) return;
      stock[team(win.seat)] = stock[team(win.seat)].concat(plays.map(function (p) { return p.card; }));
      window.BlotTable.setLastTrick(plays.map(function (p) { return p.card; }));
      lastTrick = team(win.seat);
      leader = win.seat;
    }

    // ---- score the round
    var res = R.roundResult({ bid: contract, stock: stock, lastTrick: lastTrick, combos: comboWin, blotRebot: blot });
    game.score.us += res.us; game.score.them += res.them;
    window.BlotTable.setScore(game.score.us, game.score.them);
    view.chime();
    var cards = { us: R.stockPoints(stock.us, trump), them: R.stockPoints(stock.them, trump) };
    cards[lastTrick] += 10;
    var line = NAMES[contract.seat] + ' bid ' + bidHtml(contract) +
      (contract.sur ? ' · Sur' : contract.contra ? ' · Contra' : '') + ' — ' +
      (res.made ? '<b class="is-made">made</b>' : '<b class="is-down">went under</b>') +
      (res.kaput ? ' · Kaput!' : '');
    var extras = [];
    if (comboWin.team && comboWin.points) extras.push((comboWin.team === 'us' ? 'Us' : 'Them') + ': combinations +' + comboWin.points);
    if (blot) extras.push((blot === 'us' ? 'Us' : 'Them') + ': blot-rebot +2');
    var over = game.score.us >= R.GAME_TARGET || game.score.them >= R.GAME_TARGET;
    var winner = game.score.us === game.score.them ? null : game.score.us > game.score.them ? 'us' : 'them';
    var html =
      '<p class="tb-result_title">' + (over && winner ? (winner === 'us' ? 'You win!' : 'They win') : 'Round ' + game.round) + '</p>' +
      '<p class="tb-result_line">' + line + '</p>' +
      '<table class="tb-result_table"><tr><th></th><th>Us</th><th>Them</th></tr>' +
      '<tr><td>Card points</td><td>' + cards.us + '</td><td>' + cards.them + '</td></tr>' +
      '<tr><td>This round</td><td>+' + res.us + '</td><td>+' + res.them + '</td></tr>' +
      '<tr class="is-total"><td>Score</td><td>' + game.score.us + '</td><td>' + game.score.them + '</td></tr></table>' +
      (extras.length ? '<p class="tb-result_note">' + extras.join(' · ') + '</p>' : '');
    if (window.BlotGame.autoplay) { log.push({ round: game.round, contract: contract, res: res, score: { us: game.score.us, them: game.score.them } }); await view.wait(.2); }
    else { await showResult(html, over && winner ? 'Play again' : 'Next round'); if (!alive()) return; }
    await view.clear();
    if (over && winner) {
      game.score = { us: 0, them: 0 }; game.round = 0;
      window.BlotTable.setScore(0, 0);
    }
    game.dealer = R.next(dealer);
    game.round++;
  }

  async function loop() {
    var my = tok;
    while (alive() && my === tok) {
      await round();
    }
  }

  window.BlotGame = {
    // called by the table once everybody is seated
    start: function (v) {
      view = v; tok = v.token();
      game = { score: { us: 0, them: 0 }, dealer: 'top', round: 1 };
      window.BlotTable.setScore(0, 0);
      hidePanels(); setContract(null);
      loop();
    },
    stop: function () { tok = -1; hidePanels(); setContract(null); if (view) view.turn(null); },
    // tests: autoplay = true lets the bots play your seat too; log has the round results
    autoplay: false,
    log: log,
    _ai: { handValue: handValue, aiBid: aiBid, aiPlay: aiPlay }
  };
})();
