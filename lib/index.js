var fs = require('fs'),
    path = require('path'),
    uid = require('gen-uid'),
    unixTime = require('unix-time'),
    vow = require('vow'),
    github = require('./github-api');

/**
 * @class OpenBadges
 * @constructor
 * @param {Object} [config]
 * @param {String} [config.token]
 * @param {String} [config.user]
 * @param {String} [config.repo]
 * @param {String} [config.host]
 */
var OpenBadges = function (config) {
    /**
     * Logs an error and stop the process
     * @param {String} msg
     */
    function throwErrorMsg(msg) {
        console.log(msg);
        process.exit(1);
    }

    this.config = {
        user: config.user,
        repo: config.repo,
        host: config.host
    };

    this.info = {
        hasIssuer: false
    };

    this.initialized = false;

    github.authenticate(config.token);

    github.getRepoContent(config.user, config.repo, '')
        .then(function (res) {
            var _classes = {},
                hasIssuer = res.indexOf('issuer.json') > -1 && res.indexOf('img.png') > -1;

            res.forEach(function (item) {
                if (typeof item === 'object') {
                    if (!hasIssuer) {
                        throwErrorMsg('Invalid declaration of the issuer');
                    }

                    _classes[item.name] = [];

                    if (item.children.indexOf('class.json') === -1 || item.children.indexOf('img.png') === -1) {
                        throwErrorMsg('Invalid declaration of class \'' + item.name + '\'');
                    }

                    item.children.forEach(function (child) {
                        if (typeof child === 'object') {
                            _classes[item.name].push(child.name);

                            if (child.children.indexOf(child.name + '.json') === -1) {
                                throwErrorMsg('Invalid declaration of badge \'' +
                                    child.name + '\' in class \'' + item.name + '\'');
                            }
                        }
                    });
                }
            });

            github.getAllCommits(config.user, config.repo, 1)
                .then(function (res) {
                    var sortedClasses = {};

                    res.forEach(function (item) {
                        var message = item.commit.message;

                        if (message.indexOf('Add metadata for class ') > -1) {
                            var className = message.slice(message.indexOf('\'') + 1, message.lastIndexOf('\''));

                            if (_classes.hasOwnProperty(className) && !sortedClasses.hasOwnProperty(className)) {
                                sortedClasses[className] = _classes[className];
                            }
                        }
                    });

                    this.info = {
                        hasIssuer: hasIssuer,
                        createdClasses: sortedClasses
                    };

                    console.log(sortedClasses);
                    console.log('Initialization of Open Badges finished!');

                    this.initialized = true;
                }, this);
        }, this)
        .fail(function (err) {
            throwErrorMsg(err);
        });
};

/**
 * Creates an issuer of badges
 * @class OpenBadges
 * @method
 * @param {Object} [data]
 * @param {String} [data.name]
 * @param {String} [data.url]
 * @param {String} [data.description]
 * @param {String} [data.image]
 * @param {String} [data.email]
 * @returns {Promise}
 */
OpenBadges.prototype.createIssuer = function (data) {
    var config = this.config;

    var issuerData = {
        name: data.name,
        url: data.url,
        description: data.description,
        image: config.host + '/img.png',
        email: data.email
    };

    var issuer = {
        commitMsg: 'Add metadata for an issuer \'' + data.name + '\'',
        data: new Buffer(JSON.stringify(issuerData, null, '  ')).toString('Base64'),
    },
    img = {
        commitMsg: 'Add image for an issuer \'' + data.name + '\'',
        data: fs.readFileSync(data.image, 'Base64')
    };

    return github.pushFile(config.user, config.repo, 'issuer.json', issuer.commitMsg, issuer.data)
        .then(function (res) {
            console.log(res);

            return github.pushFile(config.user, config.repo, 'img.png', img.commitMsg, img.data);
        })
        .then(function (res) {
            console.log(res);

            this.info.hasIssuer = true;

            return issuerData;
        }, this);
};

/**
 * Creates a badge class
 * @class OpenBadges
 * @method
 * @param {Object} [data]
 * @param {String} [data.name]
 * @param {String} [data.description]
 * @param {String} [data.image]
 * @param {String} [data.criteria]
 * @returns {Promise}
 */
OpenBadges.prototype.createClass = function (data) {
    var config = this.config,
        _createdClasses = this.info.createdClasses,
        badgeClass = data.name.trim().replace(/( )+/g, '_');

    if (_createdClasses.hasOwnProperty(badgeClass)) {
        return vow.resolve('The Badge Class already exists!');
    }

    var createdClasses = {};
    createdClasses[badgeClass] = [];

    Object.keys(_createdClasses).forEach(function (item) {
        createdClasses[item] = _createdClasses[item];
    });

    var classData = {
        name: data.name,
        description: data.description,
        image: config.host + '/' + badgeClass + '/' + 'img.png',
        criteria: data.criteria,
        issuer: config.host + '/issuer.json'
    };

    var _class = {
        commitMsg: 'Add metadata for class \'' + badgeClass + '\'',
        data: new Buffer(JSON.stringify(classData, null, '  ')).toString('Base64')
    },
    img = {
        commitMsg: 'Add image for class \'' + badgeClass + '\'',
        data: fs.readFileSync(data.image, 'Base64')
    };

    return github.pushFile(config.user, config.repo, path.join(badgeClass, 'class.json'), _class.commitMsg, _class.data)
        .then(function (res) {
            console.log(res);

            return github.pushFile(config.user, config.repo, path.join(badgeClass, 'img.png'), img.commitMsg, img.data);
        })
        .then(function (res) {
            console.log(res);

            this.info.createdClasses = createdClasses;

            return classData;
        }, this);
};

/**
 * Creates a badge to be awarded
 * @class OpenBadges
 * @method
 * @param {Object} [data]
 * @param {String} [data.name]
 * @param {String} [data.email]
 * @returns {Promise}
 */
OpenBadges.prototype.createBadge = function (data) {
    /**
     * Checks whether the given id was used
     * @param {Object} createdClasses
     * @param {String} id
     * @returns {Boolean}
     */
    function existsId(createdClasses, id) {
        for (var _class in createdClasses) {
            if (createdClasses[_class].indexOf(id) > -1) { return true; }
        }

        return false;
    }

    var config = this.config,
        createdClasses = this.info.createdClasses,
        badgeClass = data.name;

    if (!createdClasses.hasOwnProperty(badgeClass)) { return vow.resolve('No such Badge Class!'); }

    var id = 0;

    /*jshint -W030 */
    do {
        id = uid.token(true),
        pathToBadge = path.join(badgeClass, id + '');
    } while (existsId(createdClasses, id));

    var badgeData = {
        uid: id,
        recipient: {
            type: 'email',
            hashed: false,
            identity: data.email
        },
        badge: config.host + '/' + badgeClass + '/class.json',
        issuedOn: unixTime(Date.now()),
        verify: {
            type: 'hosted',
            url: config.host + '/' + badgeClass + '/' + id + '/' + id + '.json'
        }
    };

    var badge =  {
        commitMsg: 'Add badge \'' + id + '\' in class \'' + badgeClass + '\'',
        data: new Buffer(JSON.stringify(badgeData, null, '  ')).toString('Base64')
    };

    return github.pushFile(config.user, config.repo, path.join(pathToBadge, id + '.json'), badge.commitMsg, badge.data)
        .then(function (res) {
            console.log(res);

            createdClasses[badgeClass].push(id);

            return badgeData;
        });
};

module.exports = OpenBadges;
