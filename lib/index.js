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
 * @param {String} [config.gh-pages]
 */
var OpenBadges = function (config) {
    /**
     * Logs an error and stop the process
     * @param {String} msg
     */
    function throwErrorMsg(msg) {
        console.log('Invalid declaration of ' + msg);
        process.exit(1);
    }

    this.user = config.user;
    this.repo = config.repo;
    this.host = config['gh-pages'];

    this.createdClasses = {};
    this.hasIssuer = false;

    github.authenticate(config.token);

    github.getRepoContent(this.user, this.repo, '')
        .then(function (res) {
            var createdClasses = {},
                hasIssuer = res.indexOf('issuer.json') > -1 && res.indexOf('img.png');

            res.forEach(function (item) {
                if (typeof item === 'object') {
                    if (!hasIssuer) {
                        throwErrorMsg('the issuer');
                    }

                    createdClasses[item.name] = [];

                    if (item.children.indexOf('class.json') === -1 || item.children.indexOf('img.png') === -1) {
                        throwErrorMsg('class \'' + item.name + '\'');
                    }

                    item.children.forEach(function (child) {
                        if (typeof child === 'object') {
                            createdClasses[item.name].push(child.name);

                            if (child.children.indexOf(child.name + '.json') === -1) {
                                throwErrorMsg('badge \'' + child.name + '\' in class \'' + item.name + '\'');
                            }
                        }
                    });
                }
            });

            this.createdClasses = createdClasses;
            this.hasIssuer = hasIssuer;

            console.log(createdClasses);
            console.log('Done!');
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
 * @returns {Object}
 */
OpenBadges.prototype.createIssuer = function (data) {
    var issuerData = {
        name: data.name,
        url: data.url,
        description: data.description,
        image: this.host + '/img.png',
        email: data.email
    };

    this.hasIssuer = true;

    var img = fs.readFileSync(data.image, 'Base64'),
        _issuerData = new Buffer(JSON.stringify(issuerData, null, '  ')).toString('Base64');

    github.pushFile(this.user, this.repo, 'img.png', 'Add image for an issuer', img);
    github.pushFile(this.user, this.repo, 'issuer.json', 'Add metadata for an issuer', _issuerData);

    return issuerData;
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
 * @returns {Object}
 */
OpenBadges.prototype.createClass = function (data) {
    var host = this.host,
        createdClasses = this.createdClasses,
        badgeClass = data.name.trim().replace(/( )+/g, '_');

    if (createdClasses.hasOwnProperty(badgeClass)) {
        return 'The Badge Class already exists!';
    }

    createdClasses[badgeClass] = [];

    var classData = {
        name: data.name,
        description: data.description,
        image: host + '/' + badgeClass + '/' + 'img.png',
        criteria: data.criteria,
        issuer: host + '/issuer.json'
    };

    var img = fs.readFileSync(data.image, 'Base64'),
        _classData = new Buffer(JSON.stringify(classData, null, '  ')).toString('Base64');

    github.pushFile(this.user, this.repo, path.join(badgeClass, 'img.png'), 'Add image for a class', img);
    github.pushFile(this.user, this.repo, path.join(badgeClass, 'class.json'), 'Add metadata for a class', _classData);

    return classData;
};

/**
 * Creates a badge to be awarded
 * @class OpenBadges
 * @method
 * @param {Object} [data]
 * @param {String} [data.name]
 * @param {String} [data.email]
 * @returns {Object}
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

    var host = this.host,
        createdClasses = this.createdClasses,
        badgeClass = data.name;

    if (!createdClasses.hasOwnProperty(badgeClass)) { return 'No such Badge Class!'; }

    var id = 0;

    /*jshint -W030 */
    do {
        id = uid.token(true),
        pathToBadge = path.join(badgeClass, id + '');
    } while (existsId(createdClasses, id));

    createdClasses[badgeClass].push(id);

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

    var _badgeData = new Buffer(JSON.stringify(badgeData, null, '  ')).toString('Base64');

    github.pushFile(this.user, this.repo, path.join(pathToBadge, id + '.json'), 'Add badge', _badgeData);

    return badgeData;
};

module.exports = OpenBadges;
