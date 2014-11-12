var GitHubApi = require('github'),
    vow = require('vow'),
    promisify = require('vow-node').promisify;

var github = new GitHubApi({
    version: '3.0.0',
    debug: false,
    protocol: 'https',
    host: 'api.github.com',
    timeout: 10000000
});

var getGitContent = promisify(github.repos.getContent),
    getCommits = promisify(github.repos.getCommits);
    createFile = promisify(github.repos.createFile);

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
        });
}

/**
 * Returns the list of all commits starting from the 'page' number
 * @param {String} user
 * @param {String} repo
 * @param {Number} page
 * @returns {Promise}
 */
function getAllCommits(user, repo, page) {
    return getCommits({
        user: user,
        repo: repo,
        page: page,
        // jscs:disable
        per_page: 100
    })
        .then(function (res) {
            if (res.length < 100) {
                return res;
            } else {
                return getAllCommits(user, repo, ++page)
                    .then(function (_res) {
                        return res.concat(_res);
                    });
            }
        });
}

/**
 * Pushes file on Github
 * @param {String} user
 * @param {String} repo
 * @param {String} path
 * @param {String} message
 * @param {String in Base64 encoding} content
 * @returns {Promise}
 */
function pushFile(user, repo, path, message, content) {
    return createFile({
        user: user,
        repo: repo,
        path: path,
        message: message,
        content: content
    });
}

module.exports = {
    authenticate: authenticate,
    getRepoContent: getRepoContent,
    getAllCommits: getAllCommits,
    pushFile: pushFile
};
