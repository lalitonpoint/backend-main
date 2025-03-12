const fs = require('fs');
exports.extractCodeSnippetsFromStack = function (stack, depth) {
    // Extract file paths from the stack
    const filePaths = stack.match(/\(([^)]*)\)/g);
    let codeSnippets = [];

    // Read the file and extract relevant code snippets for the first two files
    for (let i = 0; i < Math.min(filePaths.length, depth); i++) {
        const filePath = filePaths[i].replace(/[()]/g, '');

        if (filePath.includes("/")) {
            const [file, lineNumber] = extractFilePathAndLineNumber(filePath);
            const codeLines = readCodeLinesFromFile(file, lineNumber);
            codeSnippets.push({ file, code: codeLines });
        }
    }

    return codeSnippets;
}

function extractFilePathAndLineNumber(filePath) {
    const matches = filePath.split(":");
    if (matches) {
        const file = matches[0];
        const lineNumber = parseInt(matches[1]);
        return [file, lineNumber];
    }
    return [filePath, null];
}

function readCodeLinesFromFile(filePath, lineNumber) {
    try {
        const codeFile = fs.readFileSync(filePath, "utf8");
        const codeLines = codeFile.split("\n"); //.slice(lineNumber, 5);

        if (lineNumber) {
            const startLine = Math.max(0, lineNumber - 3); // Adjust the number of lines to include
            const endLine = lineNumber + 3; // Adjust the number of lines to include
            return codeLines.slice(startLine, endLine);
        }
        return [];
    } catch (error) {
        console.error("Error reading code file:", error);
        return [];
    }
}

const DEFAULT_REQUEST_INCLUDES = ["data", "headers", "method", "query_string", "url"];

exports.extractRequestData = function (req, options) {
    const { include = DEFAULT_REQUEST_INCLUDES } = options || {};

    const requestData = {};

    const headers = req.headers || {};
    const method = req.method;
    const host = req.get("hostname") || req.get("host") || headers.host || "<no host>";
    const protocol = req.protocol === "https" || (req.socket && req.socket.encrypted) ? "https" : "http";
    const originalUrl = req.originalUrl || req.url || "";
    const absoluteUrl = originalUrl.startsWith(protocol) ? originalUrl : `${protocol}://${host}${originalUrl}`;

    include.forEach((key) => {
        switch (key) {
            case "headers": {
                requestData.headers = headers;

                // Remove the Cookie header in case cookie data should not be included in the event
                if (!include.includes("cookies")) {
                    delete requestData.headers.cookie;
                }
                break;
            }
            case "method": {
                requestData.method = method;
                break;
            }
            case "url": {
                requestData.url = absoluteUrl;
                break;
            }
            case "cookies": {
                requestData.cookies = req.cookies || (headers.cookie && cookie.parse(headers.cookie)) || {};
                break;
            }
            case "query_string": {
                requestData.query_string = extractQueryParams(req);
                break;
            }
            case "data": {
                if (method === "GET" || method === "HEAD") {
                    break;
                }
                if (req.body !== undefined) {
                    requestData.data = req.body;
                }
                break;
            }
            default: {
                if ({}.hasOwnProperty.call(req, key)) {
                    requestData[key] = req[key];
                }
            }
        }
    });

    return requestData;
}

function extractQueryParams(req, deps) {
    let originalUrl = req.originalUrl || req.url || "";

    if (!originalUrl) {
        return;
    }

    if (originalUrl.startsWith("/")) {
        originalUrl = `http://dogs.are.great${originalUrl}`;
    }

    return (
        req.query ||
        (typeof URL !== "undefined" && new URL(originalUrl).search.replace("?", "")) ||
        // In Node 8, `URL` isn't in the global scope, so we have to use the built-in module from Node
        (deps && deps.url && deps.url.parse(originalUrl).query) ||
        undefined
    );
}