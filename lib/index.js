var fs = require('fs'),
    path = require('path'),
    uid = require('gen-uid'),
    unixTime = require('unix-time'),
    shell = require('shelljs'),
    isDir = require('is-directory'),
    utils = require('./utils');

function throwErrorMsg(msg) {
    console.log(msg);
    process.exit(1);
}

var OpenBadges = function (host, repository) {
    console.log('Cloning into \'badges\'...');

    if (shell.exec('git clone ' + repository + ' badges', { silent: true }).code !== 0) {
        console.log('Repository exists...\nPulling from \'badges\'...');
        shell.exec('cd badges && git pull origin gh-pages');
    }

    var listOfClasses = fs.readdirSync('badges'),
        hasIssuer = listOfClasses.indexOf('issuer.json') > -1,
        createdClasses = {};

    listOfClasses.forEach(function (_class) {
        if (_class === '.git') return;

        var pathToClass = path.join('badges', _class);

        if (isDir(pathToClass)) {
            var badgesInClass = fs.readdirSync(pathToClass);

            var errMsg = 'Invalid declaration of the class \'' + _class + '\' --> ';
            if (!hasIssuer) {
                throwErrorMsg('Invalid declaration of the issuer --> Can not find file \'issuer.json\'');
            } else if (badgesInClass.indexOf('class.json') === -1) {
                throwErrorMsg(errMsg + 'Can not find file \'class.json\'');
            } else if (badgesInClass.indexOf('img.png') === -1) {
                throwErrorMsg(errMsg + 'Can not find file \'img.png\'');
            }

            createdClasses[_class] = [];

            badgesInClass.forEach(function (badge) {
                var pathToBadge = path.join(pathToClass, badge);

                if (isDir(pathToBadge)) {
                    if (!fs.existsSync(path.join(pathToBadge, badge + '.json'))) {
                        throwErrorMsg('Invalid declaration of the badge \'' + badge + '\'');
                    }

                    createdClasses[_class].push(badge);
                }
            });
        }
    });

    this.host = host;
    this.hasIssuer = hasIssuer;
    this.createdClasses = createdClasses;
};

OpenBadges.prototype.createIssuer = function (data) {
    var host = this.host;

    var issuerData = {
        name: data.name,
        url: data.url,
        description: data.description,
        image: host + '/img.png',
        email: data.email
    };

    this.hasIssuer = true;

    shell.mv('-f', data.image, path.join('badges', 'img.png'));
    fs.writeFileSync('badges/issuer.json', JSON.stringify(issuerData, null, '  '));

    var commitMsg = 'Add issuer \'' + data.name + '\'';
    utils.gitSend('*', commitMsg, 'gh-pages');

    console.log(commitMsg);

    return issuerData;
};

OpenBadges.prototype.createClass = function (data) {
    var host = this.host,
        badgeClass = data.name.trim().replace(/( )+/g, '_'),
        pathToClass = path.join('badges', badgeClass);

    if (!utils.mkdir(pathToClass)) { return 'The Badge Class already exists'; }

    this.createdClasses[badgeClass] = [];

    var classData = {
        name: data.name,
        description: data.description,
        image: host + '/' + badgeClass + '/' + 'img.png',
        criteria: data.criteria,
        issuer: host + '/issuer.json'
    };

    shell.mv('-f', data.image, path.join(pathToClass, 'img.png'));
    fs.writeFileSync(path.join(pathToClass, 'class.json'), JSON.stringify(classData, null, '  '));

    var commitMsg = 'Add class \'' + badgeClass + '\'';
    utils.gitSend(badgeClass, commitMsg, 'gh-pages');

    console.log(commitMsg);

    return classData;
};

OpenBadges.prototype.createBadge = function (data) {
    var host = this.host,
        createdClasses = this.createdClasses,
        badgeClass = data.name;

    if (!createdClasses.hasOwnProperty(badgeClass)) { return 'No such Badge Class!'; }

    var pathToClass = path.join('badges', badgeClass),
        pathToBadge = '',
        id = 0;

    /*jshint -W030 */
    do {
        id = uid.token(true),
        pathToBadge = path.join(pathToClass, id + '');
    } while (utils.hasOwnId(createdClasses, id));

    createdClasses[badgeClass].push(id);

    utils.mkdir(pathToBadge);

    var badgeData = {
        uid: id,
        recipient: {
            type: 'email',
            hashed: false,
            identity: data.email
        },
        badge: host + '/' + badgeClass + '/class.json',
        issuedOn: unixTime(Date.now()),
        verify: {
            type: 'hosted',
            url: host + '/' + badgeClass + '/' + id + '/' + id + '.json'
        }
    };

    fs.writeFileSync(path.join(pathToBadge, id + '.json'), JSON.stringify(badgeData, null, '  '));

    var commitMsg = 'Add badge \'' + id + '\' in class \'' + badgeClass + '\'';
    utils.gitSend(path.join(badgeClass, id + ''), commitMsg, 'gh-pages');

    console.log(commitMsg);

    return badgeData;
};

module.exports = OpenBadges;
