/*
 * dbmigrate
 * https://github.com/kamrulislam/node-mysql-migration/lib/dbmigrate.js
 *
 * Copyright (c) 2013 Md Kamrul Islam
 * Licensed under the MIT license.
 *
 * This is the entry point. Use `node dbmigrate help` to find out available options
 *
 */

var migration = require('./MigrationModel');
migration.run();