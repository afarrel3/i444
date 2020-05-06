(function() {
    document.getElementById('userId').addEventListener('focusout', userfunc());
})();

function userfunc() {
    const response = fetch('/ListUsers?returnJson=true');
    const returnedJson = response.json();
    if (returnedJson.length === 0) {
        let template = 'SearchUsers';
        let model = errorModel(app, search, errors);
        model.prevQuery = prevQuery;
    
        const html = doMustache(app, template, model);
        res.send(html);
    }

}