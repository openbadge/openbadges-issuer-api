var fs = require('fs'),
    shell = require('shelljs');

function mkdir(_path) {
    try {
        fs.mkdirSync(_path);

        return true;
    } catch (err) {
        if (err.code === 'EEXIST') { return false; }

        throw err;
    }
}

function hasOwnId(createdClasses, id) {
    for (var _class in createdClasses) {
        var currClass = createdClasses[_class];

        for (var i in currClass) {
            if (currClass[i] === id) return true;
        }
    }

    return false;
}

function gitSend(whatToAdd, commitMsg, whereToPush) {
    shell.exec('cd badges');

    shell.exec(
        'cd badges && ' +
        'git add ' + whatToAdd + ' && ' +
        'git commit -m "' + commitMsg + '" && ' +
        'git push origin '  + whereToPush
    );
}

module.exports = {
    mkdir: mkdir,
    hasOwnId: hasOwnId,
    gitSend: gitSend
};
