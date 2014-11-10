var fs = require('fs'),
    path = require('path'),
    uid = require('uid'),
    unixTime = require('unix-time'),
    vow = require('vow'),
    github = require('./github-api'),
    awardHtml = require('./award');

/**
 * @class OpenBadges
 * @constructor
 * @param {Object}   [config]
 * @param {String}   [config.user]
 * @param {String}   [config.repo]
 * @param {String}   [config.storage]
 * @param {Object}   [info]
 * @param {Boolean}  [info.hasIssuer]
 * @param {Object[]} [info.classes]
 */
var OpenBadges = function (config, info) {
    this.config = config;
    this.info = info;
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
        url: (/^http(s)?:\/\/(.*)$/.test(data.url) ? '' : 'http://') + data.url,
        description: data.description,
        image: [config.storage, 'img.png'].join('/'),
        email: data.email
    };

    var issuer = {
        commitMsg: 'Add metadata for an issuer \'' + data.name + '\'',
        data: new Buffer(JSON.stringify(issuerData, null, '  ')).toString('Base64'),
    },
    img = {
        commitMsg: 'Add image for an issuer \'' + data.name + '\'',
        data: fs.readFileSync(data.image, 'Base64')
    },
    award = {
        commitMsg: 'Add awarding html for an issuer \'' + data.name + '\'',
        data: new Buffer(awardHtml).toString('Base64'),
    };

    return github.pushFile(config.user, config.repo, 'award.html', award.commitMsg, award.data)
        .then(function (awardPushRes) {
            console.log(awardPushRes);

            return vow.all([
                github.pushFile(config.user, config.repo, 'issuer.json', issuer.commitMsg, issuer.data),
                github.pushFile(config.user, config.repo, 'img.png', img.commitMsg, img.data)
            ]);
        })
        .spread(function (issuerPushRes, imgPushRes) {
            console.log(issuerPushRes);
            console.log(imgPushRes);

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
        classes = this.info.classes,
        className = data.name.trim().replace(/( )+/g, '_');

    var classData = {
        name: data.name,
        description: data.description,
        image: [config.storage, className, 'img.png'].join('/'),
        criteria: (/^http(s)?:\/\/(.*)$/.test(data.criteria) ? '' : 'http://') + data.criteria,
        issuer: [config.storage, 'issuer.json'].join('/')
    };

    var klass = {
        commitMsg: 'Add metadata for class \'' + className + '\'',
        data: new Buffer(JSON.stringify(classData, null, '  ')).toString('Base64')
    },
    img = {
        commitMsg: 'Add image for class \'' + className + '\'',
        data: fs.readFileSync(data.image, 'Base64')
    };

    return vow.all([
        github.pushFile(config.user, config.repo, path.join(className, 'class.json'), klass.commitMsg, klass.data),
        github.pushFile(config.user, config.repo, path.join(className, 'img.png'), img.commitMsg, img.data)
    ]).spread(function (classPushRes, imgPushRes) {
        console.log(classPushRes);
        console.log(imgPushRes);

        classes.unshift({
            name: className,
            badges: []
        });

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
     * Returns the index of the given class in the list of classes
     * @param {Object[]} classes
     * @param {String} className
     * @returns {Number}
     */
    function getClassIndex(classes, className) {
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].name === className) {
                return i;
            }
        }

        return -1;
    }

    /* BADGE CREATION GOES NEXT */

    var config = this.config,
        classes = this.info.classes,
        className = data.name;

    var indexOfClass = getClassIndex(classes, className);
    if (indexOfClass === -1) return vow.resolve('No such Badge Class!');

    var id = uid(20);

    var badgeData = {
        uid: id,
        recipient: {
            type: 'email',
            hashed: false,
            identity: data.email
        },
        badge: [config.storage, className, 'class.json'].join('/'),
        issuedOn: unixTime(Date.now()),
        verify: {
            type: 'hosted',
            url: [config.storage, className, id + '.json'].join('/')
        }
    };

    var badge =  {
        commitMsg: 'Add badge \'' + id + '\' in class \'' + className + '\'',
        data: new Buffer(JSON.stringify(badgeData, null, '  ')).toString('Base64')
    };

    return github.pushFile(config.user, config.repo, path.join(className, id + '.json'), badge.commitMsg, badge.data)
        .then(function (badgePushRes) {
            console.log(badgePushRes);

            classes[indexOfClass].badges.push(id);

            return badgeData;
        });
};

/**
 * Initializes Open Badges
 * @param {Object} [config]
 * @paran {String} [config.token]
 * @paran {String} [config.user]
 * @param {String} [config.repo]
 * @param {String} [config.storage]
 * @returns {Promise}
 */
function initialize(config) {
    /**
     * Logs an error and stops the process
     * @param {String} msg
     */
    function throwErrorMsg(msg) {
        console.log(msg);
        process.exit(1);
    }

    /**
     * Checks whether the issuer exists
     * @param {Object[]} content
     * @returns {Boolean}
     */
    function existsIssuer(content) {
        return content.indexOf('issuer.json') > -1 && content.indexOf('img.png') > -1 &&
            content.indexOf('award.html') > -1;
    }

    /**
     * Returns classes with the list of badges in them
     * @param {Object[]} content
     * @param {Boolean} hasIssuer
     * @returns {Object[]}
     */
    function getClasses(content, hasIssuer) {
        var classes = [];

        content.forEach(function (item) {
            if (typeof item === 'object') {
                if (!hasIssuer) {
                    throwErrorMsg('Invalid declaration of the issuer');
                }

                classes.push({
                    name: item.name,
                    badges: []
                });

                if (item.children.indexOf('class.json') === -1 || item.children.indexOf('img.png') === -1) {
                    throwErrorMsg('Invalid declaration of class \'' + item.name + '\'');
                }

                item.children.forEach(function (elem) {
                    if (elem !== 'class.json' && elem !== 'img.png') {
                        classes[classes.length - 1].badges.push(elem.replace('.json', ''));
                    }
                });
            }
        });

        return classes;
    }

    /**
     * Sorts classes by date as they were commited
     * @param {Object[]} classes
     * @param {Object[]} commits
     * @returns {Object[]}
     */
    function sortClasses(classes, commits) {
        var sortedClasses = [];

        commits.forEach(function (item) {
            var message = item.commit.message;

            if (message.indexOf('Add metadata for class ') > -1) {
                var className = message.slice(message.indexOf('\'') + 1, message.lastIndexOf('\''));

                classes.forEach(function (elem) {
                    if (elem.name === className && sortedClasses.indexOf(elem) === -1) {
                        sortedClasses.push(elem);
                    }
                });
            }
        });

        return sortedClasses;
    }

    /* INITIALIZATION OF OPEN BADGES GOES NEXT */

    github.authenticate(config.token);

    return vow.all([
        github.getRepoContent(config.user, config.repo, ''),
        github.getAllCommits(config.user, config.repo, 1)
    ]).spread(function (content, commits) {
        var hasIssuer = existsIssuer(content),
            classes = sortClasses(getClasses(content, hasIssuer), commits);

        return new OpenBadges({
            user: config.user,
            repo: config.repo,
            storage: config. storage
        }, {
            hasIssuer: hasIssuer,
            classes: classes
        });
    });
}

module.exports = {
    initialize: initialize
};
