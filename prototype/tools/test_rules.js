// Checks js/blot-rules.js against the examples in Blot_Rules_EN.pdf.  Run: node tools/test_rules.js
require('../js/blot-rules.js');
const R = globalThis.BlotRules, assert = require('assert');
const c = id => R.card(id.slice(0, -1), id.slice(-1));
const cs = s => s.split(' ').map(c);
const ids = a => a.map(x => x.id).join(' ');

// deck and card values: 32 cards worth 152 in every mode
assert.strictEqual(R.makeDeck().length, 32);
['H', 'NT'].forEach(t => assert.strictEqual(R.stockPoints(R.makeDeck(), t), 152));

// deal 3-2-3 starting after the dealer, clockwise
const d = R.deal(R.makeDeck(), 'top');
assert.deepStrictEqual(d.sequence.slice(0, 4).map(p => p.seat), ['right', 'right', 'right', 'bottom']);
R.SEATS.forEach(s => assert.strictEqual(d.hands[s].length, 8));
assert.deepStrictEqual(R.orderAfter('top'), ['right', 'bottom', 'left', 'top']);

// strength: trumps J 9 A 10 K Q 8 7, plain A 10 K Q J 9 8 7, any trump beats plain
let w = R.trickWinner([{ seat: 'bottom', card: c('AS') }, { seat: 'left', card: c('7H') }, { seat: 'top', card: c('10S') }, { seat: 'right', card: c('AD') }], 'H');
assert.strictEqual(w.seat, 'left');
w = R.trickWinner([{ seat: 'bottom', card: c('AH') }, { seat: 'left', card: c('9H') }, { seat: 'top', card: c('JH') }, { seat: 'right', card: c('10H') }], 'H');
assert.strictEqual(w.seat, 'top');
w = R.trickWinner([{ seat: 'bottom', card: c('KS') }, { seat: 'left', card: c('10S') }, { seat: 'top', card: c('AD') }], 'H');
assert.strictEqual(w.seat, 'left');

// follow suit
assert.strictEqual(ids(R.legalMoves(cs('7S AS 9H 8D'), [{ seat: 'left', card: c('KS') }], 'H', 'top')), '7S AS');
// no led suit: must trump in with a trump that beats the table
assert.strictEqual(ids(R.legalMoves(cs('9H 8D 7C'), [{ seat: 'left', card: c('KS') }], 'H', 'top')), '9H');
// ... unless the partner is winning: then anything
assert.strictEqual(ids(R.legalMoves(cs('9H 8D 7C'), [{ seat: 'bottom', card: c('AS') }, { seat: 'left', card: c('7S') }], 'H', 'top')), '9H 8D 7C');
// ... and with only weaker trumps than the table: discard anything
assert.strictEqual(ids(R.legalMoves(cs('7H 8D'), [{ seat: 'right', card: c('KS') }, { seat: 'bottom', card: c('9H') }], 'H', 'left')), '7H 8D');
// trump led: beat it, else any trump, else anything
assert.strictEqual(ids(R.legalMoves(cs('JH 7H AS'), [{ seat: 'left', card: c('9H') }], 'H', 'top')), 'JH');
assert.strictEqual(ids(R.legalMoves(cs('8H 7H AS'), [{ seat: 'left', card: c('9H') }], 'H', 'top')), '8H 7H');
assert.strictEqual(ids(R.legalMoves(cs('AS 7D'), [{ seat: 'left', card: c('9H') }], 'H', 'top')), 'AS 7D');
// no-trump round: no trumping in
assert.strictEqual(ids(R.legalMoves(cs('9H 8D'), [{ seat: 'left', card: c('KS') }], 'NT', 'top')), '9H 8D');

// combinations: 7-8-9-10 of hearts is one "50" (not two terzes)
let b = R.bestCombinations(cs('7H 8H 9H 10H AS KD QC JD'), 'S');
assert.deepStrictEqual(b.map(x => x.type + ':' + x.head), ['fifty:10']);
// 8-9-10 hearts and 10-J-Q diamonds: two terzes
b = R.bestCombinations(cs('8H 9H 10H 10D JD QD 7S AC'), 'S');
assert.deepStrictEqual(b.map(x => x.type).sort(), ['terz', 'terz']);
assert.strictEqual(b.reduce((s, x) => s + x.points, 0), 4);
// four jacks = 20, four 9s = 14 (10 without trump), four aces = 10 (19 without trump), no four 7s
assert.strictEqual(R.bestCombinations(cs('JH JD JC JS 7H 8D AC KS'), 'S')[0].points, 20);
assert.strictEqual(R.bestCombinations(cs('9H 9D 9C 9S 7H 8D AC KS'), 'NT')[0].points, 10);
assert.strictEqual(R.bestCombinations(cs('AH AD AC AS 7H 8D JC KS'), 'NT')[0].points, 19);
assert.strictEqual(R.bestCombinations(cs('7H 7D 7C 7S AH JD QC KS'), 'S').length, 0);
// blot-rebot
assert.ok(R.hasBlotRebot(cs('KH QH 7S'), 'H'));
assert.ok(!R.hasBlotRebot(cs('KH QH 7S'), 'NT'));

// comparing: four 8s beat any sequence; equal heads -> trump wins; then the first to show
const terz = (head, suit) => ({ type: 'terz', head, suit, points: 2, cards: [] });
let cw = R.comboWinner({ left: [{ type: 'four', head: '8', points: 0, cards: [] }], bottom: [{ type: 'hundred', head: 'A', suit: 'H', points: 10, cards: [] }] }, 'H', 'bottom');
assert.deepStrictEqual(cw, { team: 'them', points: 0 });
cw = R.comboWinner({ left: [terz('K', 'H')], bottom: [terz('K', 'S')] }, 'H', 'bottom');
assert.strictEqual(cw.team, 'them');
cw = R.comboWinner({ left: [terz('K', 'D')], bottom: [terz('K', 'S')] }, 'H', 'bottom');
assert.strictEqual(cw.team, 'us');
cw = R.comboWinner({ left: [terz('K', 'D')], top: [terz('Q', 'S'), terz('9', 'H')] }, 'C', 'bottom');
assert.deepStrictEqual(cw, { team: 'them', points: 2 });

// bidding
assert.ok(R.bidBeats({ value: 9 }, { value: 8 }));
assert.ok(!R.bidBeats({ value: 8 }, { value: 8 }));
assert.ok(!R.bidBeats({ value: 30, suit: 'H' }, { value: 26, suit: 'S', kaput: true }));
assert.ok(R.canDeclareKaput(26) && !R.canDeclareKaput(25));
assert.ok(!R.bidBeats({ value: 7 }, null) && R.bidBeats({ value: 8 }, null));
assert.ok(R.bidBeats({ value: 26, kaput: true }, { value: 20 }));

// round scoring: "hearts 12" with 2 extra units needs 100 card points
const deck = R.makeDeck();
const split = (pred) => ({ us: deck.filter(pred), them: deck.filter(x => !pred(x)) });
let stock = split(x => x.suit === 'H' || (x.suit === 'S' && x.rank !== '7'));   // hearts 62 + spades 30 = 92
assert.strictEqual(R.stockPoints(stock.us, 'H'), 92);
let res = R.roundResult({ bid: { team: 'us', value: 12, suit: 'H' }, stock, lastTrick: 'us', combos: { team: 'us', points: 2 } });
assert.deepStrictEqual(res, { us: 12 + 12, them: 6, made: true, kaput: null });          // 102 -> 10 + 2 = 12 >= 12
res = R.roundResult({ bid: { team: 'us', value: 12, suit: 'H' }, stock, lastTrick: 'them', combos: { team: 'us', points: 2 } });
assert.deepStrictEqual(res, { us: 0, them: 12 + 16 + 2, made: false, kaput: null });     // 92 -> 9 + 2 = 11 < 12
res = R.roundResult({ bid: { team: 'us', value: 12, suit: 'H', contra: true }, stock, lastTrick: 'them', combos: { team: 'us', points: 2 } });
assert.deepStrictEqual(res, { us: 0, them: 24 + 16 + 2, made: false, kaput: null });
res = R.roundResult({ bid: { team: 'us', value: 12, suit: 'H', sur: true }, stock, lastTrick: 'us', combos: { team: 'us', points: 2 } });
assert.deepStrictEqual(res, { us: 48 + 16 + 2, them: 0, made: true, kaput: null });
// kaput: all cards = 250
res = R.roundResult({ bid: { team: 'them', value: 26, suit: 'S', kaput: true }, stock: { us: [], them: deck }, lastTrick: 'them', combos: { team: null, points: 0 } });
assert.deepStrictEqual(res, { us: 0, them: 26 + 25, made: true, kaput: 'them' });

console.log('blot rules: all checks passed');
