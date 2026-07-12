const url = new URL(document.URL).origin;

module.exports = (path, callback) => {
    let httpRequest;

    if (window.XMLHttpRequest) { // Mozilla, Safari, ...
        httpRequest = new XMLHttpRequest();
        if (httpRequest.overrideMimeType) {
            httpRequest.overrideMimeType("application/json");
        }
    }
    else if (window.ActiveXObject) { // IE
        try {
            httpRequest = new ActiveXObject("Msxml2.XMLHTTP");
        } catch {
            try {
                httpRequest = new ActiveXObject("Microsoft.XMLHTTP");
            } catch {}
        }
    }

    if (!httpRequest) {
        console.log("Не вышло :( Невозможно создать экземпляр класса XMLHTTP ");
        return;
    }

    httpRequest.onreadystatechange = () => callback(httpRequest);
    httpRequest.open("GET", url + path, true);
    httpRequest.send();
};
