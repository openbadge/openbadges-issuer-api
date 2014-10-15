var GitHubApi = require('github'),
    vow = require('vow'),
    promisify = require('vow-node').promisify;

var github = new GitHubApi({
    version: '3.0.0',
    debug: false,
    protocol: 'https',
    host: 'api.github.com',
    timeout: 5000
});

var getGitContent = promisify(github.repos.getContent),
    getCommits = promisify(github.repos.getCommits);

/**
 * Github authorization by accsess token
 * @param {String} token
 */
function authenticate(token) {
    github.authenticate({
        type: 'oauth',
        token: token
    });
}

/**
 * Returns the list of dirs and files of the given Github repo starting from the given path
 * @param {String} user
 * @param {String} repo
 * @param {String} path
 * @returns {Promise}
 */
function getRepoContent(user, repo, path) {
    return getGitContent({
        user: user,
        repo: repo,
        path: path
    })
        .then(function (res) {
            return vow.all(res.map(function (item) {
                if (item.type !== 'dir') {
                    return item.name;
                }
                return getRepoContent(user, repo, item.path)
                    .then(function (res) {
                        return {
                            name: item.name,
                            children: res
                        };
                    })
                    .fail(function (err) {
                        console.log(err);
                    });
            }));
        })
        .fail(function (err) {
            console.log(err);
        });
}

/**
 * Returns the list of classes' names in order as they were committed to github (from the last to the first)
 * @param {String} user
 * @param {String} repo
 * @returns {Promise}
 */
function getClassesCommits(user, repo) {
    return getCommits({
        user: user,
        repo: repo
    })
        .then(function (res) {
            return vow.all(res.map(function (item) {
                var message = item.commit.message;

                if (message.indexOf('Add metadata for class ') > -1) {
                    return message.slice(message.indexOf('\'') + 1, message.lastIndexOf('\''));
                }
            }).filter(function (val) {
                return val !== undefined;
            }));
        })
        .fail(function (err) {
            console.log(err);
        });
}

/**
 * Pushes file on Github
 * @param {String} user
 * @param {String} repo
 * @param {String} path
 * @param {String} message
 * @param {String in Base64 encoding} content
 */
function pushFile(user, repo, path, message, content) {
    github.repos.createFile({
        user: user,
        repo: repo,
        path: path,
        message: message,
        content: content
    }, function (err, res) {
        if (err) { console.log(err); }

        console.log(res);
    });
}

module.exports = {
    authenticate: authenticate,
    getRepoContent: getRepoContent,
    getClassesCommits: getClassesCommits,
    pushFile: pushFile
};
