var assert = require('assert');
var ObTest = require('./util').ObTest;
var column = require('./util').column;

var address1 = '1Dorian4RoXcnBv9hnQ4Y2C1an6NJ4UrjX';
var address2 = '14bcK5XVcj3CWmbyo2A2wMwxaijBbsipDS';
var fromHeight = 0;

var unspentItem = {
    output_hash: '798831c1fd9647eb64ee7ef9ddcdf2b0cfc31b0147ed600e26d254ee1a611e59',
    output_index: 0,
    output_height: 294614,
    value: '1500000',
    spend_hash: undefined,
    spend_index: undefined,
    spend_height: undefined
};

var spentItem = {
    output_hash: 'ee88c1bcb74c680ce2e5838fcb8950fbd527ab1ddead155be36c728dd9e8da8e',
    output_index: 0,
    output_height: 218687,
    value: '1066731',
    spend_hash: '1554a02d4eb1c7a73e3736922ed99530e360784e709896c42e5756e65b2da341',
    spend_index: 1,
    spend_height: 220151
};

var unconfirmedItem = {
    output_hash: 'ee88c1bcb74c680ce2e5838fcb8950fbd527ab1ddead155be36c728dd9e8da8e',
    output_index: 0,
    output_height: undefined,
    value: '1066731',
    spend_hash: '1554a02d4eb1c7a73e3736922ed99530e360784e709896c42e5756e65b2da341',
    spend_index: 1,
    spend_height: undefined
};

var Put = require('put');
var buffertools = require('buffertools');
var bignum = require('bignum');
var bigIntToValue = require('../lib/util').bigIntToValue;
var UNSPENT_HASH = new Buffer(Array(32));
var UNSPENT_INDEX = 4294967295;
var UNSPENT_HEIGHT = 4294967295;

function encodeHistory(errcode, history) {
    var p = Put().word32le(errcode);

    function triple(hash, index, height) {
        p.put(buffertools.reverse(new Buffer(hash, 'hex')))
            .word32le(index)
            .word32le(height);
    }

    history.forEach(function(item) {
        triple(item.output_hash, item.output_index, item.output_height);

        p.put(bigIntToValue(bignum(item.value)));

        if (item.spend_hash === undefined) {
            triple(UNSPENT_HASH, UNSPENT_INDEX, UNSPENT_HEIGHT);
        } else {
            triple(item.spend_hash, item.spend_index, item.spend_height);
        }
    });

    return p.buffer();
}

var binary = require('binary');
var encodeBase58Check = require('../lib/util').encodeBase58Check;

var makeResponse = function(errcode, address, history, unconfirmed) {
    return function(command, id, data) {
        assert.equal(command, (unconfirmed ? 'address' : 'blockchain') + '.fetch_history');
        assert.equal(data.length, 25);

        // read request
        var vars = binary.parse(data)
            .word8('version')
            .buffer('address', 20)
            .word32le('height')
            .vars;

        assert.equal(encodeBase58Check(Buffer.concat([Buffer([0]), vars.address])), address);

        var errcode = 0;
        return encodeHistory(errcode, history);
    };
};

describe('api fetchHistory()', function() {

    it('should break if address is not supplied', ObTest()
        .api('fetchHistory')
        .assertError('Invalid address.'));

    it('should break if bad address is supplied', ObTest()
        .api('fetchHistory', '$#!+')
        .assertError('Invalid address.'));

    it('should break if bad height is supplied', ObTest()
        .api('fetchHistory', address1, '$#!+')
        .assertError('Invalid height.'));

    it('should get address history', ObTest()
        .api('fetchHistory', address1, fromHeight)
        .respond(makeResponse(0, address1, [unspentItem, spentItem, unconfirmedItem]))
        .assert(function(err, _history) {
            assert.ifError(err);
            assert.equal(_history.length, 3);

            var item = _history.shift();
            item.output_hash = item.output_hash.toString('hex');
            item.spend_hash = undefined;
            item.spend_index = undefined;
            item.spend_height = undefined;
            item.value = item.value.toString();

            assert.deepEqual(item, unspentItem);

            item = _history.shift();
            item.output_hash = item.output_hash.toString('hex');
            item.spend_hash = item.spend_hash.toString('hex');
            item.value = item.value.toString();

            assert.deepEqual(item, spentItem);

            item = _history.shift();
            item.output_hash = item.output_hash.toString('hex');
            item.spend_hash = item.spend_hash.toString('hex');
            item.output_height = undefined;
            item.spend_height = undefined;
            item.value = item.value.toString();

            assert.deepEqual(item, unconfirmedItem);
        }));
});
