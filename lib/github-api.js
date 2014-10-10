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

var getGitContent = promisify(github.repos.getContent);

function authenticate(token) {
    github.authenticate({
        type: 'oauth',
        token: token
    });
}

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
    pushFile: pushFile
};
