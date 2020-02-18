// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';
import Validator from './validator.js';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

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

  constructor(meta, options) {
    //@TODO
    
    //Need a map for each category (users, articles, comments)
    //indexed by their id fields


    this.blog = { users: new Map(), articles: new Map(), comments: new Map() };

    

    this.meta = meta;
    this.options = options;
    this.validator = new Validator(meta);
  }

  static async make(meta, options) {
    //@TODO
    
    

    return new Blog544(meta, options);
  }

  /** Remove all data for this blog */
  async clear() {
    //@TODO

    //Clear all data from the blog object maps
    this.blog.users.clear();
    this.blog.articles.clear();
    this.blog.comments.clear();
  } // !clear

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    
    const errors = [];
    
    //Determine whether the blog object's category is 'users'
    if (category === 'users') {
      //Try to find the user in the map
      const user = await this.find('users', {id: obj.id});

      //Determine whether the object already exists
      if (user.length > 0) {
        //Throw an error message
        const msg = `object with id ${obj.id} already exists for ${category}`;
        errors.push(new BlogError('EXISTS', msg));
      }
      else {
        //Add the created blog object to the corresponding mapping
        this.blog.users.set(obj.id, obj);
      }
    }
    else if (category === 'articles') { //Articles check
      //Generate an ID for the article
      obj.id = generateId(category);

      //Try to find the user in the map
      const user = await this.find('users', {id: obj.authorId});

      //Determine whether the author for this article exists
      if (user.length === 0) {
        //Throw an error message
        const msg = `user with id ${obj.authorId} does not exist for article id: ${obj.id}, title: ${obj.title}`;
        errors.push(new BlogError('EXISTS', msg));
      }
      else {
        //Add the created blog object to the corresponding mapping
        this.blog.articles.set(obj.id, obj);
      }
    }
    else { //Comments check
      //Generate an ID for the comment
      obj.id = generateId(category);

      //Try to find the user in the map
      const user = await this.find('users', {id: obj.commenterId});

      //Try to find the article in the map
      const article = await this.find('articles', {id: obj.articleId});

      //Determine whether the author for this article exists
      if (user.length === 0) {
        //Throw an error message
        const msg = `user with id ${obj.commenterId} does not exist for comment id ${obj.id}`;
        errors.push(new BlogError('EXISTS', msg));
      }

      //Determine whether the article for this comment exists
      if (article.length === 0) {
        //Throw an error message
        const msg = `article with id ${obj.articleId} does not exist for comment id ${obj.id}`;
        errors.push(new BlogError('EXISTS', msg));
      }

      if ((user.length > 0) && (article.length > 0)) {
        //Add the created blog object to the corresponding mapping
        this.blog.comments.set(obj.id, obj);
      }
    }

    if (errors.length > 0) { throw errors; }

    return obj.id;
  } // !create

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    const obj = this.validator.validate(category, 'find', findSpecs);
    

    let items = [];
    let matches = new Array();
    let mapping = new Map();

    //Determine which category map to use
    if (category === 'users') { //Use 'users' map
      items = Array.from(this.blog.users.values());
      mapping = this.blog.users;
    }
    else if (category === 'articles') { // User 'articles' map
      items = Array.from(this.blog.articles.values());
      mapping = this.blog.articles;
    }
    else if (category === 'comments') { //User 'comments' map
      items = Array.from(this.blog.comments.values());
      mapping = this.blog.comments;
    }
    else {
      return [];
    }

    //Determine whether a _count was specified
    if (findSpecs._count === undefined) {
      //Default the _count spec
      findSpecs._count = DEFAULT_COUNT
    }

    //Determine whether an ID was given to search by
    if (findSpecs.id === undefined) {
      //For each item, up to the default item count to return
      for (let i = 0; (i < findSpecs._count) && (i < items.length); i++) {
        //Add the current item in the 'category' map to the return array
        matches.push(items[i]);
      }
      
      return matches;
    }

    //Determine whether an item with the given ID is in the map
    if (mapping.has(findSpecs.id)) {
      //Add the item with the given ID to the return array
      matches.push(mapping.get(findSpecs.id));
      return [mapping.get(findSpecs.id)];
    }
    return matches;
  } // !find

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    
    const errors = [];

    //Try to find the item to remove
    const item = await this.find(category, {id: rmSpecs.id});

    //Determine whether the item to remove exists
    if (item.length > 0) {
      //Determine the blog object category
      if (category === 'users') {
        //Determine whether the given user has any linked articles
        for (const value of this.blog.articles.values()) {
          //Determine whether the current article data references the given user
          if (value.authorId === rmSpecs.id) {
            //Add a new error
            const msg = `user ${rmSpecs.id} referenced by authorId for article ${value.id}`;
            errors.push(new BlogError('BAD_ID', msg));
          }
        }

        //Determine whether the given user has any linked comments
        for (const value of this.blog.comments.values()) {
          //Determine whether the current comment data references the given user
          if (value.commenterId === rmSpecs.id) {
            const msg = `user ${rmSpecs.id} referenced by commenterId for comment ${value.id}`;
            errors.push(new BlogError('BAD_ID', msg));
          }
        }

        //Remove the given user from the blog if no errors were found
        if (errors.length === 0) { this.blog.users.delete(rmSpecs.id); }
      } // !if
      else if (category === 'articles') {
        //Determine whether the given article has any linked comments
        for (const value of this.blog.comments.values()) {
          //Determine whether the current comment data references the given article
          if (value.articleId === rmSpecs.id) {
            const msg = `article ${rmSpecs.id} referenced by commenterId for comment ${value.id}`;
            errors.push(new BlogError('BAD_ID', msg));
          }
        }
  
        //Remove the given article from the blog
        if (errors.length === 0) {this.blog.articles.delete(rmSpecs.id); }
      } // !else if
      else { //No dependencies for comments
        this.blog.comments.delete(rmSpecs.id);
      }
    } // !if
    else {
      //Add a new error
      const msg = `object with id ${rmSpecs.id} does not exist for ${category}`;
      errors.push(new BlogError('EXISTS', msg));
    }

    if (errors.length > 0) { throw errors; }

  } // !remove

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);

    const errors = [];

    //Determine the category
    if (category === 'users') {
      //Try to get the user
      const user = await this.find('users', {id: updateSpecs.id});

      //Determine whether the given user exists
      if(user.length > 0) {
        //Determine which values were specified to update
        if (updateSpecs.firstName !== undefined) {
          user.firstName = updateSpecs.firstName;
        }
        if (updateSpecs.lastName !== undefined) {
          user.lastName = updateSpecs.lastName;
        }
        if (updateSpecs.email !== undefined) {
          user.email = updateSpecs.email;
        }
        if (updateSpecs.roles !== undefined) {
          user.roles = updateSpecs.roles;
        }

        //Update the item
        this.blog.users.set(user.id, user);
      }
      else { //The user wasn't found
        //Add an error
        const msg = `user with id ${updateSpecs.id} doesn't exist`;
        errors.push(new BlogError('EXISTS', msg));
      }
    }
    else if (category === 'articles') {
      //Try to get the article
      const article = await this.find('articles', {id: updateSpecs.id});

      if(article.length > 0) {
        //Determine which values were specified to update
        if (updateSpecs.title !== undefined) {
          article.title = updateSpecs.title;
        }
        if (updateSpecs.content !== undefined) {
          article.content = updateSpecs.content;
        }
        if (updateSpecs.keywords !== undefined) {
          article.keywords = updateSpecs.keywords;
        }

        //Update the articles
        this.blog.articles.set(article.id, article);
      }
      else { //The article wasn't found
        //Add an error
        const msg = `article with id ${updateSpecs.id} doesn't exist`;
        errors.push(new BlogError('EXISTS', msg));
      }
    }
    else {
      //Try to get the article
      const comment = await this.find('comments', {id: updateSpecs.id});

      if(comment.length > 0) {
        //Determine which values were specified to update
        if (updateSpecs.content !== undefined) {
          comment.content = updateSpecs.content;
        }

        //Update the comment
        this.blog.comments.set(comment.id, comment);
      }
      else { //The comment wasn't found
        //Add an error
        const msg = `comment with id ${updateSpecs.id} doesn't exist`;
        errors.push(new BlogError('EXISTS', msg));
      }
    }

    if (errors.length > 0) { throw errors; }
    
  } // !update
  
}

const DEFAULT_COUNT = 5;

//You can add code here and refer to it from any methods in Blog544.

const idNumbers = [];

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
  
  //Put the numbers together, separated by a '.'
  return number;
}