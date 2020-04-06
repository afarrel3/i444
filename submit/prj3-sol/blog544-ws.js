import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import BlogError from './blog-error.js';

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  const base = app.locals.meta;
  app.use(cors());
  app.use(bodyParser.json());

  app.get('/', doGetTopUrl(app));
  app.get('/meta', doGetMeta(app));
  app.get('/users', doGetCategory(app));
  app.get('/articles', doGetCategory(app));
  app.get('/comments', doGetCategory(app));

  app.get('/users/:id', doGetObject(app));
  app.get('/articles/:id', doGetObject(app));
  app.get('/comments/:id', doGetObject(app));
  app.delete('/users/:id', doDelete(app));
  app.delete('/articles/:id', doDelete(app));
  app.delete('/comments/:id', doDelete(app));

  //app.get(base, doList(app));
  //app.post(base, doCreate(app));
  /* app.get(`${base}/:id`, doGet(app));
  app.delete(`${base}/:id`, doDelete(app));
  app.put(`${base}/:id`, doReplace(app));
  app.patch(`${base}/:id`, doUpdate(app)); */
  app.use(doErrors()); //must be last
  //console.log(app); //REMOVE
}

/****************************** Handlers *******************************/

function doGetTopUrl(app) {
  return errorWrap(async function(req, res) {
    try {
      const links = [];
      links.push(createSelfLink(req));

      links.push({
        rel : 'describedby',
        name : 'meta',
        href : 'http://' + req.headers.host + '/meta'
      });

      for (const category of Object.keys(app.locals.meta)) {
        links.push({
          rel : 'collection',
          name : category,
          href : 'http://' + req.headers.host + '/' + category
        });
      }

      const retObj = { 'links' : links };

      res.json(retObj);
      
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetMeta(app) {
  return errorWrap(async function(req, res) {
    try {
      const id = req.params.id;
      const results = app.locals.meta;
      if (results.length === 0) {
        throw {
          isDomain: true,
          errorCode: 'NOT_FOUND',
          message: `user ${id} not found`,
        };
      }
      else {
        results.links = new Array(createSelfLink(req));
	      res.json(results);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetCategory(app) {
  return errorWrap(async function(req, res) {
    try {
      const id = req.params.id;
      //Extract the collection category from the URL
      const category = req.url.split('?')[0].replace('/', '');
      const specs = req.query;
      const foundObjs = await app.locals.model.find(category, specs);
      console.log(req);
      requestNextPageUrl(req);
      if (foundObjs.length === 0) {
        throw {
          isDomain: true,
          errorCode: 'NOT_FOUND',
          message: `user ${id} not found`,
        };
      }
      else {
        const retObjs = [];
        for (const obj of foundObjs) {
          obj.links = new Array({
            rel : 'self',
            name : 'self',
            href : 'http://' + req.headers.host + '/' + category + '/' + obj.id
          });

          retObjs.push(obj);
        }

        const results = { [category] : retObjs };

        results.links = new Array(createSelfLink(req));
        results.links.push(requestNextPageUrl(req));
        res.json(results);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doGetObject(app) {
  return errorWrap(async function(req, res) {
    try {
      //Extract the collection category from the URL
      const category = (req.url.replace('/', '')).split('/')[0];
      const id = req.url.replace('/', '').split('/')[1];
      const foundObj = await app.locals.model.find(category, { id: id });
      
      if (foundObj.length === 0) {
        throw {
          isDomain: true,
          errorCode: 'NOT_FOUND',
          message: `user ${id} not found`,
        };
      }
      else {
        foundObj[0].links = new Array(createSelfLink(req));

        const results = { [category] : foundObj };

        res.json(results);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function doDelete(app) {
  return errorWrap(async function(req, res) {
    console.log('delete');
    try {
      //Extract the collection category from the URL
      const category = (req.url.replace('/', '')).split('/')[0];
      const id = req.url.replace('/', '').split('/')[1];
      const results = await app.locals.model.remove(category, { id: id });

      res.sendStatus(OK);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


/**************************** Error Handling ***************************/

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

const ERROR_MAP = {
  BAD_CATEGORY: NOT_FOUND,
  EXISTS: CONFLICT,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return (err instanceof Array && err.length > 0 && err[0] instanceof BlogError)
    ? { status: (ERROR_MAP[err[0].code] || BAD_REQUEST),
	code: err[0].code,
	message: err.map(e => e.message).join('; '),
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/****************************** Utilities ******************************/

/** Return original URL for req (excluding query params)
 *  Ensures that url does not end with a /
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}

function createSelfLink(req) {
  const rel = 'self';
  const name = 'self';
  //const href = requestUrl(req);
  const href = 'http://' + req.headers.host + (req.url.length === 1 ? '' : req.url);

  const retObj = {
    rel : rel,
    name : name,
    href : href
  };
  
  return retObj;
}

function requestNextPageUrl(req) {
  const count = (req.query._count === undefined) ? DEFAULT_COUNT : req.query._count;
  const index = Number((req.query._index === undefined) ? 0 : req.query._index) + Number(count);

  const url = req.originalUrl.replace(/_count=[0-9]+/, '_count='+count)
    .replace(/_index=[0-9]+/, '_index='+index);
  
    console.log(count);
    console.log(index);
    console.log(url);


  return `${req.protocol}://${req.hostname}:${req.app.locals.port}${url}`;
}

const DEFAULT_COUNT = 5;

//@TODO
