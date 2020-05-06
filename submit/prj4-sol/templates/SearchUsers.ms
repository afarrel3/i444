<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Search User</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <h1>Search User</h1>
        <ul>
            {{^errors.email}}
            {{^errors.creationTime}}
            <p class="error">{{errors}}</p>
            {{/errors.creationTime}}
            {{/errors.email}}
        </ul>
        <p>
            Please fill in one or more of the following fields
        </p>
        <form method="GET" action="/SearchUsers">
        
            <label for="userId">User ID</label>
            <div>
                <input name="id" id="userId" value="{{#prevQuery.id}}{{prevQuery.id}}{{/prevQuery.id}}">
                <div class="error" id="userIdErr"></div>
            </div>
            
            <label for="email">User Email</label>
            <div>
                <input name="email" id="email" value="{{#prevQuery.email}}{{prevQuery.email}}{{/prevQuery.email}}">
                {{#errors.email}}
                <div class="error">{{.}}</div>
                {{/errors.email}}
            </div>

            <label for="firstName">First Name</label>
            <div>
                <input name="firstName" id="firstName" value="{{#prevQuery.firstName}}{{prevQuery.firstName}}{{/prevQuery.firstName}}">
                <div class="error"></div>
            </div>

            <label for="lastName">Last Name</label>
            <div>
                <input name="lastName" id="lastName" value="{{#prevQuery.lastName}}{{prevQuery.lastName}}{{/prevQuery.lastName}}">
                <div class="error"></div>
            </div>

            <label for="creationTime">ISO Creation Time</label>
            <div>
                <input name="creationTime" id="creationTime" value="{{#prevQuery.creationTime}}{{prevQuery.creationTime}}{{/prevQuery.creationTime}}">
                {{#errors.creationTime}}
                <div class="error">{{.}}</div>
                {{/errors.creationTime}}
            </div>
            &nbsp;<input name="submit" type="submit" value="search" class="control">
        </form> 
        <footer>
            <ul>
                <li><a href="/ListUsers">List Users</a></li>
                <li><a href="/SearchUsers">Search Users</a></li>
            </ul>
        </footer>
    </body>
</html>