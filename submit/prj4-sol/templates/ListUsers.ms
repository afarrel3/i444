<!DOCTYPE html>
<html lang="en">
    <head>
        <title>List Users</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <h1>List Users</h1>
        <table>
            <body>
                <tr>
                    <th>User Id</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Creation Date</th>
                    <th>Update Date</th>
                </tr>
                {{#users}}
                    <tr>
                        <td>{{id}}</td>
                        <td>{{firstName}} {{lastName}}</td>
                        <td>{{email}}</td>
                        <td>{{roles}}</td>
                        <td>{{creationTime}}</td>
                        <td>{{updateTime}}</td>
                    </tr>
                {{/users}}
            </body>
        </table>

        {{#paging}}
        <div class="scroll">
            {{#paging.prevShow}}<a href="/ListUsers?{{paging.prevLink}}" rel="prev">&lt;&lt;</a>{{/paging.prevShow}}
            {{#paging.nextShow}}<a href="/ListUsers?{{paging.nextLink}}" rel="next">&gt;&gt;</a>{{/paging.nextShow}}
        </div>
        {{/paging}}
        
        <footer>
            <ul>
                <li><a href="/ListUsers">List Users</a></li>
                <li><a href="/SearchUsers">Search Users</a></li>
            </ul>
        </footer>
    </body>
</html>