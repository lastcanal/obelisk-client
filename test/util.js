var assert = require('assert');
var zmq = require('zmq');
var log = require('npmlog');
var Client = require('../');
var error = require('../lib/error');
var spawn = require('child_process').spawn;

var config = {
    port: 'ipc:///tmp/ob-test-port',
    txport: 'ipc:///tmp/ob-test-port',
    blkport: 'ipc:///tmp/ob-test-port',
    loglevel: 'error'
};

function setupServer(responses, cb) {
    var socket = zmq.socket('router');

    socket.bind(config.port, function(err) {
        if (err) return cb(err);
        log.info('Mock Obelisk server listening on', config.port);

        socket.on('message', function(envelope, command, id, data) {
            var res = responses.shift();
            command = command.toString();
            log.verbose('>S', [envelope, command, id, data]);
            var resp = [envelope, command, id, res(command, id, data)];
            socket.send(resp);
            log.verbose('S>', resp);
        });

        function cleanup(cb) {
            // socket.unbind(config.port, cb);
            socket.unbind(config.port, function() {
                setTimeout(cb, 10);
            });
        }

        cb(null, cleanup);
    });
}


exports.ObTest = function ObTest() {

    function Test() {}

    Test.prototype.api = function() {
        var self = this;
        console.assert(self._request === undefined);

        var args = [].slice.call(arguments);
        var name = args.shift();

        self._request = function(done) {
            args.push(function() {
                self._assert.apply(null, [].slice.call(arguments));
                done();
            });
            var ob = new Client(config);
            ob[name].apply(ob, args);
        };

        self.assertError = function(msg) {
            self._assert = function(err) {
                assert.equal(arguments.length, 1, 'expecting single err argument');
                assert.ok(err.message.match(msg),
                    '"' + msg + '" not found in "' + err.message + '"');
            };
            return self._request;
        };

        return self;
    };

    Test.prototype.assert = function(cb) {
        console.assert(this._assert === undefined);
        console.assert(this._request !== undefined);
        this._assert = cb;
        return this._request;
    };

    Test.prototype.respond = function() {
        var self = this;
        console.assert(self._request !== undefined);
        var responses = [].slice.call(arguments);

        var subrequest = self._request;
        self._request = function(done) {
            setupServer(responses, function(err, cb) {
                if (err) return done(err);
                subrequest(function() {
                    cb(done);
                });
            });
        };

        return self;
    };

    return new Test();
};

exports.column = function column(text, col) {
    return text.split(/\n/).map(function(line) {
        return line.charAt(col);
    }).join('');
};

module.exports = exports;
