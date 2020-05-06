//-*- mode: javascript -*-

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import Path from 'path';
import mustache from 'mustache';
import querystring from 'querystring';

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

//emulate commonjs __dirname in this ES6 module
const __dirname = Path.dirname(new URL(import.meta.url).pathname);

export default function serve(port, ws) {
  const app = express();
  app.locals.port = port;
  
  //Web service wrapper
  //Use to get info from the server (users, articles, comments...)
  app.locals.ws = ws;

  process.chdir(__dirname); //so paths relative to this dir work
  setupTemplates(app);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

/******************************** Routes *******************************/

function setupRoutes(app) {
  //Homepage url
  app.use('/', express.static(STATIC_DIR));

  //List users url
  app.get('/ListUsers', doListItems(app));
  app.get('/ListUsers?_index', doListItems(app));
  app.get('/ListUsers?', doListItems(app));
  app.get('/ListUsers?returnJson=true', doListItems(app, true));

  app.get('/SearchUsers', doSearchItem(app));

  app.use(doErrors(app)); //must be last   
}

/****************************** Handlers *******************************/

function doListItems(app, returnJson=false) {
  return async function(req, res) {
    let queryParams = {}; //Parameters to search for users by

    //For each parameter in the current query
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== '') { //Determine whether the parameter has a value
        queryParams[`${key}`] = value;  //Save the parameter
      } //if
    } //for
    
    //Get a list of matching users from the web service
    const data =  await app.locals.ws.list('users', queryParams);
  
    const users = usersIsoToShortDate(data.users);        //Convert dates
    const paging = setScrollingLinks(data, queryParams);  //Get scrolling indecies

    const model = { base: app.locals.ws.url, users: users, paging: paging};
    const html = doMustache(app, 'ListUsers', model);
    res.send(html);
  };
} //doListUsers

function doSearchItem(app) {
  return async function(req, res) {
    //Determine whether we are submitting a form
    const isSubmit = req.query.submit !== undefined;
    let queryParams = req.query;
    delete queryParams.submit;
    
    let users = [];
    let errors = undefined;
    let paging = {};
    let userData = [];
    let prevQuery = {};
    const search = getNonEmptyValues(queryParams);

    //For each parameter in the current query
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== '') { //Determine whether the parameter has a value
        prevQuery[`${key}`] = value;  //Save the parameter to search users by
      } //if
    } //for

    //Determine whether we want to handle a submitted form
    if (isSubmit){
      const validationErrors = validate(search);
      //Determine whether we have any valid search parameters
      if (Object.keys(search).length === 0) {
        const msg = 'at least one search parameter must be specified';
        errors = Object.assign(errors || {}, { _: msg });
      } //if
      
      if (!errors) {
        try {
          //Get a list of matching users from the web service
          userData = await app.locals.ws.list('users', search);
          //Save of a list of all found users
          for (const usr of userData.users) { users.push(usr); }

          if (users.length === 0) {
            errors = { _: 'no users found for specified criteria'};
          }
        } //try
        catch (err) {
          const validationErrors = validate(search);
          
          if (validationErrors.length === 0) {
            errors = { _: 'server error' };
          } //if
          else {
            errors = { _: validationErrors }
          } //else
          console.error(err);
        } //catch
      } //if
    } //if

    let model, template;
    if (users.length > 0) {
      template = 'ListUsers';
      users = usersIsoToShortDate(users); //Convert dates from ISO to short
      paging = setScrollingLinks(userData, queryParams);
      model = { base: app.locals.ws.url,
        users: users,
        paging: paging };
    } //if
    else {
      template = 'SearchUsers';
      model = errorModel(app, search, errors);
      model.prevQuery = prevQuery;
    } //else
    
    const html = doMustache(app, template, model);
    res.send(html);
  };
} //doSearchUsers

function doErrors(app) {
  return async function(err, req, res, next) {
    console.log('doErrors()');
    const errors = [ `Server error` ];
    const html = doMustache(app, `errors`, {errors, });
    res.send(html);
    console.error(err);
  };
}

/************************ General Utilities ****************************/

function usersIsoToShortDate(userList) {
  const returnUsers = [];

  //For each blog user in the given list
  for (const user of userList) {
    //Create iso date objects to convert
    const isoCreateDate = new Date(user.creationTime);
    const isoUpdateDate = new Date(user.updateTime);
    
    const createDate
      = [isoCreateDate.getMonth()+1,
        isoCreateDate.getDate(),
        isoCreateDate.getFullYear()]
        .join('/');

    const updateDate
      = [isoUpdateDate.getMonth()+1,
        isoUpdateDate.getDate(),
        isoUpdateDate.getFullYear()]
        .join('/');

    const userToPush = user;
    userToPush.creationTime = createDate;
    userToPush.updateTime = updateDate;
    returnUsers.push(userToPush);
  } //for
  return returnUsers;
} //usersIsoToShortDate

/** Set up the object that holds the index values
 *  for paging between groups of users
 */
function setScrollingLinks(userData, queryParams={}) {
  const paging = {};
  const prev = {};
  const next = {};
  Object.assign(prev, queryParams);
  Object.assign(next, queryParams);

  prev._index = userData.prev;
  next._index = userData.next;

  paging.prevLink = querystring.stringify(prev);
  paging.nextLink = querystring.stringify(next);

  paging.prevShow = (userData.prev === undefined) ? false : true;
  paging.nextShow = (userData.next === undefined) ? false : true;
  
  return paging;
} //setScrollingLinks

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      console.log('errorWrap()');
      next(err);
    }
  };
}

function isNonEmpty(v) {
  return (v !== undefined) && v.trim().length > 0;
}

/************************ Mustache Utilities ***************************/

function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

function setupTemplates(app) {
  //Initialize empty templates object property
  app.templates = {};

  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {

    //Determine whether the current file matches a mustache file name
    const m = fname.match(/^([\w\-]+)\.ms$/);
    
    if (!m) continue;
    try {
      //
      app.templates[m[1]] =
        String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  } //for
} //setupTemplates

/************************** Field Definitions **************************/

const FIELDS_INFO = {
  id: {
    friendlyName: 'User Id',
    isSearch: true,
    isId: true,
    isRequired: true,
    regex: /^\w+$/,
    error: 'User Id field can only contain alphanumerics or _',
  },
  firstName: {
    friendlyName: 'First Name',
    isSearch: true,
    regex: /^[a-zA-Z\-\' ]+$/,
    error: "First Name field can only contain alphabetics, -, ' or space",
  },
  lastName: {
    friendlyName: 'Last Name',
    isSearch: true,
    regex: /^[a-zA-Z\-\' ]+$/,
    error: "Last Name field can only contain alphabetics, -, ' or space",
  },
  email: {
    friendlyName: 'Email Address',
    isSearch: true,
    type: 'email',
    regex: /^[^@]+\@[^\.]+(\.[^\.]+)+$/,
    error: 'Email Address field must be of the form "user@domain.tld"',
  },
  creationTime: {
    friendlyName: 'user creation time',
    isSearch: true,
    type: 'date',
    regex: /^\d{4}\-\d\d\-\d\d(T[012]\d:[0-5]\d(:[0-6]\dZ)?)?$/,
    error: 'the user creation time must be a valid ISO-8601 date-time',
  },
};

const FIELDS =
  Object.keys(FIELDS_INFO).map((n) => Object.assign({name: n}, FIELDS_INFO[n]));

/************************** Field Utilities ****************************/

/** Return copy of FIELDS with values and errors injected into it. */
function fieldsWithValues(values, errors={}) {
  return FIELDS.map(function (info) {
    const name = info.name;
    const extraInfo = { value: values[name] };
    if (errors[name]) extraInfo.errorMessage = errors[name];
    return Object.assign(extraInfo, info);
  });
}

/** Given map of field values and requires containing list of required
 *  fields, validate values.  Return errors hash or falsy if no errors.
 */
function validate(values, requires=[]) {
  const errors = {};
  requires.forEach(function (name) {
    if (values[name] === undefined) {
      errors[name] =
	      `A value for '${FIELDS_INFO[name].friendlyName}' must be provided`;
    }
  });
  for (const name of Object.keys(values)) {
    const fieldInfo = FIELDS_INFO[name];
    const value = values[name];
    if (fieldInfo.regex && !value.match(fieldInfo.regex)) {
      errors[name] = fieldInfo.error;
    }
  }
  return Object.keys(errors).length > 0 && errors;
}

function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    if (FIELDS_INFO[k] !== undefined) {
      const v = values[k];
      if (v && v.trim().length > 0) out[k] = v.trim();
    }
  });
  return out;
}

/** Return a model suitable for mixing into a template */
function errorModel(app, values={}, errors={}) {
  return {
    base: app.locals.ws.url,
    errors: errors._,
    fields: fieldsWithValues(values, errors)
  };
}