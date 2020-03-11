// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';

export default class Validator {

  constructor(meta) {
    const xInfo = {};   //Object that holds the meta information
    const actions = {}; //Object that holds 

    //For each key-value pair in the meta object
    //Categories are users, articles, and comments
    for (const [category, infos] of Object.entries(meta)) {
      
      //Get the current category's fields, as field-name - object pairs
      //i.e. id: {name: 'id', friendlyName: 'user ID', ...}
      xInfo[category] = Object.fromEntries(infos.map(info => [info.name, info]));

      //Get the list of actions, and their number of fields that are 'required'
      //'forbidden', and 'optional', for the current category (users...)
      actions[category] = makeActions(infos);
    }

    //Save the meta category information
    this.meta = xInfo;

    //Save the meta action information
    this.actionFields = actions;
  }

  validate(category, act, obj) {
    const out = {};
    const infos = this.meta[category];
    if (!infos) {
      throw [ new BlogError(`BAD_CATEGORY', 'unknown category ${category}`) ];
    } 
    const errors = [];

    //Get the required fields for the given category and action
    const required = new Set(this.actionFields[category][act].required);

    //Get the 'forbidden' and 'optional' fields for the given category and action
    
    const { forbidden, optional } = this.actionFields[category][act];

    //Build an error message suffix for the given category and action
    const msgSuffix = `for ${category} ${act}`;

    for (const [name, value] of Object.entries(obj)) {
      
      required.delete(name);

      const info = infos[name];

      //Determine whether the current field belongs to the 'forbidden' list
      if (forbidden.has(name)) {
	      const msg = `the ${info.friendlyName} field is forbidden ${msgSuffix}`;
	      errors.push(new BlogError('BAD_FIELD', msg));
      }
      else if (name.startsWith('_')) {
        if (name === '_id') {
          const msg = `the internal mongo ${name} field is forbidden for ${category} ${act}`;
          errors.push(new BlogError('BAD_FIELD', msg));
        }
        else {
          out[name] = value;
        }
      }
      //Determine whether the current field has no info
      else if (info === undefined) {
	      const msg = `unknown ${category} field ${name} ${msgSuffix}`;
	      errors.push(new BlogError('BAD_FIELD', msg));
      }
      //Determine whether the current field has a 'checkFn' attribute, and the
      //value of the attribute doesn't meet the checkFn requirements
      else if (info.checkFn && !info.checkFn(value)) {
	      const msg = `bad value: ${value}; ${info.checkError} ${msgSuffix}`;
	      errors.push(new BlogError('BAD_FIELD_VALUE', msg));
      }
      else {
        //Add the field's name and attribute to the return object
	      out[name] = info.data ? info.data(value) : value;
      }
    } //for

    //Determine whether there are still required items with info, but
    //missing names
    if (required.size > 0) {
      //Map the fields' friendly names to the new array, since their true names
      //are missing
      const names = Array.from(required).
	      map(n => infos[n].friendlyName).
        join(', ');
        
      errors.push(new BlogError('MISSING_FIELD',
				`missing ${names} fields ${msgSuffix}`));
    }

    //Throw the list of errors
    if (errors.length > 0) throw errors;

    //For each optional field
    //Fill in default value for optional fields
    for (const name of optional) {
      //Determine whether the current optional field is not in the return
      //objject, and the field has a default function
      if (out[name] === undefined && infos[name].defaultFn !== undefined) {
        //Add the optional field to the return object, givin it a value using
        //the default function
	      out[name] = infos[name].defaultFn();
      }
    }
    
    //Return object is an object containing og the given category resulting
    //from the given action
    //i.e. 'comments' object resulting from 'create' 
    return out;
  }
  
};

function makeActions(infos) {
  //Possible actions for the user to take
  const acts = [ 'create', 'find', 'update', 'remove', ];

  //Create array of each action in 'acts', followed by the number of fields 
  //required and forbidden for those actions
  const pairs = acts.map(a => [a, { required: new Set(), forbidden: new Set(), }]);

  //Transform the 'pairs' key-value pairs array into an object
  const actions = Object.fromEntries(pairs);

  //For each field map in the category sequence
  //i.e., the group of objects under 'users', 'articles'... in the meta
  for (const info of infos) {

    //Get the name of the current field map (id, email, firstname, authorId...)
    const name = info.name;

    //For each action availability in the meta (fields can either be
    //'required' or 'forbidden' for certain actions)
    for (const k of [ 'required', 'forbidden' ]) {
      
      //For each action in the list of available actions for the current
      //action availability for the current category field
      //i.e. 'create' from [ 'create' ] for 'required' for 'email' for 'users'
      //then 'remove' from [ 'remove' ] for 'forbidden' for 'email' for 'users'
      for (const act of info[k] || []) {

        //Add the current field name to the list of fields that are 'required' or
        //'forbidden' for a given action for the current category
        //i.e. adding 'firstName' to the 'required' list for the 'create' action
        //in the 'users' category
    	  actions[act][k].add(name);
      }
    }
  }

  //Get an array for each category's fields' 'name' attribute
  //i.e. for 'users', [ 'id', 'email', 'firstName',... ]
  const names = infos.map(info => info.name);

  //For each action in the list of actions
  //i.e. 'create' from [ 'create', 'find', 'update', 'remove' ]
  for (const act of acts) {

    //Get the objects that associate how many fields are 'required' and
    //'forbidden' for each action for each category
    //i.e. for 'create' for 'users' 
    //  required: Set(5) { 'id', 'email', 'firstName', 'lastName', 'roles' },
    //  forbidden: Set(0) {}
    const actInfo = actions[act];
    
    //Add a new 'optional' action availability set
    actInfo.optional = new Set();

    //For each field name in the array of each category's fields' 'name'
    //attributes
    for (const name of names) {
      
      //If the current field name is not 'required' nor 'forbidden'
      if (!actInfo.required.has(name) && !actInfo.forbidden.has(name)) {
        //Add the current field name to the 'optional' set
	      actInfo.optional.add(name);
      }
    }
  }
  
  //Return the object containing how many fields are 'required', 'forbidden' and
  //'optional' for each action for each category
  return actions;
}

/*
import util from 'util';
import meta from './meta.mjs';
console.log(util.inspect(new Validator(meta), false, null));
*/
