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
    this.blog.clear();
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    //@TODO

    //Determine whether the given blog object already exists
    if (this.find(category, { id: obj.id }).length > 0) {

    }
    
    //Determine whether the blog object's category is 'users'
    if (category === 'users') {
      //Add the created blog object to the corresponding mapping
      this.blog.users.set(obj.id, obj);
    }
    else if (category === 'articles') {
      obj.id = generateId(category);
      this.blog.articles.set(obj.id, obj);
    }
    else {
      obj.id = generateId(category);
      this.blog.comments.set(obj.id, obj);
    }
    
    return obj.id;
  } // !create

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    const obj = this.validator.validate(category, 'find', findSpecs);
    //@TODO

    let items = [];
    const matches = [];

    let mapping = new Map();

    //Determine which category map to use
    if (category === 'users') { //Use 'users' map
      items = Array.from(this.blog.users.values());
      mapping = this.blog.users;
      //console.log(this.blog.users);
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
    //console.log(mapping);

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
        //console.log(items[i]);
        matches.push(items[i]);
      }
      //console.log(matches);
      return matches;
    }

    //Determine whether an item with the given ID is in the map
    if (mapping.has(findSpecs.id)) {
      //Add the item with the given ID to the return array
      matches.push(mapping.get(findSpecs.id));
    }

    return matches;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    //@TODO
  }
  
}

const DEFAULT_COUNT = 5;

//You can add code here and refer to it from any methods in Blog544.

/*
Generate a random id for article or comment objects
article IDs returned in the form XX.XXXXX
comment IDs returned in the form XXX.XXXXX
*/
function generateId(category)
{
  let wholeNumber;

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
    return undefined;
  }

  //Put the numbers together, separated by a '.'
  return (wholeNumber.toString() + '.' + fraction.toString());
}