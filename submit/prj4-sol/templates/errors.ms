<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Errors</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        {{#errors}}
        <p class="error">{{msg}}</p>
        {{/errors}}
    </body>
</html>