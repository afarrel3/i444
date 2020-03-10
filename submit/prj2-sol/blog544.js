// -*- mode: JavaScript; -*-

import mongo from 'mongodb';

import BlogError from './blog-error.js';
import Validator from './validator.js';
import assert from 'assert';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

DB:
  Database error

BAD_CATEGORY:
  Category is not one of 'articles', 'comments', 'users'.

BAD_FIELD:
  An object contains an unknown field name or a forbidden field.

BAD_FIELD_VALUE:
  The value of a field does not meet its specs.

BAD_ID:
  Object not found for specified id for update/remove
  Object being removed is referenced by another category.
  Other category object being referenced does not exist (for example,
  authorId in an article refers to a non-existent user).

EXISTS:
  An object being created already exists with the same id.

MISSING_FIELD:
  The value of a required field is not specified.

*/

export default class Blog544 {

  constructor(meta, options, client, db) {
    
    this.meta = meta;
    this.options = options;
    this.client = client;
    this.db = db;
    this.validator = new Validator(meta);
  }

  /** options.dbUrl contains URL for mongo database */
  static async make(meta, options) {
    //Validate the given mongodb url is of a valid format
    if (!options.dbUrl.match(/(mongodb:\/\/)([a-zA-Z0-9]+):([0-9]+)/)) {
      throw [ new BlogError('DB', `bad mongo url ${options.dbUrl}`) ];
    }

    //Connect to the mongodb database
    const client = await mongo.connect(options.dbUrl, MONGO_CONNECT_OPTIONS);
    const db = client.db(DB_NAME);

    //console.log(await db.collection(COMMENTS_TABLE)); //REMOVE
    
    return new Blog544(meta, options, client, db);
  }

  /** Release all resources held by this blog.  Specifically, close
   *  any database connections.
   */
  async close() {
    await this.client.close();
  }

  /** Remove all data for this blog */
  async clear() {
    //Remove data from the mongo database
    await this.db.dropDatabase();
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    const errors = [];

    //Add the _id field to the created object
    obj._id = obj.id;

    //Determine whether the created object already exists in the database
    const foundObj = await this.find(category, {id: obj.id});
    if (foundObj.length === 0) {
      //Add the created object to the DB
      await this.db.collection(category).insertOne(obj);
    }
    else {
      const msg = `object with id ${obj.id} already exists for ${category}`;
      errors.push(new BlogError('EXISTS', msg));
    }

    if (errors.length > 0) throw errors;
    
    return obj.id;
  }

  /** Find blog objects from category which meets findSpec.  
   *
   *  First returned result will be at offset findSpec._index (default
   *  0) within all the results which meet findSpec.  Returns list
   *  containing up to findSpecs._count (default DEFAULT_COUNT)
   *  matching objects (empty list if no matching objects).  _count .
   *  
   *  The _index and _count specs allow paging through results:  For
   *  example, to page through results 10 at a time:
   *    find() 1: _index 0, _count 10
   *    find() 2: _index 10, _count 10
   *    find() 3: _index 20, _count 10
   *    ...
   *  
   */
  async find(category, findSpecs={}) {
    const obj = this.validator.validate(category, 'find', findSpecs);

    //Make a copy of findSpecs to modify
    const search = Object.assign({}, findSpecs);

    //Determine whether the ._count field is undefined
    const count = (search._count === undefined) 
      ? DEFAULT_COUNT
      : search._count; delete search._count;

    //Determine whether the ._index field is undefined
    const index = (search._index === undefined)
      ? 0
      : search._index; delete search._index; //Delete from the findSpecs copy

    //Find the object(s) in the database
    const foundObjs = await this.db.collection(category).find(search)
      .skip(Number(index))
      .limit(Number(count))
      .project({_id: 0})
      .sort('id', 1)
      .toArray();
    
    return foundObjs;
  } //find

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);

    //Determine whether the _id field was specified
    if (rmSpecs.id === undefined) {
      const msg = `missing id for ${category}`;
      throw [new BlogError('MISSING_FIELD', msg)];
    }

    //Check to see if the object to remove exists in the database
    const foundObj = await this.db.collection(category).find(rmSpecs)
      .project({_id: 1})
      .toArray();
      
    //Determine whether the object to remove was found
    if (foundObj.length === 0) {
      const msg = `object ${rmSpecs.id} does not exist for ${category}`;
      throw [new BlogError('EXISTS', msg)];
    }
    else {
      //Remove the specified object from the database
      await this.db.collection(category).deleteOne({_id: foundObj[0]._id});
    }
  } //remove

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const errors = [];
    const obj = this.validator.validate(category, 'update', updateSpecs);
    //console.log(obj); //REMOVE

    const copySpecs = Object.assign({}, updateSpecs);
    //console.log(copySpecs); //REMOVE
    const id = copySpecs.id;
    delete copySpecs.id;
    //console.log(copySpecs); //REMOVE

    //Get the object to update
    const updateObj = await this.find(category, {id: copySpecs.id});
    //console.log(updateObj); //REMOVE
    //console.log(updateObj.length); //REMOVE

    // if (updateObj.length === 0) {
    //   const msg = `no ${category} for id ${updateObj.id} in update`;
    //   errors.push(new BlogError('BAD_ID', msg));
    // }
    // else {
    //   //Update the object in the database
    //   //console.log(updateObj); //REMOVE
    //   await this.db.collection(category).updateOne(updateObj, updateSpecs);
    // }
    //console.log(Object.getOwnPropertyNames(copySpecs));

    for (const [key, value] in copySpecs) {
      console.log(key); //REMOVE
      console.log(value); //REMOVE
      await this.db.collection(category).updateOne({updateObj: updateObj._id},
        { $set: {key: value} },
        { upsert: true });
    }

    //await this.db.collection(category).updateOne(updateObj, copySpecs);

    const repeat = await this.find(category, {id: updateSpecs.id});
    console.log(repeat);
    if (errors.length > 0) throw errors;








  } //update
  
} //Blog544

const DEFAULT_COUNT = 5;

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

const DB_NAME = 'prj2';

const USERS_TABLE = 'userInfos';
const ARTICLES_TABLE = 'articleInfos';
const COMMENTS_TABLE = 'commentInfos';


//-----------------------------------------
//Helper functions from 'UserStore' example
//-----------------------------------------

function fromDbUsers(dbUsers) {
  return dbUsers.map((user) => fromDbUsers(user));
}

function fromDBUser(dbUser) {
  const user = Object.assign({}, dbUser);
  delete user._id;
  return user;
}

async function toDbUsers(users, mustHaveId=true) {
  //Mapping async fn returns list of promises
  const userPromises = users.map(async (user) => await toDbUsers(user, mustHaveId));

  //Use Primise.all() to unwrap promised values
  return await Promise.all(userPrimises);
}

async function toDbUser(user, mustHaveId) {
  if (user._id) {
    const msg = `invalid property name _id for user ${JSON.stringify(user)}`;
    throw new UserError('BAD_KEY', msg);
  }    
  const dbUser =  Object.assign({}, user); //shallow copy
  dbUser.id = dbUser.id || await gitEmail();
  if (mustHaveId && !dbUser.id) {
    const msg = `cannot get id for user ${JSON.stringify(user)}`;
    throw new UserError('NO_ID', msg);
  }
  if (dbUser.id) dbUser._id = dbUser.id;
  return dbUser;
}

async function gitEmail() {
  try {
    const cmd = 'git config --global --get user.email';
    const {stdout, stderr} = await exec(cmd); //destructuring
    return stdout.trim();
  }
  catch (err) {
    throw new UserError('ID_FAIL', 'cannot get git email for current user');
  }
}

function isDuplicateError(err) {
  return (err.code === 11000);
}

function UserError(code, msg) {
  this.errorCode = code;
  this.message = msg;
}