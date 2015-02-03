module.exports =
'<!DOCTYPE html>\n' +
'<html class="ua_js_no">\n' +
'    <head>\n' +
'        <meta http-equiv="X-UA-Compatible" content="IE=edge"/>\n' +
'        <meta charset="utf-8"/>\n' +
'        <title>Award</title>\n' +
'    </head>\n' +
'    <body>\n' +
'        <script src="https://backpack.openbadges.org/issuer.js"></script>\n' +
'        <script>\n' +
'            var url = window.location.href,\n' +
'                data = url.substring(url.indexOf("?") + 1).split("="),\n' +
'                klass = data[0],\n' +
'                badge = data[1];\n' +
'            OpenBadges.issue_no_modal(["http://REPO_PATH/" + klass + "/" + badge + ".json"], function(err, suc) {});\n' +
'        </script>\n' +
'    </body>\n' +
'</html>\n';
