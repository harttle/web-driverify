var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var rpc = require('../../utils/rpc.js');
var debug = require('debug')('wd:proxy:routes:command');
var ServerCmds = require('../../utils/server-commands.js');
var caps = require('../../utils/capabilities.js');

router.use(bodyParser.json({
    // doc: https://www.npmjs.com/package/body-parser
    strict: false
}));
router.use(rpc.sessionByReq);

router.get('/', function(req, res, next) {
    res.set('content-type', 'text/html');
    var session = rpc.createSession(req);

    try {
        // New Session, spec: 
        // https://www.w3.org/TR/webdriver/#dfn-new-session
        ServerCmds.exit(req.query.cmd, {
            sessionId: session.id,
            capabilities: caps
        });
        res.render('connect-success.html', session);
    } catch (e) {
        console.warn('connection failed:', e.message);
        if (e.code === 'ENOCMD') {
            res.render('connect-fail.html', session);
        } else {
            next(e);
        }
    }
});

var id = 0;
router.get('/command', rpc.sessionRequired, function(req, res, next) {
    id++;
    debug('command polling requested', id, 'browser info:');
    req.session.cmdQueue.front()
        .then(cmd => {
            debug('command polling responsing', id);
            res.json(cmd.dto());
        })
        .catch(err => {
            req.session.cmdQueue.sendFailed(err);
            next(err);
        });
});

router.post('/result/:cid', rpc.sessionRequired, function(req, res) {
    debug('command result received', req.body);
    try {
        var result = req.body;
    } catch (e) {
        var msg = 'invalid json: ' + req.body;
        debug(msg);
        return res.status(400).end(msg);
    }
    req.session.cmdQueue.pop(result);
    res.end('received');
});

router.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

router.use(function(err, req, res, next) {
    var status = err.status || 500;
    debug(err.stack);
    res.status(status).end(err.stack);
});

module.exports = router;
