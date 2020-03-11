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
    if (!options.dbUrl.match(/(mongodb:\/\/)([a-zA-Z0-9]+):([0-9]+)[\/DB]?/)) {
      throw [ new BlogError('DB', `bad mongo url ${options.dbUrl}`) ];
    }

    //Connect to the mongodb database
    const client = await mongo.connect(options.dbUrl, MONGO_CONNECT_OPTIONS);

    //Save a reference to the database
    const db = client.db(DB_NAME);
    //const usersCollection = db.collection()
    
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

    //Determine how to handle the _id for the object to create
    if (category === 'users') {
      //Try to find the user in the database
      const foundUser = await this.find(category, {id: obj.id});

      //Determine whether the user already exists
      if (foundUser.length > 0) {
        const msg = `object with id ${obj.id} already exists for ${category}`;
        errors.push(new BlogError('EXISTS', msg));
      }
      else {
        //Add the _id field to the created object
        obj._id = obj.id;

        //Add the created object to the DB
        await this.db.collection(category).insertOne(obj);
      }
    } //users
    else if (category === 'articles') {
      //Generate an id for the article
      obj.id = obj._id = generateId(category);

      //Try to find the user for the article in the database
      const foundUser = await this.find('users', {id: obj.authorId});

      //Determine whether the user already exists for this article
      if (foundUser.length > 0) {
        //Add the article to the database
        await this.db.collection(category).insertOne(obj);
      }
      else {
        const msg = `user with id ${obj.authorId} does not exist for article id ${obj.id}, title: ${obj.title}`;
        errors.push(new BlogError('EXISTS', msg));
      }
    } //articles
    else {
      //Generate an id for the comment
      obj.id = obj._id = generateId(category);

      //Try to find the author user in the database
      const foundUser = await this.find('users', {id: obj.commenterId});

      //Try to find the article in the database
      const foundArticle = await this.find('articles', {id: obj.articleId});

      //Determine whether the author for this article exists
      if (foundUser.length === 0) {
        //Throw an error message
        const msg = `user with id ${obj.commenterId} does not exist for comment id ${obj.id}`;
        errors.push(new BlogError('EXISTS', msg));
      }

      //Determine whether the article for this comment exists
      if (foundArticle.length === 0) {
        //Throw an error message
        const msg = `article with id ${obj.articleId} does not exist for comment id ${obj.id}`;
        errors.push(new BlogError('EXISTS', msg));
      }

      if ((foundUser.length > 0) && (foundArticle.length > 0)) {
        //Add the created blog object to the corresponding mapping
        await this.db.collection(category).insertOne(obj);
      }
    } //comments

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
    //console.log(category); //REMOVE
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

    //console.log(foundObjs);
    
    return foundObjs;
  } //find

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    const errors = [];

    //Check to see if the object to remove exists in the database
    const foundObj = await this.db.collection(category).find(rmSpecs)
      .project({_id: 1})
      .toArray();
    
    //Determine whether the item to remove exists
    if (foundObj.length > 0) {
      if (category === 'users') {
        //Determine whether the given user has any linked articles
        const foundArticles = await this.db.collection('articles').find({authorId: rmSpecs.id}).toArray();

        //Determine wehther the given user has any linked comments
        const foundComments = await this.db.collection('comments').find({commenterId: rmSpecs.id}).toArray();

        for (const article of foundArticles) {
          const msg = `user ${rmSpecs.id} referenced by authorId for article ${article.id}`;
          errors.push(new BlogError('BAD_ID', msg));
        }
        
        for (const comment of foundComments) {
          const msg = `user ${rmSpecs.id} referenced by commenterId for comment ${comment.id}`;
          errors.push(new BlogError('BAD_ID', msg));
        }
      } // if
      else if (category === 'articles') {
        //Determine wehther the given article has any linked comments
        const foundComments = await this.db.collection('comments').find({articleId: rmSpecs.id}).toArray();

        for (const comment of foundComments) {
          const msg = `article ${rmSpecs.id} referenced by articleId for comment ${comment.id}`;
          errors.push(new BlogError('BAD_ID', msg));
        }
      } //else if
      else {
        //Comments have no dependencies
      } //else
    } //if
    else {
      const msg = `object with id ${rmSpecs.id} does not exist for ${category}`;
      errors.push(new BlogError('EXISTS', msg));
    }
    
    //Determine whether any linked objects were found for the user
    if (errors.length === 0) {
      await this.db.collection(category).deleteOne({_id: foundObj[0]._id});
    }

    if (errors.length > 0) { throw errors; }
  } //remove

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    const errors = [];

    const copySpecs = Object.assign({}, updateSpecs);
    const updateId = copySpecs.id;
    delete copySpecs.id;

    //Get the object to update
    const updateObj = await this.db.collection(category).find({id: updateId})
      .toArray();
    const toUpdate = Object.assign({}, updateObj[0]);

    //Update the found object with the updated fields
    for (const [key, value] of Object.entries(copySpecs)) {
      toUpdate[key] = copySpecs[key];
    }

    //Replace the original object in the database with the updated object
    await this.db.collection(category).replaceOne({_id: updateObj[0]._id}, toUpdate);

    if (errors.length > 0) throw errors;
  } //update
  
} //Blog544

const DEFAULT_COUNT = 5;

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

const DB_NAME = 'prj2';

const idNumbers =[];

/*
Generate a random id for article or comment objects
article IDs returned in the form XX.XXXXX
comment IDs returned in the form XXX.XXXXX
*/
function generateId(category)
{
  const errors = [];
  let number;
  let wholeNumber;
  let duplicateId = true;

  do {
    //Generate a random number, in form XXXXX
    let fraction = Math.floor(Math.random() * 90000) + 10000;

    //Determine the type of ID to generate
    if (category === 'articles') {
      //Generate a random number, in form xx
      wholeNumber = Math.floor(Math.random() * 90) + 10;
    }
    else if (category === 'comments') {
      //Generate a random number, in form XXX
      wholeNumber = Math.floor(Math.random() * 900) + 100;
    }
    else { //Unrecognized category
      const msg = `category ${category} has no ID field`;
      errors.push(new BlogError('BAD_FIELD_VALUE', msg));
      return undefined;
    }
    
    //Combine the whole and fractional numbers into an ID
    number = (wholeNumber.toString() + '.' + fraction.toString());

    //Determine whether the ID has already been generated
    if (idNumbers.includes(number) === true) {
      //Push an error for the duplicate ID
      const msg = `ID ${number} already exists`;
      errors.push(new BlogError('BAD_FIELD_VALUE', msg));
    }
    else {
      //No duplicate ID was found
      duplicateId = false;
    }

  } while (duplicateId); //Loop until a unique ID is generated

  //Add the Id to the array
  idNumbers.push(number);

  if (errors.length > 0) { throw errors; }
  
  return number;
} //generateId