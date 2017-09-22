process.title = function () {
    var t = process.argv.indexOf('-t');
    if (++t && process.argv[t] && ((typeof process.argv[t]) == 'string')) return process.argv[t];
    return 'node-kringle';
}();


// modules needed
var fs = require('fs');
var h = require('http');
var hs = require('https');


// load config, pull path to config file from command line options
var config = JSON.parse(fs.readFileSync((function () {
    var c = process.argv.indexOf('-c');
    if (++c && process.argv[c] && ((typeof process.argv[c]) == 'string')) return process.argv[c];
    return process.argv[1].replace(/[^\/]+$/, '') + 'kringle.config.json';
})()));


// will store the indexes of secure hosts from config.hosts
var httpsHosts = [];
for (var i = 0; i < config.hosts.length; i++) {
    // secure is a true/false
    if (config.hosts[i].secure && (config.hosts[i].secure===true)) httpsHosts.push(i);
}




function getCPT(type, cpt) {

    for (var i = 0; i < cpt.length; i++) {
        for (var c = 0; c < cpt[i]['types'].length; c++) {
            if (type.indexOf(cpt[i]['types'][c])+1) return cpt[i].cache_control;
        }
    }
    return '';
}


// status is an object with two possible properties: code and message
function serve(res, status, data, hdrs, host, filter) {

    hdrs['Content-Type'] = hdrs['Content-Type'] || 'text/html; charset=UTF-8';
    hdrs['Content-Length'] = data.length;

    // client caching
    var cpt; // cache per type
    if (status.code == 500);
    else if (status.code == 401) hdrs['Cache-Control'] = 'no-cache';
    else if (filter.cache_per_type && filter.cache_per_type.length && (cpt = getCPT(hdrs['Content-Type'], filter.cache_per_type))) hdrs['Cache-Control'] = cpt;
    else if (filter.cache_control) hdrs['Cache-Control'] = filter.cache_control;
    else if (host && host.cache_per_type && host.cache_per_type.length && (cpt = getCPT(hdrs['Content-Type'], host.cache_per_type))) hdrs['Cache-Control'] = cpt;
    else if (host && host.cache_control) hdrs['Cache-Control'] = host.cache_control;
    else if (config.cache_per_type && config.cache_per_type.length && (cpt = getCPT(hdrs['Content-Type'], config.cache_per_type))) hdrs['Cache-Control'] = cpt;
    else if (config.cache_control) hdrs['Cache-Control'] = config.cache_control;

    // custom headers
    if (filter.custom_headers) {
        for (var p in filter.custom_headers) hdrs[p] = filter.custom_headers[p];
    }
    else if (host && host.custom_headers) {
        for (var p in host.custom_headers) hdrs[p] = host.custom_headers[p];
    }
    else if (config.custom_headers) {
        for (var p in config.custom_headers) hdrs[p] = config.custom_headers[p];
    }

    if (status.code == 304) {
        delete hdrs['Content-Type'];
        delete hdrs['Content-Length'];
    }

    // accept range requests
    hdrs['Accept-Ranges'] = 'bytes';
    // finish up and serve
    hdrs['Server'] = config.server_name;
    status.message ? res.writeHead(status.code, status.message, hdrs) : res.writeHead(status.code, hdrs);
    res.end(data);
}





// this is a utility function to prevent repetition in buildResponse
function getCustomStatus(prop, code, host, filter) {

    if (filter && filter.custom_statuses &&
    filter.custom_statuses[code] &&
    filter.custom_statuses[code][prop]) {
        return filter.custom_statuses[code][prop];
    }
    if (host && host.custom_statuses &&
    host.custom_statuses[code] &&
    host.custom_statuses[code][prop]) {
        return host.custom_statuses[code][prop];
    }
    if (config.custom_statuses &&
    config.custom_statuses[code] &&
    config.custom_statuses[code][prop]) {
        return config.custom_statuses[code][prop];
    }
    return '';
}


function resolveType(file, host, filter) {

    var types = filter.types || host.types || config.types;
    var reqExt = file.match(/[^\.]+$/i)[0];
    for (var i = 0; i < types.length; i++) {
        if (new RegExp('(^|\\s)' + reqExt + '($|\\s)', 'i').test(types[i][0])) return types[i][1];
    }
    return filter.default_type || host.default_type || config.default_type || 'application/octet-stream';
}


function buildResponse(prot, req, res, code, host = {}, filter = {}) {

    var hdrs = {};

    // redirects and authentication
    if (/301|302|303|307/.test(String(code))) {
        hdrs['Location'] = function () {
            var reqLocPtrn = new RegExp(filter.req_param_value);
            var curLoc;
            if (reqLocPtrn.test(curLoc = prot + '://' + req.headers['host'] + req.url));
            else if (reqLocPtrn.test(curLoc = req.headers['host'] + req.url));
            else if (reqLocPtrn.test(curLoc = req.url));
            return curLoc.replace(reqLocPtrn, filter.loc_to);
        }();
    }
    else if (code == 401) {
        hdrs['WWW-Authenticate'] = 'Basic Realm="Secure Area"';
    }

    // determine filesystem path to either requested resource or custom status html file
    var file = (function () {
        if (!code) {
            return host.to_root.replace(/\/$/, '') + req.url.replace(/\?.*/, '');
        }
        return getCustomStatus('to_html', code, host, filter);
    })();

    // if there is no file, then there must be an error condition; serve with default html
    if (!file) {
        serve(res, {code: code, message: getCustomStatus('message', code, host, filter)}, getCustomStatus('html', code, host, filter), hdrs, host, filter);
        return;
    }

    fs.stat(file, function (error, stats) {
        if (code && (error || !stats.isFile())) {
            serve(res, {code: code, message: getCustomStatus('message', code, host, filter)}, getCustomStatus('html', code, host, filter), hdrs, host, filter);
            return;
        }
        if (error) {
            buildResponse(prot, req, res, 404, host, filter);
            return;
        }
        if (stats.isDirectory()) {
            if (!/\/$/.test(file)) {
                serve(res, {code: 301, message: ''}, getCustomStatus('html', 301, host, filter), {
                    'Location': prot + "://" + req.headers['host'] + req.url.replace(/([^\/])($|\?)/, '$1/$2')
                }, host, filter);
                return;
            }
            file = file + (host.default_file || config.default_file);
        }

        if (!code) { // because it wouldn't make sense to send a Last-Modified for any status other than 200
            fs.stat(file, function (error, stats) {
                if (error) {
                    code = error.code == 'ENOENT' ? 404 : 500;
                    serve(res, {code: code, message: getCustomStatus('message', code, host, filter)}, getCustomStatus('html', code, host, filter), {}, host, filter);
                    return;
                }
                var mTime = new Date(stats.mtime);
                if (req.headers['if-modified-since'] &&
                (mTime.getTime() == (new Date(req.headers['if-modified-since'])).getTime())) {
                    serve(res, {code: 304, message: ''}, '', {'Content-Type': resolveType(file, host, filter)}, host, filter);
                    return;
                }
                hdrs['Last-Modified'] = mTime.toUTCString();
            });
        }


        fs.readFile(file, function (error, data) {
            if (error && code) {
                serve(res, {code: code, message: getCustomStatus('message', code, host, filter)}, getCustomStatus('html', code, host, filter), hdrs, host, filter);
                return;
            }
            if (error) {
                // serve a 500, not a 404, because, at this point, we know the file exists; must be something else
                serve(res, {code: 500, message: ''}, getCustomStatus('html', 500, host, filter), {}, host, filter);
                return;
            }
            if (!code) hdrs['Content-Type'] = resolveType(file, host, filter);
            // content ranges
            if (req.headers['range']) {
              var rg = req.headers['range'].match(/bytes=(\d+)-(\d*)/i);
              if (rg) {
                var s = +rg[1];
                var e = (rg[2] !== '') ? +rg[2] : data.length - 1;
                if ((s >= 0) && (e >= s) && (e <= data.length)) {
                  code = 206;
                  hdrs['Content-Range'] = 'bytes ' + s + '-' + e + '/' + data.length;
                  data = data.slice(s, e + 1);
                }
                /* 416s may not be a good idea, since, apparently, some clients
                   continuously hit the server up for the same invalid range
                   until it's satisfied. In this case, many servers will just
                   ignore the range request and serve the entire resource with
                   a 200. kringle abides.
                 */
                //else {
                //  code = 416;
                //  hdrs['Content-Range'] = '*/' + data.length;
                //}
              }
            }
            serve(res, {code: (code || 200), message: getCustomStatus('message', (code || 200), host, filter)}, data, hdrs, host, filter);
        });
    });
}




function parseRequest(prot, req, res) {

    var host;

    // check that there's a host field and that it's not empty
    if (!req.headers['host']) {
        buildResponse(prot, req, res, 400);
        return;
    }

    var hostNoPort = req.headers['host'].replace(/\:\d+$/, '');
    // identify host
    for (var h, i = 0; h = config.hosts[i]; i++) {
        // strip out the port number before attempting the search
        if (h.host && new RegExp(h.host, 'i').test(hostNoPort)) {
            host = h;
            break;
        }
    }
    // if still no host, send a 400
    if (!host) {
        buildResponse(prot, req, res, 400);
        return;
    }

    // identify the matching filter
    for (var filter = {}, reqLocPtrn, i = 0; host.filters && (i < host.filters.length); i++) {

        reqLocPtrn = new RegExp(host.filters[i].req_param_value);

        if ((host.filters[i].req_param_key == 'url') &&
           (reqLocPtrn.test(req.url) ||
           reqLocPtrn.test(hostNoPort + req.url) ||
           reqLocPtrn.test(prot + '://' + hostNoPort + req.url))) {
            filter = host.filters[i];
            break;
        }

        var targetField = req.headers[host.filters[i].req_param_key.toLowerCase()];
        if (targetField && reqLocPtrn.test(targetField)) {
            filter = host.filters[i];
            break;
        }
    }

    if (filter.action == 'extension') {
        // for the future
        return;
    }

    if ((!isNaN(+filter.action)) && (filter.action == 401)) {
        var creds = req.headers['authorization'];
        if (creds) {
            creds = creds.replace(/^Basic\s+/i, ''); // will take the base64 credential string
            creds = (new Buffer(creds, 'base64')).toString().split(':');
            if ((creds[0] == filter.username) && (creds[1] == filter.password)) { // AUTHORIZED!
                buildResponse(prot, req, res, 0, host, filter);
                return;
            }
        }
    }

    buildResponse(prot, req, res, +(filter.action || 0), host, filter);
}

// standard server
h.createServer(function (req, res) {
  // doing it this way so we can pass the protocol to the handler--that info is not available via the request object
  parseRequest('http', req, res);
}).listen(config.server_http_port);

// secure server
// we may have to start a new instance of each secure server since each one has its own security credentials
/*
if (httpsHosts.length) hs.createServer({
    key: fs.readFileSync(''),
    cert: fs.readFileSync('')
},function (req, res) {
    parseRequest('https', req, res);
}).listen(config.server_https_port);
*/
