// -*- mode: JavaScript; -*-

import BlogError from './blog-error.js';
import assert from 'assert';

export default class Data {

  constructor(meta, options) {
    this.meta = metaInfo(meta);
    this.options = options;
    this.data = {};
    for (const [category, fields] of Object.entries(meta)) {
      this.data[category] = { data: {}, indexes: {} };
      for (const field of fields) {
	if (field.doIndex) this.data[category].indexes[field.name] = {};
      }
    }
  }
  
  static make(meta, options) {
    return new Data(meta, options);
  }

  create(category, obj) { 
    const collection = this.data[category];
    assert(collection, `create: unknown category ${category}`);
    const meta = this.meta[category];
    const id = obj.id || makeId(collection);
    const errors = [];
    assert(meta);
    this._validateNotExists(category, obj, collection, errors);
    this._validateIdentifies(category, obj, meta, errors);
    if (errors.length > 0) throw errors;
    obj.id = id;
    collection.data[id] = obj;
    this._addIndexes(obj, collection, meta);
    return id;
  }

  find(category, searchSpec) {
    const collection = this.data[category];
    assert(collection, `find: unknown category ${category}`);
    const meta = this.meta[category];
    //make a copy of searchSpec as we will delete keys
    const search = Object.assign({}, searchSpec);
    const count = search._count || COUNT;
    delete search._count;
    let ids;
    if (search.id !== undefined) {
      ids = [ search.id ];
      delete search.id;
    }
    //use indexes if search specifies a field with indexes
    for (const [name, value] of indexPairs(search, meta.indexes)) {
      delete search[name];
      const valueIds = collection.indexes[name][value];
      let n;
      if (valueIds === undefined) { //no results for name == value
	n = 0;
	return [];
      }
      else { //constrain ids
	ids = intersect(ids, valueIds);
	n = valueIds.size;
      }
      if (this.options.verbose) console.log(`${name}: ${n}`);
    }
    //if ids still undefined, then return all data
    if (ids === undefined) ids = Object.keys(collection.data);
    //map ids to objects; remove undefined in case unknown id was given
    let objs = ids.map(id => collection.data[id]).filter(x => x !== undefined);
    //if there are still keys in search, filter objs by their value
    for (const [name, value] of Object.entries(search)) {
      objs = objs.filter(o => o[name] === value);
    }
    //return up to count objects after sorting
    return objs.sort(sortCreationTime).slice(0, count);
  }

  update(category, updateSpec) {
    const collection = this.data[category];
    assert(collection, `update: unknown category ${category}`);
    const meta = this.meta[category];
    const obj = this._findById(collection, updateSpec);
    if (obj === undefined) {
      const msg = `no ${category} for id ${updateSpec.id} in update`;
      throw [ new BlogError('BAD_ID', msg) ];
    }
    this._removeIndexes(updateSpec, collection, meta, obj);
    this._addIndexes(updateSpec, collection, meta);
    Object.assign(obj, updateSpec);
  }

  remove(category, removeSpec) {
    const collection = this.data[category];
    assert(collection, `remove: unknown category ${category}`);
    const meta = this.meta[category];
    const obj = this._findById(collection, removeSpec);
    if (obj === undefined) {
      const msg = `no ${category} for id ${removeSpec.id} in remove`;
      throw [ new BlogError('BAD_ID', msg) ];
    }
    const errors = [];
    const id = obj.id;
    //for each category/field which refers to objects in this category
    for (const [cat, field] of meta.identifiedBy) {
      //build string of referring id's from referring categories
      const catIds =
	this.find(cat, {[field]: obj.id}).
	map(o => o.id).
	join(', ');
      if (catIds.length > 0) {
	const msg = `${category} ${obj.id} referenced by ${field} ` +
                    `for ${cat} ${catIds}`;
	errors.push(new BlogError('BAD_ID', msg));
      }
    }
    if (errors.length > 0) throw errors;
    this._removeIndexes(obj, collection, meta);
    delete collection.data[obj.id];
  }

  _findById(collection, spec) {
    assert(spec.id !== undefined);
    return collection.data[spec.id];
  }

  /** For each value in obj which is for an index field, add it
   *  to index in collection.indexes.
   */
  _addIndexes(obj, collection, meta) {
    const indexes = collection.indexes;
    for (const [name, value] of indexPairs(obj, meta.indexes)) {
      addIndex(indexes[name], value, obj.id);
    }
  }

  _removeIndexes(obj, collection, meta, valueObj) {
    const indexes = collection.indexes;
    const id = obj.id;
    assert(id !== undefined);
    for (const [name, value] of indexPairs(obj, meta.indexes, valueObj)) {
      indexes[name][value].delete(id);
    }
  }


  _validateNotExists(category, obj, collection, errors) {
    if (collection.data[obj.id]) {
      const msg = `object with id ${obj.id} already exists for ${category}`;
      errors.push(new BlogError('EXISTS', msg));
    }
  }
  
  _validateIdentifies(category, obj, meta, errors) {
    for (const [name, otherCategory] of Object.entries(meta.identifies)) {
      const otherId = obj[name];
      if (otherId !== undefined) {
	if (this.find(otherCategory, { id: otherId }).length !== 1) {
	  const msg = `invalid id ${otherId} for ${otherCategory} ` +
 		      `for create ${category}`;
	  errors.push(new BlogError('BAD_ID', msg));
	}
      }
    }
  }
    
} //Data

//default max count of object values returned from find()
const COUNT = 5;

function sortCreationTime(a, b) {
  return b.creationTime.getTime() - a.creationTime.getTime();
}	 


function addIndex(index, value, id) {
  const set = index[value] || new Set();
  set.add(id);
  index[value] = set;
}


/** Massage meta into a more useful structure.  Return map[category]
 *  to a map { fields, indexes, identifies, indentifiedBy }:
 *    fields: the incoming fields in meta.
 *    indexes: a map from field-names to the indexing relation.
 *    identifies: a map from fields to the category indentified
 *    by that field.
 *    identifiedBy: an array of pairs giving the category, field
 *    by which this category is identified.
 */
function metaInfo(meta) {

    const infos = {};
    //
    for (const [category, fields] of Object.entries(meta)) {
        
        const indexPairs = fields.filter(f => f.doIndex).map(f => [ f.name, f.rel || 'eq' ]);

        const indexes = Object.fromEntries(indexPairs);

        const identifiesPairs = fields.filter(f => f.identifies).map(f => [ f.name, f.identifies ]);

        const identifies = Object.fromEntries(identifiesPairs);

        infos[category] = { fields, indexes, identifies, identifiedBy: [], };
    }

    for (const [category, info] of Object.entries(infos)) {

        for (const [field, cat] of Object.entries(info.identifies)) {

            infos[cat].identifiedBy.push([category, field]);
        }
    }

    return infos;
}

/** For each field in map indexesMeta, get its value in valueObj ||
 *  obj. Return list of [ indexFieldName, value ].  Note that if
 *  an index field has a relation of 'array_eq', then use the
 *  list of values.
 */
function indexPairs(obj, indexesMeta, valueObj) {
  const pairs = [];
  for (const [name, rel] of Object.entries(indexesMeta)) {
    const value = (valueObj || obj)[name];
    if (value !== undefined) {
      if (rel === 'array_eq') {
	value.forEach(v => pairs.push([name, v]));
      }
      else
	pairs.push([name, value]);
    }
  }
  return pairs;
}


function makeId(collection) {
  return String(Object.keys(collection.data).length) +
         String(Math.random()).slice(1, 7);
}

function intersect(list, set) { //treat undefined list as universe
  return (list === undefined) ? Array.from(set) : list.filter(x => set.has(x));
}